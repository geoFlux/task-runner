import { getCancelToken } from "./cancel-token"
import {fake, expect, assert } from './test-util/helpers'

describe('CancelToken',() => {
    describe('cancel', () => {
        it('should cancel', async () => {
        
            const token = getCancelToken();
            token.cancel()
            
            assert.equal(token.isCanceled(), true, 'isCanceled should be true')
            assert.equal(token.isValid(),true, 'isValid should be true')        
        })
    })
    describe('invalidate', () => {
        it('should invalidate', async () => {
            const token = getCancelToken();
            token.invalidate();
            assert.equal(token.isValid(), false);
            assert.equal(token.isCanceled(), false)
        })
    })
    describe('waitForCancelation', () => {
        it('should stop waiting if token is cancelled', async () => {
            const token = getCancelToken();
            let waitCompleted = false;
            const waitForCancel = async() => {
                await token.waitForCancelation();
                waitCompleted = true;
            }
    
            const promise = waitForCancel();
            token.cancel();
            await promise
            assert.equal(waitCompleted, true)
        })
        it('should stop waiting if token is invalidated', async () => {
            const token = getCancelToken();
            let waitCompleted = false;
            const waitForCancel = async () => {
                await token.waitForCancelation();
                waitCompleted = true;
            }
    
            const promise = waitForCancel();

            token.invalidate();
            await promise
            assert.equal(waitCompleted, true)
        })
    })
    
})