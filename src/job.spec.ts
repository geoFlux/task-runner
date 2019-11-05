import { Job, JobAlreadyStartedError, JobAlreadyCompletedError } from './job'
import { assert, expect } from './test-util/helpers';
import { delayRun, wait } from './test-util/delay-run';
import { takeUntil, reduce } from 'rxjs/operators';
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
        it('syncTime should be number of milliseconds job has been running ', async () => {
            const jobInfo = new Job(() => wait(1)).start();
            const syncTimes = await jobInfo.syncTime$.pipe(
                takeUntil(jobInfo.finished$),
                reduce((acc, syncTime) => [...acc, syncTime] ,<any>[])
            ).toPromise();

            syncTimes.forEach((syncTime: any) => {
                expect(typeof syncTime).to.eq('number')
            })
        })
        it('syncTime should start with zero', async () => {
            const jobInfo = new Job(() => wait(1)).start();
            const syncTimes = await jobInfo.syncTime$.pipe(
                takeUntil(jobInfo.finished$),
                reduce((acc, syncTime) => [...acc, syncTime] ,<any>[])
            ).toPromise();

            expect(syncTimes[0]).to.eq(0)
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