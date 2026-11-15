import { clamp, smooth, mix, sampleShot, FIELD_VIEW } from './timeline.js';

export const CROPS={
  corn:{name:'Corn',color:'#d8b84f',ink:'#6b5718',icon:'corn'},
  soy:{name:'Soybeans',color:'#9cc47c',ink:'#33552c',icon:'leaf'},
  wheat:{name:'Wheat',color:'#e0c486',ink:'#7b6035',icon:'wheat'},
  oats:{name:'Black oat cover',color:'#6f9a63',ink:'#2d4d2c',icon:'wheat'},
};
// Real paddocks on the Río Negro basemap (1200 × 780 map units), traced along the roads, creek and
// fences visible in the imagery; the same geometry as the demo's sample farm. Crops are illustrative.
export const PARCELS=[
  {id:'north',name:'North',points:'299,212 476,206 499,241 516,283 525,314 546,346 567,382 584,429 587,470 296,219',center:[468,262],initial:'soy'},
  {id:'west',name:'West',points:'288,226 282,256 257,374 265,397 325,423 415,418 465,402 479,391',center:[352,372],initial:'soy'},
  {id:'east',name:'East',points:'531,214 545,204 597,200 646,212 707,241 723,293 723,389 711,431 688,496 626,507 609,465 595,433 578,395 550,344 528,312 527,252',center:[632,336],initial:'corn'},
];
// The farm outline drawn before the paddocks.
export const BOUNDARY='M250 376 L276 254 L283 222 L296 205 L476 199 L597 192 L650 205 L713 236 L731 291 L731 390 L718 434 L694 503 L624 515 L583 478 L465 410 L417 426 L322 431 L258 401 Z';
const ramp=(p,a,b)=>smooth((p-a)/(b-a));
const flight=(crop,parcel,p,a,b)=>({crop,parcel,progress:clamp((p-a)/(b-a)),visible:p>a&&p<b});

/** All map states depend on scroll alone, including simulated crop placement. */
export function sampleField(index,progress,reduced=false){
  const p=clamp(progress),s=sampleShot(index,p);
  const build=index<3?0:index>3?1:p;
  // The map arrives untouched from the satellite dive, then frames the farm.
  const frame=index===3?ramp(p,0,.2):index>3?1:0;
  const state={opacity:s.field,angle:reduced?0:mix(0,s.mapAngle,frame),scale:reduced?FIELD_VIEW.mapScale:mix(1,s.mapScale,frame),x:reduced?FIELD_VIEW.mapX:mix(0,s.mapX,frame),y:reduced?FIELD_VIEW.mapY:mix(0,s.mapY,frame),
    boundary:ramp(build,.04,.18),catalog:ramp(build,.3,.4),timeline:ramp(build,.89,1),
    dry:s.dry,wet:s.rain,data:s.data,retreat:s.retreat,build,campaign:'2026/27',campaignIndex:0,
    label:'Field plan',status:'Place crops across the field',flights:[],parcels:[]};
  const drops=[[.43,.59],[.59,.75],[.75,.91]];
  state.parcels=PARCELS.map((parcel,i)=>({id:parcel.id,crop:parcel.initial,draw:ramp(build,.13+i*.055,.32+i*.055),name:ramp(build,.27,.37),assigned:ramp(build,drops[i][1]-.03,drops[i][1]+.05),highlight:build>drops[i][0]&&build<drops[i][1]?Math.sin(clamp((build-drops[i][0])/(drops[i][1]-drops[i][0]))*Math.PI):0}));
  if(index===3)state.flights=drops.map(([a,b],i)=>flight(PARCELS[i].initial,i,p,a,b));
  if(index===3)state.dry*=ramp(p,.94,1);
  if(index===4||index===5){state.status='Compare explicit assumptions';state.label=index===4?'Drier conditions':'Wetter conditions';}
  if(index===6){
    state.campaignIndex=ramp(p,.12,.8);state.label='Explore another sequence';state.status='Same paddocks. Different crop plan.';
    if(p>.17&&p<.62){state.campaign='Winter cover';state.parcels[0].assigned=1-ramp(p,.17,.23);if(p>=.41){state.parcels[0].crop='oats';state.parcels[0].assigned=ramp(p,.40,.46);}}
    if(p>=.62){state.campaign='2027/28';state.parcels[0].crop=p<.82?'oats':'corn';state.parcels[0].assigned=p<.82?1-ramp(p,.62,.7):ramp(p,.81,.87);state.parcels[1].crop='corn';state.parcels[2].crop='soy';}
    state.flights=[flight('oats',0,p,.24,.42),flight('corn',0,p,.64,.83)];
    state.parcels[0].highlight=state.flights.some(f=>f.visible)?.8:0;
  }
  if(index>6){state.campaign='2027/28';state.campaignIndex=1;state.parcels.forEach((parcel,i)=>{parcel.crop=i===2?'soy':'corn';parcel.assigned=1;});state.label=index===7?'Connect the context':'A clearer plan';state.status='Illustrative plan · No live evaluation';}
  if(index<3){state.catalog=0;state.timeline=0;}
  if(reduced&&index===3){state.boundary=state.catalog=state.timeline=1;state.parcels.forEach(parcel=>{parcel.draw=parcel.name=parcel.assigned=1;});state.flights=[];}
  if(reduced&&index===6){state.campaign='2027/28';state.campaignIndex=1;state.parcels.forEach((parcel,i)=>{parcel.crop=i===2?'soy':'corn';parcel.assigned=1;});state.flights=[];}
  state.catalog*=1-state.retreat;state.timeline*=1-state.retreat;
  return state;
}

export function mapPoint(point,view,state){
  const rad=state.angle*Math.PI/180;
  const x=(point[0]/1200-.5)*view.width*state.scale,y=(point[1]/780-.5)*view.height*state.scale;
  return {x:view.left+view.width/2+state.x/100*view.width+x*Math.cos(rad)-y*Math.sin(rad),y:view.top+view.height/2+state.y/100*view.height+x*Math.sin(rad)+y*Math.cos(rad)};
}
export function flightPoint(start,end,progress){const t=smooth(progress);return{x:mix(start.x,end.x,t),y:mix(start.y,end.y,t)-Math.sin(t*Math.PI)*20};}
