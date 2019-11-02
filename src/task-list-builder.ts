import { Task, TaskInfo, CancelationToken } from "./sync-models";
import { BehaviorSubject, Observable, Subject } from "rxjs";
import  moment from 'moment';
import { Warning } from "./warning";
type Func1 = () => Promise<any>
type Func2 = (status: (statusTxt: string) => void) => Promise<any>
type Func3 = (status: (statusTxt: string) => void, warn: (warning: Warning) => void) => Promise<any>

type TaskFunc = Func1 | Func2 | Func3;
type TaskTree =  TaskFunc   | TaskObject | TaskArray;

interface TaskObject {
    [x: string]: TaskTree;
}

interface TaskArray extends Array<TaskTree> { } 


export type TaskListDescription<T> = {
    [P in keyof T]: TaskTree
}
export class TaskListBuilder {    
    public fromDescription<T>(description: TaskListDescription<T>): TaskListBuilder{
        for(const propKey in description) {
            this.addTasks(propKey, description[propKey],1)
        }        
        return this;

    }
    private addTasks(sectionName: string, obj: any, sequence: number ){
        Object.keys(obj).forEach(key => {
            if(typeof obj[key] == 'function')
                this.addTask(sectionName, key, sequence, obj[key])
            else
                this.addTasks(sectionName, obj[key], sequence + 1)
        })
    }    
    
    public addTask(sectionName: string, name: string, sequence: number, runMethod: TaskFunc): TaskListBuilder {
        const taskComplete$ = new Subject<boolean>();
        let info$ = new BehaviorSubject<TaskInfo>({
            name,
            sectionName,
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
            sectionName,
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


export function taskListFromDescription<T>(description: TaskListDescription<T>): Task[] {
    return new TaskListBuilder()
        .fromDescription(description)
        .buildTasks();
}