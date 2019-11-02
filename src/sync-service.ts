import { Subject, Observable, BehaviorSubject, ReplaySubject } from 'rxjs';
import  moment from 'moment';
import { TaskInfo, SyncInfo, SyncResult, Task, isTask } from './sync-models';
import { CancelToken, getCancelToken } from "./cancel-token";
import { TaskListRunner } from './task-list-runner';
import flatMap from 'lodash.flatmap'
import { Warning } from './warning';
import { taskListFrom, TaskListDescription, FromArrayArgs } from './task-list-builder';

/*
  Generated class for the SyncProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/

export class SyncService{
    constructor(
    ){
    }
    private taskRunner = new TaskListRunner();
    private currentTaskInfos = new Subject<TaskInfo[]>();
    private progress = new Subject<number>();
    private isSyncing = new BehaviorSubject(false);
    private finished$: Subject<SyncResult> = new ReplaySubject<SyncResult>(1);;
    public beginSync<T>(target: Task[] | TaskListDescription<T> | FromArrayArgs): SyncInfo{
        let taskArray = this.getTaskArray(target)
        const cancelToken = getCancelToken();
        

        setTimeout(async () => {
            await this.sync(taskArray, cancelToken)
        },10);
        
        this.isSyncing.next(true);
        const startTime = moment();

        return {
            tasks$: this.currentTaskInfos.asObservable(),
            progress$: this.progress.asObservable(),
            syncTime$: Observable.interval(1000)
                .takeUntil(this.isSyncing.filter(x => x == false))
                .map(t => moment(moment(new Date()).diff(startTime)).format('mm:ss')),
            cancelToken,
            finished$: this.finished$.asObservable()
        }
    }

    private getTaskArray<T>(target: Task[] | TaskListDescription<T> | FromArrayArgs) {
        let taskArray: Task[]
        function isTaskListDescription(obj: Task[] | TaskListDescription<T> | FromArrayArgs): obj is TaskListDescription<T>{
            return !Array.isArray(obj);
        }
        
        function isFromArrayArgs(obj: Task[] | FromArrayArgs): obj is FromArrayArgs {                        
            return !obj.every((x: any) => isTask(x))                            
        }
        if(isTaskListDescription(target) || isFromArrayArgs(target)){
            taskArray = taskListFrom(target);
        }        
        else{
            taskArray = target;
        }
        return taskArray;
    }
    
    private async sync(tasks: Task[], cancelToken: CancelToken){
        this.progress.next(0);


        const taskInfos = tasks.map(t => t.info);
        let warnings: Warning[] = [];
        Observable.combineLatest(taskInfos)
            .takeUntil(this.isSyncing.filter(x => x == false))
            .subscribe(infos => {
                this.currentTaskInfos.next(infos)
                const total = infos.length;
                const complete = infos.filter(i => i.status == 'finished' ).length
                this.progress.next(Math.floor(complete/total * 100));
                warnings = flatMap(infos, info => info.warnings);
            });

        let error: any = null;
        Observable.combineLatest(taskInfos)
            .takeUntil(this.isSyncing.filter(x => x == false))
            .filter(infos => infos.some(i => i.errorCount > 0))
            .take(1)
            .subscribe(infos => {
                error = infos.filter(i => i.error !=  null)[0].error
                cancelToken.cancel()
            });


        this.taskRunner.runTasks(tasks, cancelToken)
            .then(() => {
                this.isSyncing.next(false);
                this.finished$.next({
                    error,
                    cancelled: cancelToken.isCanceled(),
                    warnings: warnings
                });
                cancelToken.invalidate();
            })
    }

}






