

import flatMap from './flat-map'
import { expect } from '../test-util/helpers'
describe('flatMap', () => {
    it('should return array of values from selector', () => {
        const val1 = [{
            items:[1,2,3,4]
        },
         {
            items:[5,6,7,8,9]
        }]
        const result = flatMap(val1, val => val.items)
        expect(result).to.eql([1,2,3,4,5,6,7,8,9])
    })
})