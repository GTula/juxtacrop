export const clamp=(x,min=0,max=1)=>Math.min(max,Math.max(min,x));
export const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export const smoother=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10);};
export const mix=(a,b,t)=>a+(b-a)*t;

/** Monotone cubic (Fritsch–Carlson) interpolation: smooth velocity, never overshoots. */
function monotone(points){
  const n=points.length,xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),d=[],m=new Array(n);
  for(let i=0;i<n-1;i++)d.push((ys[i+1]-ys[i])/(xs[i+1]-xs[i]));
  m[0]=d[0];m[n-1]=d[n-2];
  for(let i=1;i<n-1;i++)m[i]=d[i-1]*d[i]<=0?0:(d[i-1]+d[i])/2;
  for(let i=0;i<n-1;i++){
    if(d[i]===0){m[i]=m[i+1]=0;continue;}
    const a=m[i]/d[i],b=m[i+1]/d[i],h=a*a+b*b;
    if(h>9){const t=3/Math.sqrt(h);m[i]=t*a*d[i];m[i+1]=t*b*d[i];}
  }
  return x=>{
    if(x<=xs[0])return ys[0];if(x>=xs[n-1])return ys[n-1];
    let i=0;while(x>xs[i+1])i++;
    const h=xs[i+1]-xs[i],t=(x-xs[i])/h,t2=t*t,t3=t2*t;
    return (2*t3-3*t2+1)*ys[i]+(t3-2*t2+t)*h*m[i]+(-2*t3+3*t2)*ys[i+1]+(t3-t2)*h*m[i+1];
  };
}

/** Camera altitude above the globe (scene units, Earth radius 2.2) for each orbit chapter. */
export const ALTITUDE={orbit:5.9,country:2.6,region:.62,field:.0019};
// One continuous descent over the orbit chapters, in log space so it feels like a steady fall.
// u = chapter index + progress. The curve flattens at u = 2, where the final dive takes over.
const altitudePath=monotone([[0,Math.log(ALTITUDE.orbit)],[1,Math.log(ALTITUDE.country)],[2,Math.log(ALTITUDE.region)],[3,Math.log(ALTITUDE.region)]]);
const orientPath=monotone([[0,0],[.12,.015],[1.05,.95],[2,1],[3,1]]);
/** Altitude for a sample: the orbit path, then the dive toward the field. */
export const altitudeOf=(state,fieldAltitude=ALTITUDE.field)=>state.index<2||!state.dive?Math.exp(altitudePath(Math.min(2,state.index+state.progress))):Math.exp(mix(Math.log(ALTITUDE.region),Math.log(fieldAltitude),state.dive));

const GROUND=[0,0,8.1];
const IDENTITY={mapAngle:0,mapScale:1,mapX:0,mapY:0};
// The field composition: the three parcels sit centred and enlarged inside the map window.
export const FIELD_VIEW={mapAngle:-2,mapScale:1.3,mapX:11.9,mapY:6.2};
const defaults={earth:0,earthScale:1,orient:1,region:0,field:0,dry:0,rain:0,rotation:0,data:0,light:1,veil:0,dive:0,land:0,retreat:0,...IDENTITY};
const pose=(id,label,camera,target,values)=>({id,label,camera,target,...defaults,...values});
export const SHOTS=[
  pose('orbit','Earth observation',GROUND,[0,0,0],{earth:1,orient:0,light:0}),
  pose('country','Uruguay · South America',GROUND,[0,0,0],{earth:1,orient:.95,light:0}),
  pose('region','Río Negro, Uruguay · 32.75° S, 57.71° W',GROUND,[0,0,0],{earth:1,light:0}),
  pose('field','Alex’s illustrative field',GROUND,[0,0,0],{field:1,...FIELD_VIEW}),
  pose('dry','Drier assumptions · Illustrative layer',GROUND,[0,0,0],{field:1,dry:1,mapAngle:2.5,mapScale:1.37,mapX:12.6,mapY:6.9}),
  pose('wet','Wetter assumptions · Illustrative layer',GROUND,[0,0,0],{field:1,rain:1,mapAngle:-2.6,mapScale:1.34,mapX:11.4,mapY:5.6}),
  pose('rotation','The same field. Another sequence.',GROUND,[0,0,0],{field:1,rotation:1,mapAngle:1.5,mapScale:1.3,mapX:11.9,mapY:6.2}),
  pose('data','Earth observations + local knowledge',GROUND,[0,0,0],{field:1,rotation:1,data:1,mapAngle:0,mapScale:1.26,mapX:11.6,mapY:6}),
  pose('film','The pitch film',GROUND,[0,0,0],{field:0,rotation:1,retreat:1,mapScale:1.2,mapX:11,mapY:5.6}),
  pose('closing','A clearer view of the next season',GROUND,[0,0,0],{field:0,rotation:1,retreat:1,mapScale:1.2,mapX:11,mapY:5.6}),
  pose('team','The people behind juxtacrop',GROUND,[0,0,0],{field:0,rotation:1,retreat:1,mapScale:1.2,mapX:11,mapY:5.6}),
];

/** A pure, reversible mapping: time is never used to place the camera. */
export function sampleShot(index,progress){
  index=clamp(index,0,SHOTS.length-1);
  const a=SHOTS[index],b=SHOTS[Math.min(index+1,SHOTS.length-1)];
  const raw=clamp(progress);
  // Earth chapters move continuously with the scroll; reading scenes hold before handing off.
  const t=index<3?raw:smooth(clamp((raw-.38)/.62));
  const output={id:a.id,label:a.label,index,progress:raw};
  for(const key of Object.keys(defaults))output[key]=mix(a[key],b[key],t);
  output.camera=a.camera.map((value,i)=>mix(value,b.camera[i],t));
  output.target=a.target.map((value,i)=>mix(value,b.target[i],t));
  if(index<3){
    const u=index+raw;
    output.orient=clamp(orientPath(u));
    output.earthScale=ALTITUDE.orbit/Math.exp(altitudePath(Math.min(2,u)));
    Object.assign(output,IDENTITY);
  }
  if(index===2){
    // Dive from the region straight into the field, landing exactly inside the map window.
    output.dive=smoother(raw/.62);
    output.land=smooth((raw-.04)/.56);
    output.earthScale=ALTITUDE.orbit/altitudeOf(output);
    output.earth=1-smooth((raw-.86)/.12);
    output.veil=0;
    output.region=0;
    output.field=smooth((raw-.56)/.14);
    output.light=smooth((raw-.7)/.13);
  }
  // Leave the stage cleanly before the film: no translucent map behind the closing sections.
  if(index===7)output.field=1-smooth((raw-.35)/.2);
  return output;
}

export function locateShot(scroll,anchors){
  let index=0;
  for(let i=0;i<anchors.length;i++)if(scroll>=anchors[i])index=i;
  const next=anchors[index+1];
  return {index,progress:next===undefined?0:clamp((scroll-anchors[index])/Math.max(1,next-anchors[index]))};
}
