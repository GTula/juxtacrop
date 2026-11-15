import { clamp, smooth, mix, sampleShot, FIELD_VIEW } from './timeline.js';

export const CROPS={
  corn:{name:'Corn',color:'#d8b84f',ink:'#6b5718',icon:'corn'},
  soy:{name:'Soybeans',color:'#9cc47c',ink:'#33552c',icon:'leaf'},
  wheat:{name:'Wheat',color:'#e0c486',ink:'#7b6035',icon:'wheat'},
  oats:{name:'Black oat cover',color:'#6f9a63',ink:'#2d4d2c',icon:'wheat'},
};
// Paddocks traced on the Río Negro basemap (1200 × 780 map units). Boundaries are illustrative.
export const PARCELS=[
  {id:'north',name:'North',points:'301,249 472,238 514,284 524,318 549,361 580,416 590,439 587,463',center:[452,305],initial:'soy'},
  {id:'west',name:'West',points:'295,256 282,260 256,376 264,398 324,423 368,421 415,418 467,402 470,384',center:[338,362],initial:'soy'},
  {id:'east',name:'East',points:'530,214 544,205 598,200 648,214 706,242 724,295 724,353 722,408 687,495 676,501 625,507 600,447 590,423 549,350 527,316 527,248',center:[640,352],initial:'corn'},
];
// The farm outline drawn before the paddocks.
export const BOUNDARY='M244 377 L271 256 L290 245 L544 193 L603 189 L656 205 L716 236 L736 292 L736 354 L733 412 L695 504 L684 510 L631 518 L313 427 L252 400 Z';
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
