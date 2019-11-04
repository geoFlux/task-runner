export function isPromise(obj: any): obj is Promise<any> {
    return !!((<any>obj).then)
}