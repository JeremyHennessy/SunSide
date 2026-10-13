import { getPosition } from 'suncalc';
import { Temporal } from '@js-temporal/polyfill';
export type Config = {lat:number;lon:number;zone:string;date:string;facing:number;horizon:number};
export type Position = {azimuth:number;altitude:number};
export type Sample = Position & {instant:number;visible:boolean;daylight:boolean};
export const bearing = (n:number) => (n%360+360)%360;
export function position(instant:number,lat:number,lon:number):Position { return getPosition(new Date(instant),lat,lon); }
export function qualifies(p:Position,facing:number,horizon:number) {return p.altitude>Math.max(0,horizon) && Math.abs(bearing(p.azimuth-facing+180)-180)<90;}
export function dayBounds(date:string,zone:string) {
  const d=Temporal.PlainDate.from(date);const start=d.toZonedDateTime({timeZone:zone,plainTime:'00:00'});
  return [Number(start.epochMilliseconds),Number(d.add({days:1}).toZonedDateTime({timeZone:zone,plainTime:'00:00'}).epochMilliseconds)] as const;
}
export function intervals(samples:Sample[],end:number,predicate:(s:Sample)=>boolean) {
 const result:{start:number;end:number}[]=[];let start:number|undefined;
 samples.forEach(s=>{if(predicate(s)&&start===undefined)start=s.instant;if(!predicate(s)&&start!==undefined){result.push({start,end:s.instant});start=undefined;}});
 if(start!==undefined)result.push({start,end});return result;
}
export function calculate(c:Config) {
 const [start,end]=dayBounds(c.date,c.zone);const samples:Sample[]=[];
 for(let instant=start;instant<end;instant+=300000){const p=position(instant+150000,c.lat,c.lon);samples.push({...p,instant,visible:qualifies(p,c.facing,c.horizon),daylight:p.altitude>0});}
 const sun=intervals(samples,end,s=>s.visible),daylight=intervals(samples,end,s=>s.daylight);
 const duration=(is:typeof sun)=>is.reduce((n,i)=>n+(i.end-i.start)/60000,0);
 return {start,end,samples,sun,daylight,sunMinutes:duration(sun),dayMinutes:duration(daylight)};
}
export function clock(instant:number,zone:string){return new Intl.DateTimeFormat('en',{timeZone:zone,hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(instant);}
export function today(zone:string){return Temporal.Now.zonedDateTimeISO(zone).toPlainDate().toString();}
export function duration(minutes:number){return `${Math.floor(minutes/60)}h ${Math.round(minutes%60)}m`;}
export function skyPoint(p:Position){const r=150*(90-Math.max(0,Math.min(90,p.altitude)))/90;const a=p.azimuth*Math.PI/180;return {x:200+r*Math.sin(a),y:200-r*Math.cos(a)};}
