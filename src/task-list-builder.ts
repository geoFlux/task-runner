import { Task, TaskInfo, CancelationToken } from "./sync-models";
import { BehaviorSubject, Observable, Subject } from "rxjs";
import  moment from 'moment';
import { Warning } from "./warning";


type myFunc = ( () => Promise<any> ) | ( (status: (statusTxt: string) => void) => Promise<any> ) | ( (status: (statusTxt: string) => void, warn: (warning: Warning) => void) => Promise<any> );
type TaskTree = ( myFunc )  | TaskObject | TaskArray;

interface TaskObject {
    [x: string]: TaskTree;
}

interface TaskArray extends Array<TaskTree> { }

type TaskListDescription = {
    upload?: TaskTree,
    cleanup?: TaskTree,
    download?: TaskTree
}
export class TaskListBuilder {
    public fromDescription(description: TaskListDescription): TaskListBuilder{

        this.addTasks('upload', description.upload || [], 1);
        this.addTasks('clean', description.cleanup || [], 1);
        this.addTasks('download', description.download || [], 1)
        return this;

    }
    private addTasks(type: 'upload' | 'clean' | 'download', obj: any, sequence: number ){
        Object.keys(obj).forEach(key => {
            if(typeof obj[key] == 'function')
                this.addTask(type, key, sequence, obj[key])
            else
                this.addTasks(type, obj[key], sequence + 1)
        })
    }
    public addUploadTask(name: string, sequence: number, runMethod: () => Promise<any>): TaskListBuilder {
        return this.addTask('upload', name, sequence, runMethod);
    }
    public addDownloadTask(name: string, sequence: number, runMethod: () => Promise<any>): TaskListBuilder {
        return this.addTask('download', name, sequence, runMethod);
    }
    public addCleanTask(name: string, sequence: number, runMethod: () => Promise<any>): TaskListBuilder {
        return this.addTask('clean', name, sequence, runMethod);
    }
    private addTask(type: 'upload' | 'clean' | 'download', name: string, sequence: number, runMethod: () => Promise<any>): TaskListBuilder {
        const taskComplete$ = new Subject<boolean>();
        let info$ = new BehaviorSubject<TaskInfo>({
            name,
            type,
            enterDate: moment().format('HH:mm:ss'),
            startDate: '',
            finishDate: '',
            sequence,
            errorCount: 0,
            isRunning: false,
            status: 'waiting',
            statusText: null,
            taskTime: '',
            warnings: []
        });
        const updateStatusText = (statusText: string) => {
            info$.next({
                ...info$.value,
                statusText
            })
        }
        const warn = (warning: Warning) => {
            info$.next({
                ...info$.value,
                warnings: [
                    ...info$.value.warnings,
                    warning
                ]
            })
        }
        let task = {
            name,
            type,
            sequence,
            info: info$.asObservable(),
            init: () => {
            },
            run: async (cancelToken: CancelationToken) => {

                info$.next({
                    ...info$.value,
                    startDate: cancelToken.isCanceled() ? '': moment().format('HH:mm:ss'),
                    finishDate: '',
                    isRunning: true,
                    errorCount: 0,
                    status: 'running',
                });

                try{
                    //start timer
                    if(!cancelToken.isCanceled()){
                        const startTime = moment();
                        Observable.interval(1000)
                            .map(t => moment(moment(new Date()).diff(startTime)).format('mm:ss'))
                            .startWith('< 1')
                            .takeUntil(taskComplete$)
                            .subscribe(taskTime => {
                                info$.next({
                                    ...info$.value,
                                    taskTime
                                })
                            });
                        let runMethod2 = runMethod as any;
                        //await task completion or cancelation
                        await Promise.race([
                            cancelToken.waitForCancelation(),
                            runMethod2(updateStatusText, warn)
                        ])
                    }


                    taskComplete$.next(true);


                    if(cancelToken.isCanceled()){
                        info$.next({
                            ...info$.value,
                            finishDate: moment().format('HH:mm:ss'),
                            isRunning: false,
                            status: 'canceled',
                        });
                    }
                    else{
                        info$.next({
                            ...info$.value,
                            finishDate: moment().format('HH:mm:ss'),
                            isRunning: false,
                            status: 'finished',
                        });
                    }
                }
                catch(err){
                    console.error('--caught error', err);
                    info$.next({
                        ...info$.value,
                        finishDate: moment().format('HH:mm:ss'),
                        isRunning: false,
                        errorCount: 1,
                        error: err,
                        status: 'errored',
                    })
                }


            }
        };
        this.tasks.push(task);
        return this;
    }
    private tasks: Task[] = [];
    constructor(
    ){

    }
    public buildTasks(): Task[] {
        return this.tasks;
    }
}
