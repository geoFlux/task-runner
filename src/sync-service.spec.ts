import { SyncService } from './sync-service'
import { TaskListBuilder } from './task-list-builder'
import assert from 'assert'
import { GenericWarning } from './warning'
describe('SyncService', () => {
    describe('BeginSync', () => {
        it('should run a single task', async () =>{
            const tb = new TaskListBuilder();
            let downloadTaskRan = false;
            tb.addTask('download','My test task',1, async () => {
                await wait(2);
                downloadTaskRan = true;
            })
            const sync = new SyncService();
            const syncInfo = sync.beginSync(tb.buildTasks())
    
            const result = await syncInfo.finished$.take(1).toPromise()
            
            assert.equal(result.error, null, 'Did not expect any error')
            assert.equal(downloadTaskRan, true, 'Download task did not run')
        })
        it('should run tasks from description', async () => {
            const sync = new SyncService();
            const runStack: string[] = []
    
            const syncInfo = sync.beginSync({
                upload: {
                    'upload desc 1': () => delayRun(() => runStack.push('upload'))
                },
                cleanup: {
                    'clean task 1': () => delayRun(() => runStack.push('clean'))
                },
                download: {
                    'download task 2': () => delayRun(() => runStack.push('download'))
                }
            })
    
            await syncInfo.finished$.take(1).toPromise();
            
            assert.equal(runStack.some(x => x == 'upload'), true, 'Upload task did not run')
            assert.equal(runStack.some(x => x == 'clean'), true, 'Clean task did not run')
            assert.equal(runStack.some(x => x == 'download'), true, 'Download task did not run')
    
        })
        it('should run tasks in order', async () => {
            const sync = new SyncService();
            const runStack: string[] = []
    
            //each section will be run sequentially, i.e. first all upload tasks will run, then all clean tasks, etc..
            //within each section, everything on the same level will run in parralel
            //i.e. everything in level 1 will run in parallel, then everything in level 2 will run in parralles, etc...
            const syncInfo = sync.beginSync({
                upload: {//<--- this is the upload section
                    'upload desc 1': () => delayRun(() => runStack.push('upload1')),//<--- this is level one of the upload section
                    'then': {
                        'upload desc 2': () => delayRun(() => runStack.push('upload2'),3),//<--- this is level two of the upload section
                        'upload desc 3': () => delayRun(() => runStack.push('upload3'))   //<--- so is this, these tasks will run in parallel
                    }
                },            
                cleanup: {//<--- cleanup section
                    'clean task 1': () => delayRun(() => runStack.push('clean1')),//<--- cleanup level 1
                    'then': {
                        'clean task 2': () => delayRun(() => runStack.push('clean2'),4),//<--- cleanup level 2
                        'then': {
                            'clean task3': () => delayRun(() => runStack.push('clean3'),2)//<--- cleanup level 3
                        }
                    }
                },
                download: {//<--- download section            
                    'download task 1': () => delayRun(() => runStack.push('download1'),6),//<---------------------
                    'download task 2': () => delayRun(() => runStack.push('download2'),4),//<--- download level 1
                    'download task 3': () => delayRun(() => runStack.push('download3'),2),//<---------------------
                    'then':{
                        'download task 4': () => delayRun(() => runStack.push('download4'))//<--- download level 2
                    }
                }
            })
            
    
            await syncInfo.finished$.take(1).toPromise();
            
    
            
            assert.equal(runStack[0], 'upload1', 'Upload task 1 did not run in order')
                           
            const uploadLevel2 = runStack.slice(1,3)
            assert.equal(uploadLevel2.some(x => x=='upload2'), true, 'Upload task 2 did not run in order')
            assert.equal(uploadLevel2.some(x => x=='upload3'), true, 'Upload task 3 did not run in order')
    
            assert.equal(runStack[3], 'clean1', 'Clean 1 task did not run in order')
            assert.equal(runStack[4], 'clean2', 'Clean 2 task did not run in order')
            assert.equal(runStack[5], 'clean3', 'Clean 3 task did not run in order')
    
            const downloadLevel1 = runStack.slice(6,9)
            assert.equal(downloadLevel1.some(x => x=='download1'), true, 'Download 1 task did not run in order')        
            assert.equal(downloadLevel1.some(x => x=='download2'), true, 'Download 2 task did not run in order')
            assert.equal(downloadLevel1.some(x => x=='download3'), true, 'Download 3 task did not run in order')
    
            assert.equal(runStack[9], 'download4', 'Download 4 task did not run in order')
        })
        it('should be able to get status text from individual tasks', async () => {
            const sync = new SyncService();
            const runStack: string[] = []
    
            const syncInfo = sync.beginSync({
                upload: {
                    'upload desc 1': async ({status}) => {
                        await delayRun(() => runStack.push('upload'))
                        status('uploadStatus')
                    }
                },
                cleanup: {
                    'clean task 1': () => delayRun(() => runStack.push('clean'))
                },
                download: {
                    'download task 2': () => delayRun(() => runStack.push('download'))
                },                 
            })
            let statusText: string | null = null
    
            syncInfo.tasks$
                .takeUntil(syncInfo.finished$)
                .map(x => x.find(y => y.name == 'upload desc 1'))
                .subscribe(x => {
                    statusText = x == null ? null: x.statusText
                })
                        
            await syncInfo.finished$.take(1).toPromise();
            
            assert.equal(statusText, 'uploadStatus');
    
            assert.equal(runStack.some(x => x == 'upload'), true, 'Upload task did not run')
            assert.equal(runStack.some(x => x == 'clean'), true, 'Clean task did not run')
            assert.equal(runStack.some(x => x == 'download'), true, 'Download task did not run')
        })
        it('should accumulate all warnings', async () => {
            const sync = new SyncService();
            const runStack: string[] = []
    
            const syncInfo = sync.beginSync({
                upload: {
                    'upload desc 1': async ({warn}) => {
                        await delayRun(() => runStack.push('upload'))
                        warn(new GenericWarning('bad stuff is happening'))
                    }
                },
                cleanup: {
                    'clean task 1': async ({warn}) => {
                        warn('more bad stuff is happening')
                        await delayRun(() => runStack.push('clean'))
                    }
                },
                download: {                
                    'download task 2': async ({warn}) => {
                        warn('download warning')
                        await delayRun(() => runStack.push('download'))
                        warn('another warning')
                    }
                },                 
            })                
                        
            const result = await syncInfo.finished$.take(1).toPromise();
            
            assert.equal(result.warnings.length, 4, 'expected 4 warnings to be returned')
    
            assert.equal(runStack.some(x => x == 'upload'), true, 'Upload task did not run')
            assert.equal(runStack.some(x => x == 'clean'), true, 'Clean task did not run')
            assert.equal(runStack.some(x => x == 'download'), true, 'Download task did not run')
        })

        it('accepts an array of name, task pairs and runs them', async () => {
            const sync = new SyncService();            
            const bld = new TaskListBuilder();

            const runStack: string[] = [];
            const target = [              
                {name:'upload 1', task: () => delayRun(() => runStack.push('upload'))},
                {name:'upload 2', task: () => delayRun(() => runStack.push('upload'))},
                {name:'upload 3', task:() => delayRun(() => runStack.push('upload'))},            
            ];            

            const syncInfo = sync.beginSync(target);
            
            await syncInfo.finished$.take(1).toPromise();
            assert.equal(runStack.length, 3, 'expected all tasks to run')
        } )
        it('accepts an array of TaskFuncs and runs them', async () => {
            const sync = new SyncService();            
            const bld = new TaskListBuilder();

            const runStack: string[] = [];
            const target = [              
                () => delayRun(() => runStack.push('upload')),
                () => delayRun(() => runStack.push('upload')),
                () => delayRun(() => runStack.push('upload')),            
            ]

            const syncInfo = sync.beginSync(target);
            
            await syncInfo.finished$.take(1).toPromise();
            assert.equal(runStack.length, 3, 'expected all tasks to run')
        } )
        it('accepts an array of Promises and runs them', async () => {
            const sync = new SyncService();            
            const bld = new TaskListBuilder();

            const runStack: string[] = [];
            const target = [              
                delayRun(() => runStack.push('upload')),
                delayRun(() => runStack.push('upload')),
                delayRun(() => runStack.push('upload')),            
            ]            

            const syncInfo = sync.beginSync(target);
            
            await syncInfo.finished$.take(1).toPromise();
            assert.equal(runStack.length, 3, 'expected all tasks to run')
        } ) 
    })
    
    
})

/**
 * run the given function asynchronously after waiting for timeout milliseconds
 * @param func the function to run
 * @param delay amount of time in milliseconds to wait before running the given function
 */
async function delayRun(func: Function, delay?: number) {
    delay = delay || 0;
    await wait(delay);
    func();
}
function wait(delay: number){
    return new Promise(resolve => {
        setTimeout(() => {
            resolve()
        }, delay)
    })
}