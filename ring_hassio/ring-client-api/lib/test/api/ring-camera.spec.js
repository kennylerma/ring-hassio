"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("../../api");
describe('Ring Camera', () => {
    describe('battery level', () => {
        it('should handle string battery life', () => {
            expect(api_1.getBatteryLevel({ battery_life: '49' })).toEqual(49);
        });
        it('should handle null battery life', () => {
            expect(api_1.getBatteryLevel({ battery_life: null })).toEqual(null);
        });
        it('should handle right battery only', () => {
            expect(api_1.getBatteryLevel({ battery_life: null, battery_life_2: 24 })).toEqual(24);
        });
        it('should handle left battery only', () => {
            expect(api_1.getBatteryLevel({ battery_life: 76, battery_life_2: null })).toEqual(76);
        });
        it('should handle dual batteries', () => {
            expect(api_1.getBatteryLevel({ battery_life: '92', battery_life_2: 84 })).toEqual(84);
            expect(api_1.getBatteryLevel({ battery_life: '92', battery_life_2: 100 })).toEqual(92);
        });
    });
});
