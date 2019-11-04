import { TaskListRunner } from "./task-list-runner";
import { TaskListBuilder } from "./task-list-builder";
import { getCancelToken } from "./cancel-token";
import { JobService } from "./job-service";
import { delayRun, wait } from "./test-util/delay-run";
import {fake, expect, assert } from './test-util/helpers'

describe('TaskListBuilder', () => {
    describe('limitInFlightTasks',() => {
        it('should limit the number of tasks that run in parallel', async  () => {
            const sync = new JobService();
            
            const bld = new TaskListBuilder();
            const maxInFlightTasks = 4;
            const tasks = bld
                .limitInFlightTasks(maxInFlightTasks)
                .fromDescription({
                default: {
                    'upload 1': () => wait(5),
                    'upload 2': () => wait(2),
                    'upload 3': () => wait(3),
                    'upload 4': () => wait(5),
                    'upload 5': () => wait(1),
                    'upload 6': () => wait(15),
                    'upload 7': () => wait(3),
                    'upload 8': () => wait(2),
                    'upload 9': () => wait(5),
                    'upload 10': () => wait(5),

                }
            }).buildTasks()
            const cancelToken = getCancelToken();

            const syncInfo = sync.beginSync(tasks);
            let maxNumRunningTasksSeen = 0;
            syncInfo.tasks$
                .takeUntil(syncInfo.finished$)
                .map(x => x.filter(y => y.isRunning))
                .subscribe(taskInfos => {
                    if(taskInfos.length > maxNumRunningTasksSeen){
                        maxNumRunningTasksSeen = taskInfos.length
                    }                    
                })
            const result = await syncInfo.finished$.take(1).toPromise();
            assert.equal(maxNumRunningTasksSeen, 4, 'expected running tasks to be less that 4')
        })        
    })
    describe('fromDescription', () => {
        it('accepts top level promises', async () => {
            const sync = new JobService();            
            const bld = new TaskListBuilder();

            const runStack: string[] = [];
            const tasks = bld
                .fromDescription({                
                    'upload 1': () => delayRun(() => runStack.push('upload')),
                    'upload 2': () => delayRun(() => runStack.push('upload')),
                    'upload 3': () => delayRun(() => runStack.push('upload')),
                
                }).buildTasks()
            const cancelToken = getCancelToken();

            const syncInfo = sync.beginSync(tasks);
            
            const result = await syncInfo.finished$.take(1).toPromise();
            assert.equal(runStack.length, 3, 'expected all tasks to run')
        })
    })
    describe('fromArray', () => {
        it('accepts an array of name, task pairs and runs them', async () => {
            const sync = new JobService();            
            const bld = new TaskListBuilder();

            const runStack: string[] = [];
            const tasks = bld
                .fromArray([              
                    {name:'upload 1', task: () => delayRun(() => runStack.push('upload'))},
                    {name:'upload 2', task: () => delayRun(() => runStack.push('upload'))},
                    {name:'upload 3', task:() => delayRun(() => runStack.push('upload'))},            
                ]).buildTasks()

            const syncInfo = sync.beginSync(tasks);
            
            await syncInfo.finished$.take(1).toPromise();
            assert.equal(runStack.length, 3, 'expected all tasks to run')
        } )
        it('accepts an array of TaskFuncs and runs them', async () => {
            const sync = new JobService();            
            const bld = new TaskListBuilder();

            const runStack: string[] = [];
            const tasks = bld
                .fromArray([              
                    () => delayRun(() => runStack.push('upload')),
                    () => delayRun(() => runStack.push('upload')),
                    () => delayRun(() => runStack.push('upload')),            
                ]).buildTasks()

            const syncInfo = sync.beginSync(tasks);
            
            await syncInfo.finished$.take(1).toPromise();
            assert.equal(runStack.length, 3, 'expected all tasks to run')
        } )
        it('accepts an array of Promises and runs them', async () => {
            const sync = new JobService();            
            const bld = new TaskListBuilder();

            const runStack: string[] = [];
             const promises = [              
                delayRun(() => runStack.push('upload')),
                delayRun(() => runStack.push('upload')),
                delayRun(() => runStack.push('upload')),            
            ]
            const tasks = bld
                .fromArray(promises).buildTasks()

            const syncInfo = sync.beginSync(tasks);
            
            await syncInfo.finished$.take(1).toPromise();
            assert.equal(runStack.length, 3, 'expected all tasks to run')
        } )        
    })    
})
