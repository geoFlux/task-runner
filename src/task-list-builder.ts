import { Task, TaskInfo } from "./sync-models";
import { CancelToken } from "./cancel-token";
import { BehaviorSubject, Observable, Subject } from "rxjs";
import  moment from 'moment';
import { Warning, GenericWarning } from "./warning";

interface TaskFuncArgs {
    status: (statusTxt: string) => void,
    warn: (warning: Warning | string) => void
}
type TaskFunc = (args: TaskFuncArgs) => Promise<any>

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
        
        const {topLevelFuncs, topLevelTrees} = this.crackDescription(description);

        if(topLevelFuncs.length > 0){
            this.addTasksFromNameValue('', topLevelFuncs)//TODO: guarantee top level name isn't already a section name
        }
        
        topLevelTrees.forEach(x => this.addTasks(x.name, x.tree,1))
             
        return this;

    }    
    crackDescription<T>(description: TaskListDescription<T>): {
        topLevelFuncs: { name: string; func: TaskFunc }[];
        topLevelTrees: { name: string; tree: TaskListDescription<T> }[];
    } {
        const desc = description as any;
        const topLevelFuncs = Object.keys(desc)
            .filter(key => typeof desc[key] == "function")
            .map(key => ({
                name: key,
                func: desc[key]
            }));
    
        let topLevelTrees: any[] = [];
        for (const propKey in description) {
            if (typeof description[propKey] != "function") {
                topLevelTrees.push({
                    name: propKey,
                    tree: description[propKey]
                });
            }
        }
    
        return {
            topLevelFuncs,
            topLevelTrees
        };
    }
    private addTasksFromNameValue(section: string, obj: {name: string, func: TaskFunc}[]){
        let tmp = {} as any;
        obj.forEach(x => tmp[x.name] = x.func)
        this.addTasks(section, tmp, 1)
    }

    private maxInFlightTasks: number = 0;//zero for no limit
    
    private inFlightRefCounter = (() => {
        const inFlight = new BehaviorSubject(0);
        const waitToProceed = async () => {                
            if(this.maxInFlightTasks <= 0) return;
            await inFlight
                .filter(numTasksInFlight => numTasksInFlight < this.maxInFlightTasks)
                .take(1)
                .toPromise();
        };

        return {
            increment: async () => {
                do{
                    if(this.maxInFlightTasks <= 0) {
                        inFlight.next(inFlight.value + 1)
                        return
                    }
                    else{
                        await waitToProceed();
                        const currInFlightTasks = inFlight.value;
                        if(currInFlightTasks < this.maxInFlightTasks){
                            inFlight.next(currInFlightTasks + 1)
                            break;
                        }
                    }
                }while(true)                
                
            },
            decrement: () => inFlight.next(Math.max(0,inFlight.value - 1)),
            
            getInFlight: () => inFlight.asObservable()
        }
    })()
    
    /**
     * limit the number of tasks that run in parallel
     * @param maxInflightTasks the maximum number of tasks that will be in a running state at any one time
     */
    public limitInFlightTasks(maxInflightTasks: number) {
        this.maxInFlightTasks = maxInflightTasks;
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
        const warn = (warning: Warning | string) => {
            if(typeof warning == 'string')
                warning = new GenericWarning(warning)
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
            run: async (cancelToken: CancelToken) => {
                await this.inFlightRefCounter.increment();
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
                        
                        //await task completion or cancelation
                        await Promise.race([
                            cancelToken.waitForCancelation(),
                            runMethod({status: updateStatusText, warn})
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
                finally{
                    this.inFlightRefCounter.decrement();
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