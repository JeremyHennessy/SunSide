import {describe,it,expect} from 'vitest';
import {calculate,dayBounds,position,qualifies,skyPoint,intervals,type Config} from '../src/solar/engine';
const base:Config={lat:44.6488,lon:-63.5752,zone:'America/Halifax',date:'2026-06-21',facing:180,horizon:0};
describe('Independent reference and geometric conventions',()=>{
 // NREL SPA published example: 2003-10-17 12:30:30 -07:00, 39.742476N, 105.1786W.
 // https://www.nrel.gov/docs/fy08osti/34302.pdf table/example: azimuth 194.34024°, zenith 50.11162°.
 it('matches NREL SPA reference to 0.5 degrees',()=>{const p=position(Date.parse('2003-10-17T19:30:30Z'),39.742476,-105.1786);expect(p.azimuth).toBeCloseTo(194.34024,0);expect(Math.abs(p.altitude-39.88838)).toBeLessThan(.5);});
 it('handles bearing wrap, back-facing sun and night',()=>{expect(qualifies({azimuth:359,altitude:20},0,0)).toBe(true);expect(qualifies({azimuth:1,altitude:20},0,0)).toBe(true);expect(qualifies({azimuth:180,altitude:20},0,0)).toBe(false);expect(qualifies({azimuth:90,altitude:-1},90,0)).toBe(false);expect(qualifies({azimuth:90,altitude:10},90,20)).toBe(false);});
 it('maps compass and altitude correctly',()=>{expect(skyPoint({azimuth:0,altitude:0})).toEqual({x:200,y:50});expect(skyPoint({azimuth:90,altitude:0}).x).toBe(350);expect(skyPoint({azimuth:270,altitude:90})).toEqual({x:200,y:200});});
 it('retains multiple intervals',()=>{const samples=[true,false,true].map((visible,i)=>({instant:i*300000,visible,daylight:true,azimuth:0,altitude:20}));expect(intervals(samples,900000,s=>s.visible)).toEqual([{start:0,end:300000},{start:600000,end:900000}]);});
});
describe('local days and exposure',()=>{
 it.each([['2026-03-08',23],['2026-11-01',25],['2026-06-21',24]])('Halifax day %s is %s hours',(date,hours)=>{const [s,e]=dayBounds(date,'America/Halifax');expect((e-s)/3600000).toBe(hours);});
 it('uses date-line zones and non-DST zones',()=>{expect(new Date(dayBounds('2026-06-21','Pacific/Kiritimati')[0]).toISOString()).toBe('2026-06-20T10:00:00.000Z');expect(dayBounds('2026-06-21','Asia/Singapore')[1]-dayBounds('2026-06-21','Asia/Singapore')[0]).toBe(86400000);});
 it('handles polar day and night',()=>{expect(calculate({...base,lat:78,lon:15,zone:'Arctic/Longyearbyen'}).dayMinutes).toBe(1440);expect(calculate({...base,lat:78,lon:15,zone:'Arctic/Longyearbyen',date:'2026-12-21'}).dayMinutes).toBe(0);});
 it.each([[44.65,-63.57,'America/Halifax'],[40.71,-74,'America/New_York'],[51.5,-.12,'Europe/London'],[-33.87,151.21,'Australia/Sydney'],[1.35,103.82,'Asia/Singapore'],[69.65,18.96,'Europe/Oslo']] as const)('bounded estimates at %s %s',(lat,lon,zone)=>{for(const date of ['2026-03-20','2026-06-21','2026-09-22','2026-12-21'])for(const facing of [0,90,180,270]){const r=calculate({...base,lat,lon,zone,date,facing});expect(r.sunMinutes).toBeLessThanOrEqual(r.dayMinutes);expect(r.sunMinutes).toBeGreaterThanOrEqual(0);}});
 it('east exposure precedes west and obstruction reduces exposure',()=>{const east=calculate({...base,facing:90}),west=calculate({...base,facing:270});expect(east.sun[0].start).toBeLessThan(west.sun[0].start);expect(calculate({...base,horizon:60}).sunMinutes).toBeLessThan(calculate(base).sunMinutes);});
});
