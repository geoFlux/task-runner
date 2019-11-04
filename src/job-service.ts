import { Subject, Observable, BehaviorSubject, ReplaySubject } from 'rxjs';
import  moment from 'moment';
import { TaskInfo, JobInfo, JobResult, Task, isTask } from './job-models';
import { CancelToken, getCancelToken } from "./cancel-token";
import { TaskListRunner } from './task-list-runner';
import flatMap from 'lodash.flatmap'
import { Warning } from './warning';
import { taskListFrom, TaskListDescription, ArrayOfTaskLike, JobDescription } from './task-list-builder';
import { isPromise } from './util/is-promise';
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

