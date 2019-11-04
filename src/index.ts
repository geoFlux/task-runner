import { JobDescription, TaskListBuilder } from "./task-list-builder";
import { JobInfo } from "./job-models";
import { Job } from "./Job";
//todo: test me
export function createJob<T>(description: JobDescription<T>){
    const builder = new TaskListBuilder();
    builder.from(description);
    
    let job: Job<T>;
    const start = () => {
        job = new Job(builder.buildTasks());
        return job.start();
    }
    return {
        start: () => start(),
        limitInFlightTasks: (maxInflightTasks: number) => {
            builder.limitInFlightTasks(maxInflightTasks);
            return {
                start: () => start()
            }
        }
        
    }
}