import { Subject, BehaviorSubject, ReplaySubject, interval, combineLatest } from 'rxjs';
import moment from 'moment';//todo: remove moment
import { TaskInfo, JobInfo, JobResult, Task, isTask } from './job-models';
import { CancelToken, getCancelToken } from "./cancel-token";
import { TaskListRunner } from './task-list-runner';
import flatMap from 'lodash.flatmap';
import { Warning } from './warning';
import { taskListFrom, TaskListDescription, ArrayOfTaskLike, JobDescription } from './task-list-builder';
import { isPromise } from './util/is-promise';
import { filter, takeUntil, map, take } from 'rxjs/operators'
export class Job<T> {
    private taskArray: Task[];
    private taskRunner = new TaskListRunner();
    private currentTaskInfos = new Subject<TaskInfo[]>();
    private progress = new Subject<number>();
    private isSyncing = new BehaviorSubject(false);
    private finished$: Subject<JobResult> = new ReplaySubject<JobResult>(1);
    private cancelToken = getCancelToken();
    private finishedRunning = false;
    constructor(target: Task[] | JobDescription<T>) {
        this.taskArray = this.getTaskArray(target);
    }
    private getTaskArray<T>(target: Task[] | JobDescription<T>) {
        let taskArray: Task[];
        function isTaskListDescription(obj: Task[] | JobDescription<T>): obj is TaskListDescription<T> {
            return !Array.isArray(obj);
        }
        function isFromArrayArgs(obj: Task[] | ArrayOfTaskLike | Promise<any>): obj is ArrayOfTaskLike {
            if (isPromise(obj))
                return false;
            return !obj.every((x: any) => isTask(x));
        }
        if (isTaskListDescription(target) || isFromArrayArgs(target) || isPromise(target)) {
            taskArray = taskListFrom(target);
        }
        else {
            taskArray = target;
        }
        return taskArray;
    }
    public start(): JobInfo {
        if (this.finishedRunning)
            throw new JobAlreadyCompletedError('Job has already completed');
        if (this.isSyncing.value)
            throw new JobAlreadyStartedError('job has already started');
        setTimeout(async () => {
            await this.sync(this.taskArray, this.cancelToken);
        }, 10);
        this.isSyncing.next(true);
        const startTime = moment();
        
        return {
            tasks$: this.currentTaskInfos.asObservable(),
            progress$: this.progress.asObservable(),
            syncTime$: interval(1000)
                .pipe(
                    takeUntil(this.isSyncing.pipe(filter(x => x == false))),
                    map(() => moment(moment(new Date()).diff(startTime)).format('mm:ss'))
                ),
            cancelToken: this.cancelToken,
            finished$: this.finished$.asObservable(),
            waitForCompletion: this.waitForCompletion
        };
    }
    public async waitForCompletion(): Promise<JobResult> {
        const result = await this.finished$.pipe(take(1)).toPromise();
        return result
    }
    private async sync(tasks: Task[], cancelToken: CancelToken) {
        this.progress.next(0);
        const taskInfos = tasks.map(t => t.info);
        let warnings: Warning[] = [];
        combineLatest
        combineLatest(taskInfos)
            .pipe(            
                takeUntil(this.isSyncing.pipe(filter(x => x == false)))
            )            
            .subscribe(infos => {
                this.currentTaskInfos.next(infos);
                const total = infos.length;
                const complete = infos.filter(i => i.status == 'finished').length;
                this.progress.next(Math.floor(complete / total * 100));
                warnings = flatMap(infos, info => info.warnings);//todo: this is the only place flatMap is used, write your own flatMap
            });
        let error: any = null;
        combineLatest(taskInfos)
            .pipe(
                takeUntil(this.isSyncing.pipe(filter(x => x == false))),
                filter(infos => infos.some(i => i.errorCount > 0)),
                take(1)
            )            
            .subscribe(infos => {
                error = infos.filter(i => i.error != null)[0].error;
                cancelToken.cancel();
            });
        this.taskRunner.runTasks(tasks, cancelToken)
            .then(() => {
                this.finishedRunning = true;
                this.isSyncing.next(false);
                this.finished$.next({
                    error,
                    cancelled: cancelToken.isCanceled(),
                    warnings: warnings
                });
                cancelToken.invalidate();
            });
    }
}

export class JobAlreadyStartedError extends Error {
    constructor(
        msg: string
    ){
        super(msg);
    }
}

export class JobAlreadyCompletedError extends Error {
    constructor(
        msg: string
    ){
        super(msg);
    }
}