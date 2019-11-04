import { Job, JobAlreadyStartedError, JobAlreadyCompletedError } from './job'
import { assert, expect } from './test-util/helpers';
import { delayRun, wait } from './test-util/delay-run';
describe('Job', () => {
    describe('start', () => {
        it('should not be called more than once', async () => {
            const job = new Job(() => Promise.resolve());
            job.start()
            expect(() => job.start()).to.throw(JobAlreadyStartedError)            
            await job.waitForCompletion();
        })
        it('should not be called if job is finished', async () => {
            const job = new Job(() => Promise.resolve())
            await job.start().waitForCompletion()
            expect(() => job.start()).to.throw(JobAlreadyCompletedError)
        })
    })
})
class MyError extends Error {
    constructor(
        msg: string
    ){
        super(msg);
    }
}
function throwError() {
    throw new MyError('blah')
}