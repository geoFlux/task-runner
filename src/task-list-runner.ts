import { Task, CancelationToken } from "./sync-models";

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
    public runTasks(tasks: Task[], cancelToken: CancelationToken): Promise<void>{
        const tasksGrp:{
            upload: Task[],
            download: Task[],
            clean: Task[]
        } = groupBy(tasks, (t: Task) => t.type);

        //run upload tasks
        return this.runTasksBySequence(tasksGrp.upload, cancelToken)
            .then(() => this.runTasksBySequence(tasksGrp.clean, cancelToken))
            .then(() => this.runTasksBySequence(tasksGrp.download, cancelToken));
    }

    /**
     *
     * run each task with the same sequence in parallel. starting with the lowest sequence
     */
    private async runTasksBySequence(tasks: Task[], cancelToken: CancelationToken){
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
