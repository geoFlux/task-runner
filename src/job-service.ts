import { JobInfo, JobResult, Task } from './job-models';
import { JobDescription } from './task-list-builder';
import { Job } from './Job';


//TODO: remove this class, use Job instead
export class JobService<T>{
    private job: Job<T>;
    constructor(
    ){
         this.job = new Job<T>(Promise.resolve());
    }
        
    public beginSync<T>(target: Task[] | JobDescription<T>): JobInfo{
        this.job = new Job(target);
        return this.job.start()
    }
    public async waitForCompletion(): Promise<JobResult> {
        return this.job.waitForCompletion();
    }
    

}

