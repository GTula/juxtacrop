import assert from 'node:assert/strict';
import { sampleField, PARCELS, mapPoint, flightPoint } from '../field-model.js';
let count=0;
for(let index=0;index<11;index++)for(let step=0;step<=100;step++){
  const p=step/100,state=sampleField(index,p);
  assert.deepEqual(state,sampleField(index,p),'Returning to a scroll position must restore the same assignments');
  assert(Math.abs(state.angle)<=6&&Number.isFinite(state.scale));
  assert(state.parcels.length===3);
  for(const parcel of state.parcels)for(const key of ['draw','name','assigned','highlight'])assert(parcel[key]>=0&&parcel[key]<=1,`${index}:${p} ${key}`);
  for(const f of state.flights)if(f.visible)assert(f.progress>0&&f.progress<1&&f.parcel>=0&&f.parcel<3);
  count++;
}
assert.equal(sampleField(3,0).parcels.filter(p=>p.assigned>.95).length,0);
assert.equal(sampleField(3,1).parcels.filter(p=>p.assigned>.95).length,3);
assert(sampleField(3,.5).flights.some(f=>f.visible&&f.crop==='soy'&&f.parcel===0));
assert(sampleField(3,.66).flights.some(f=>f.visible&&f.crop==='soy'&&f.parcel===1));
assert(sampleField(3,.82).flights.some(f=>f.visible&&f.crop==='corn'&&f.parcel===2));
assert.deepEqual([sampleField(2,1).scale,sampleField(2,1).x,sampleField(2,1).angle],[1,0,0],'The map must match the satellite dive when it appears');
assert.equal(sampleField(6,.5).parcels[0].crop,'oats');
assert.deepEqual(sampleField(6,1).parcels.map(p=>p.crop),['corn','corn','soy']);
assert.deepEqual(sampleField(7,0).parcels.map(p=>p.crop),['corn','corn','soy']);
assert.equal(sampleField(7,0).campaign,'2027/28');
assert.equal(sampleField(3,.5,true).flights.length,0);
assert(sampleField(3,.5,true).parcels.every(p=>p.assigned===1));
const a={x:20,y:40},b={x:200,y:100};assert.deepEqual(flightPoint(a,b,0),a);assert(Math.abs(flightPoint(a,b,1).y-b.y)<1e-8);
const center=mapPoint([600,390],{left:0,top:0,width:1200,height:780},{angle:6,scale:1,x:0,y:0});assert.deepEqual(center,{x:600,y:390});
console.log(`PASS Field map: ${count} reversible states, staged assignments, black oat cover, next campaign, readable labels and reduced-motion mode.`);
