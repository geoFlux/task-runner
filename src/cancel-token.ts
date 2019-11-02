import { BehaviorSubject } from "rxjs";

export interface CancelToken {
    cancel: () => void;
    isCanceled: () => boolean;
    invalidate: () => void;
    isValid: () => boolean;
    waitForCancelation: () => Promise<boolean>;
}

export const getCancelToken = (): CancelToken =>{
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