import { Observable, BehaviorSubject } from "rxjs";
import { Warning } from "./warning";
import { CancelToken } from "./cancel-token";
//these should probably all be interfaces
export interface Task {
    name: string;
    sectionName: string,
    sequence: number,
    info: Observable<TaskInfo>,
    run: (cancelToken: CancelToken) => Promise<void>
}
export function isTask(obj: any): obj is Task {
    return obj.hasOwnProperty('name')
        && obj.hasOwnProperty('sectionName')
        && obj.hasOwnProperty('sequence')
        && obj.hasOwnProperty('info')
        && obj.hasOwnProperty('run')
        && typeof obj['run'] == 'function'
}
export interface TaskInfo {
    name: string,
    sectionName: string,
    enterDate: Date,
    startDate: Date | null,
    finishDate: Date | null,
    sequence: number,
    errorCount: number,
    isRunning: boolean,
    error?: any,
    status: 'waiting' | 'running' | 'errored' | 'canceled' | 'finished',
    statusText: string | null,
    taskTime: number;
    warnings: Warning[];
}
export type JobInfo = {
    tasks$: Observable<TaskInfo[]>;
    progress$: Observable<number>;
    syncTime$: Observable<number>;
    cancelToken: CancelToken;
    finished$: Observable<JobResult>,
    waitForCompletion(): Promise<JobResult>,
}
export interface JobResult {
    error: any,
    cancelled: boolean,
    warnings: Warning[],
}

