import { Task } from "./job-models";
import { CancelToken } from "./cancel-token";

const groupBy = (arr: any, trFunc: any) => arr.reduce((acc: any,item: any) => {
    acc[trFunc(item)] = acc[trFunc(item)] || [];
    acc[trFunc(item)].push(item);
    return acc
},({}));

/**
 * first runs upload tasks
 * then clean tasks
 * finally download tasks
 *
 * within each group(upload, clean, download) it runs any task with the same
 * sequence in parallel
 */
export class TaskListRunner{
    public runTasks(tasks: Task[], cancelToken: CancelToken): Promise<void>{        

        const tasksGrp = groupBy(tasks, (t: Task) => t.sectionName);
        const promise = Object.keys(tasksGrp)
            .map(key => <Task[]>tasksGrp[key])
            .reduce((acc,cur) => {
                acc = acc.then(() => this.runTasksBySequence(cur, cancelToken))
                return acc;
            }, Promise.resolve<any>({}))
        return promise;
    }
    

    /**
     *
     * run each task with the same sequence in parallel. starting with the lowest sequence
     */
    private async runTasksBySequence(tasks: Task[], cancelToken: CancelToken){
        tasks = tasks || [];
        const tasksSubGrp = groupBy(tasks, (t:Task) => t.sequence);

        let subTasks = Object.keys(tasksSubGrp)
                .map(key => tasksSubGrp[key] as Task[])

        return subTasks.reduce((acc, cur) => {
                acc = acc.then(() => Promise.all(cur.map(t => t.run(cancelToken))))
            return acc
        }, Promise.resolve<any>({}))
    }
}
