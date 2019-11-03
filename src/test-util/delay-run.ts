/**
 * run the given function asynchronously after waiting for timeout milliseconds
 * @param func the function to run
 * @param delay amount of time in milliseconds to wait before running the given function
 */
export async function delayRun(func: Function, delay?: number) {
    delay = delay || 0;
    await wait(delay);
    func();
}
export function wait(delay: number){
    
    return new Promise(resolve => {
        setTimeout(() => {
            resolve()
        }, delay)
    })
}