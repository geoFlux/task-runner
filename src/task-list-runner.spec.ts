import { TaskListRunner } from './task-list-runner'
import { TaskListBuilder } from './task-list-builder'
import { cancelationToken } from './sync-models';
import assert from  'assert';

describe('TaskListRunner', () => {
    it('should run tasks with arbitrary section names', async  () => {
        const runner = new TaskListRunner();
        const bld = new TaskListBuilder();
        let uploadRan = false;
        const tasks = bld.fromDescription({
            blahblahblah: {
                'upload 1': () => delayRun(() => uploadRan = true)
            }
        }).buildTasks()
        const cancelToken = cancelationToken();
        await runner.runTasks(tasks, cancelToken)
        assert.equal(uploadRan, true, 'arbitrary section did not run')
    })
    it('should run multiple sections', async() => {
        const runner = new TaskListRunner();
        const bld = new TaskListBuilder();

        const runStack: string[] = []        
        const tasks = bld.fromDescription({
            upload: {
                'upload 1': () => delayRun(() => runStack.push('upload'))
            },
            clean: {
                'clean1': () => delayRun(() => runStack.push('clean1'))
            },
            download: {
                'download1': () => delayRun(() => runStack.push('download1'))
            }
        }).buildTasks()
        const cancelToken = cancelationToken();
        await runner.runTasks(tasks, cancelToken)
        assert.equal(runStack[0],'upload')
        assert.equal(runStack[1],'clean1')
        assert.equal(runStack[2],'download1')
    })
    it('should not run subsequent sections, if cancelled', async () => {
        const runner = new TaskListRunner();
        const bld = new TaskListBuilder();
        
        const runStack: string[] = []        
        const cancelToken = cancelationToken();
        const tasks = bld.fromDescription({
            upload: {
                'upload 1': () => delayRun(() => runStack.push('upload'))
            },
            clean: {
                'clean1': () => delayRun(() => cancelToken.cancel())
            },
            download: {
                'download1': () => delayRun(() => runStack.push('download1'))
            }
        }).buildTasks()
        
        await runner.runTasks(tasks, cancelToken)
        assert.equal(runStack[0],'upload')
        assert.equal(runStack.length, 1, 'only upload task should run')
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