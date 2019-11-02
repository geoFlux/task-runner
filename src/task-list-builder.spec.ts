import { TaskListRunner } from "./task-list-runner";
import { TaskListBuilder } from "./task-list-builder";
import { getCancelToken } from "./cancel-token";
import assert = require("assert");
import { SyncService } from "./sync-service";

describe('TaskListBuilder', () => {
    describe('limitInFlightTasks',() => {
        it('should limit the number of tasks that run in parallel', async  () => {
            const sync = new SyncService();
            
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
})

async function delayRun(func: Function, delay?: number) {
    delay = delay || 0;
    await wait(delay);
    func();
}
function wait(delay: number){
    return new Promise(resolve => {
        setTimeout(() => {
            resolve()
        }, delay)
    })

}