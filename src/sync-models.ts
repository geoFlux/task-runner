import { Observable, BehaviorSubject } from "rxjs";
import { Warning } from "./warning";
//these should probably all be interfaces
export type Task = {
    name: string;
    sectionName: string,
    sequence: number,
    info: Observable<TaskInfo>,
    run: (cancelToken: CancelationToken) => Promise<void>
}

export type TaskInfo = {
    name: string,
    sectionName: string,
    enterDate: string,
    startDate: string,
    finishDate: string,
    sequence: number,
    errorCount: number,
    isRunning: boolean,
    error?: any,
    status: 'waiting' | 'running' | 'errored' | 'canceled' | 'finished',
    statusText: string | null,
    taskTime: string;
    warnings: Warning[];
}
export type SyncInfo = {
    tasks$: Observable<TaskInfo[]>;
    progress$: Observable<number>;
    syncTime$: Observable<string>;
    cancelToken: CancelationToken;
    finished$: Observable<SyncResult>,
}
export type SyncResult = {
    error: any,
    cancelled: boolean,
    warnings: Warning[],
}
export type CancelationToken = {
    cancel: () => void,
    isCanceled: () => boolean,
    invalidate: () => void,
    isValid: () => boolean,
    waitForCancelation: () => Promise<boolean>
}

export const cancelationToken = (): CancelationToken =>{
    const canceled$ = new BehaviorSubject(false);
    const isValid$ = new BehaviorSubject(true);
    return {
        cancel: () => canceled$.next(true),
        isCanceled: () => canceled$.value,
        invalidate: () => isValid$.next(false),
        isValid: () => isValid$.value,
        waitForCancelation: async () => {
            return canceled$.asObservable()
                .takeUntil(isValid$.filter(t => t == false))
                .filter(canceled => canceled == true)
                .take(1)
                .toPromise();
        }
    }
}
