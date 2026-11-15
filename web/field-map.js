import { CROPS, PARCELS, BOUNDARY, sampleField, mapPoint, flightPoint } from './field-model.js';

export const cropIcon=(name)=>`<svg viewBox="0 0 28 28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${name==='leaf'?'<path d="M14 25V10M14 17C2 18 2 7 5 6c7 0 10 5 9 11Zm0-4C25 14 26 5 23 3c-6 0-9 4-9 10Z"/>':name==='corn'?'<path d="M14 25V5M10 7c0-7 8-7 8 0v11h-8V7ZM10 10h8M10 14h8M14 2v17M14 24C4 23 3 16 4 12c5 1 9 5 10 12Zm0 0c9-1 11-8 10-12-5 1-8 5-10 12Z"/>':'<path d="M14 26V3m0 8C5 10 5 5 6 3c5 1 8 4 8 8Zm0 0c8-1 8-6 7-8-5 1-7 4-7 8Zm0 8c-8-1-9-6-8-8 5 1 8 4 8 8Zm0 0c8-1 8-6 7-8-5 1-7 4-7 8Z"/>'}</svg>`;

// Furthest vertex from each label point: the radius a crop "paints" to when it lands.
const reach=PARCELS.map(p=>Math.max(...p.points.split(' ').map(v=>{const [x,y]=v.split(',').map(Number);return Math.hypot(x-p.center[0],y-p.center[1]);}))+8);

export function fieldMapMarkup(){
  const defs=`<defs><clipPath id="field-clip">${PARCELS.map(p=>`<polygon points="${p.points}"/>`).join('')}</clipPath>${PARCELS.map((p,i)=>`<clipPath id="reveal-${i}"><circle class="reveal-circle" cx="${p.center[0]}" cy="${p.center[1]}" r="0"/></clipPath>`).join('')}<pattern id="crop-rows" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-32)"><path d="M0 4.5H9" stroke="#fffbea" stroke-width="1.3" opacity=".55"/></pattern><pattern id="field-hatch" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M0 14 14 0" stroke="white" stroke-width="2" opacity=".3"/></pattern><radialGradient id="wet-layer"><stop stop-color="#4f97ba" stop-opacity=".85"/><stop offset="1" stop-color="#8dc8d5" stop-opacity="0"/></radialGradient><radialGradient id="dry-layer"><stop stop-color="#e3b462" stop-opacity=".85"/><stop offset="1" stop-color="#e2b669" stop-opacity="0"/></radialGradient></defs>`;
  const parcels=`<g class="parcel-shapes">${PARCELS.map((p,i)=>`<g class="parcel" data-parcel="${i}"><polygon class="parcel-fill" points="${p.points}" clip-path="url(#reveal-${i})"/><polygon class="parcel-rows" points="${p.points}" fill="url(#crop-rows)" clip-path="url(#reveal-${i})"/><polygon class="parcel-edge" data-edge="${i}" points="${p.points}" pathLength="1"/><circle class="parcel-ripple" cx="${p.center[0]}" cy="${p.center[1]}" r="0"/></g>`).join('')}</g>`;
  const layers=`<g clip-path="url(#field-clip)"><g class="map-dry-layer"><ellipse cx="430" cy="300" rx="190" ry="120" fill="url(#dry-layer)"/><ellipse cx="660" cy="300" rx="120" ry="130" fill="url(#dry-layer)"/></g><g class="map-wet-layer"><ellipse cx="600" cy="460" rx="140" ry="110" fill="url(#wet-layer)"/><ellipse cx="290" cy="380" rx="110" ry="90" fill="url(#wet-layer)"/></g><g class="map-data-layer"><path d="M240 270H740M240 350H740M240 430H740M330 190V520M490 190V520M650 190V520" stroke="#ddf1e8" stroke-width="1.6" stroke-dasharray="6 7"/><path d="M0 0H1200V780H0Z" fill="url(#field-hatch)" opacity=".5"/></g></g>`;
  const labels=PARCELS.map((p,i)=>`<g class="map-parcel-label" data-label="${i}" transform="translate(${p.center.join(' ')})"><rect x="-76" y="-31" width="152" height="62" rx="12"/><text class="parcel-name" text-anchor="middle" y="-5">${p.name}</text><text class="parcel-crop" text-anchor="middle" y="17"></text></g>`).join('');
  return `<div class="field-map-stage"><div class="map-workspace"><div class="map-toolbar"><span class="map-app-mark"><img src="./assets/symbol.png" alt="">juxtacrop</span><span class="map-toolbar-title">Alex’s field · Río Negro, Uruguay</span><span class="map-preview-tag">Scroll preview</span></div><div class="map-viewport"><div class="map-camera"><img class="map-aerial" src="./assets/uy-field.jpg" width="2400" height="1560" alt="" decoding="async"><svg class="parcel-map" viewBox="0 0 1200 780" preserveAspectRatio="none">${defs}${parcels}${layers}<path class="field-perimeter" d="${BOUNDARY}" pathLength="1"/>${labels}</svg></div><div class="map-catalog"><span class="catalog-title">Crops</span>${Object.entries(CROPS).map(([key,crop])=>`<div class="catalog-crop" data-crop="${key}" style="--crop-ink:${crop.ink}">${cropIcon(crop.icon)}<span>${crop.name}</span><span class="catalog-grip" aria-hidden="true">⠿</span></div>`).join('')}</div><div class="map-layer-legend"><span class="legend-swatch"></span><span class="legend-text">Crop plan</span><small>Illustrative layer</small></div><span class="map-north">N <span aria-hidden="true">↑</span></span><div class="map-attribution">Esri World Imagery · Maxar<br>Illustrative boundaries and crops</div></div><div class="map-campaigns"><div class="campaign-heading"><span>Crop seasons</span><strong class="campaign-label">2026/27</strong></div><div class="campaign-track"><div class="campaign-progress"></div><span>2026/27</span><span>Winter cover</span><span>2027/28</span></div><div class="map-plan-note">Same field. Different possibilities.</div></div><div class="crop-flight"></div><div class="map-state-caption"><span class="map-state-title">Field plan</span><span class="map-state-detail">Place crops across the field</span></div></div></div>`;
}

export function initFieldMap(stage){
  const root=stage.querySelector('.field-map-stage'),workspace=root.querySelector('.map-workspace'),viewport=root.querySelector('.map-viewport'),camera=root.querySelector('.map-camera');
  const perimeter=root.querySelector('.field-perimeter'),catalog=root.querySelector('.map-catalog'),campaigns=root.querySelector('.map-campaigns'),legend=root.querySelector('.map-layer-legend'),flight=root.querySelector('.crop-flight');
  const cover=root.querySelector('[data-crop="oats"]'),dryLayer=root.querySelector('.map-dry-layer'),wetLayer=root.querySelector('.map-wet-layer'),dataLayer=root.querySelector('.map-data-layer'),campaignLabel=root.querySelector('.campaign-label'),campaignProgress=root.querySelector('.campaign-progress'),stateTitle=root.querySelector('.map-state-title'),stateDetail=root.querySelector('.map-state-detail'),legendText=root.querySelector('.legend-text');
  workspace.insertBefore(catalog,campaigns);
  // Mirror-pad the aerial image so map pans and rotations never reveal an empty edge.
  const aerial=root.querySelector('.map-aerial');
  const padAerial=()=>{const w=900,h=Math.round(w*aerial.naturalHeight/aerial.naturalWidth)||585,c=document.createElement('canvas');c.width=w*2;c.height=h*2;c.className='map-aerial-pad';c.setAttribute('aria-hidden','true');const ctx=c.getContext('2d');
    for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){ctx.save();ctx.translate(w/2+i*w+(i?w:0),h/2+j*h+(j?h:0));ctx.scale(i?-1:1,j?-1:1);ctx.drawImage(aerial,0,0,w,h);ctx.restore();}
    camera.insertBefore(c,aerial);};
  if(aerial.complete&&aerial.naturalWidth)padAerial();else aerial.addEventListener('load',padAerial,{once:true});
  const fills=[...root.querySelectorAll('.parcel-fill')],rows=[...root.querySelectorAll('.parcel-rows')],edges=[...root.querySelectorAll('.parcel-edge')],labels=[...root.querySelectorAll('.map-parcel-label')],reveals=[...root.querySelectorAll('.reveal-circle')],ripples=[...root.querySelectorAll('.parcel-ripple')];
  let current={index:0,progress:0,reduced:false},view=null,sourcePositions={};
  const last=new Map();
  // Write an attribute or style only when its value changes.
  const set=(el,key,value,attr=false)=>{const id=el;let m=last.get(id);if(!m){m={};last.set(id,m);}if(m[key]===value)return;m[key]=value;if(attr)el.setAttribute(key,value);else el.style[key]=value;};
  function measure(){const w=workspace.getBoundingClientRect(),v=viewport.getBoundingClientRect();view={left:v.left-w.left,top:v.top-w.top,width:v.width,height:v.height};root.querySelectorAll('.catalog-crop').forEach(el=>{const r=el.getBoundingClientRect();sourcePositions[el.dataset.crop]={x:r.left-w.left+r.width/2,y:r.top-w.top+r.height/2};});}
  function draw(index,progress,reduced=false){
    current={index,progress,reduced};if(!view)measure();const state=sampleField(index,progress,reduced);
    set(root,'opacity',String(+state.opacity.toFixed(3)));set(root,'visibility',state.opacity>.002?'visible':'hidden');
    if(state.opacity<=.002&&index>=3)return;
    set(workspace,'transform',index===7&&state.opacity<1?`translateY(${(-(1-state.opacity)*48).toFixed(1)}px)`:'');
    stage.classList.toggle('has-field-map',state.opacity>.1);stage.dataset.mapPhase=index===3?'build':index===6?'rotation':index===4?'dry':index===5?'wet':'overview';stage.dataset.mapAssignments=state.parcels.filter(p=>p.assigned>.95).length;stage.dataset.mapCampaign=state.campaign;
    set(camera,'transform',`translate(${state.x.toFixed(3)}%,${state.y.toFixed(3)}%) rotate(${state.angle.toFixed(3)}deg) scale(${state.scale.toFixed(4)})`);
    set(perimeter,'strokeDashoffset',String(+(1-state.boundary).toFixed(4)));set(perimeter,'opacity',String(+(state.boundary*(1-.55*state.parcels[2].draw)).toFixed(3)));
    set(catalog,'opacity',String(+state.catalog.toFixed(3)));set(catalog,'visibility',state.catalog>.01?'visible':'hidden');set(catalog,'transform',`translateX(${((1-state.catalog)*-10).toFixed(2)}px)`);
    if(cover.classList.contains('crop-available')!==(index>=6)){cover.classList.toggle('crop-available',index>=6);measure();}
    set(campaigns,'opacity',String(+state.timeline.toFixed(3)));set(campaigns,'visibility',state.timeline>.01?'visible':'hidden');
    set(campaigns,'maxHeight',`${(state.timeline*120).toFixed(1)}px`);set(campaigns,'overflow','hidden');set(campaigns,'paddingBlock',`${(state.timeline*(innerWidth<=680?9:13)).toFixed(1)}px`);set(campaigns,'borderTopWidth',`${state.timeline.toFixed(2)}px`);
    campaignLabel.textContent=state.campaign;set(campaignProgress,'width',`${(state.campaignIndex*100).toFixed(2)}%`);
    const factor=1200/Math.max(1,view.width)/state.scale*(innerWidth<=680?.65:.75);
    state.parcels.forEach((p,i)=>{
      const crop=CROPS[p.crop];
      // The crop colour spreads outward from where the card lands, with sown rows on top.
      set(fills[i],'fill',crop.color);set(fills[i],'opacity',String(+(.5+p.highlight*.15).toFixed(3)));
      set(reveals[i],'r',(p.assigned*reach[i]).toFixed(1),true);set(rows[i],'opacity',String(+(p.assigned*.7).toFixed(3)));
      set(ripples[i],'r',(14+p.assigned*reach[i]*.55).toFixed(1),true);set(ripples[i],'opacity',String(+(Math.sin(p.assigned*Math.PI)*.85).toFixed(3)));
      set(edges[i],'strokeDashoffset',String(+(1-p.draw).toFixed(4)));set(edges[i],'strokeWidth',String(+(2+p.highlight*2.5).toFixed(2)));
      const label=labels[i];set(label,'opacity',String(+p.name.toFixed(3)));
      set(label,'transform',`translate(${PARCELS[i].center[0]} ${(PARCELS[i].center[1]+(1-p.name)*12).toFixed(1)}) rotate(${(-state.angle).toFixed(3)}) scale(${factor.toFixed(4)})`,true);
      const cropText=label.querySelector('.parcel-crop');cropText.textContent=p.assigned>.5?crop.name:'Unassigned';set(cropText,'fill',p.assigned>.5?crop.ink:'#798479');
      label.dataset.crop=p.assigned>.5?p.crop:'unassigned';label.dataset.screenX=mapPoint(PARCELS[i].center,view,state).x.toFixed(1);
    });
    set(dryLayer,'opacity',String(+state.dry.toFixed(3)));set(wetLayer,'opacity',String(+state.wet.toFixed(3)));set(dataLayer,'opacity',String(+state.data.toFixed(3)));
    const layer=index===4?'Drier assumptions':index===5?'Wetter assumptions':index===7?'Environmental context':'Crop plan';legendText.textContent=layer;legend.dataset.layer=index===4?'dry':index===5?'wet':'crops';set(legend,'opacity',String(+state.boundary.toFixed(3)));
    stateTitle.textContent=state.label;stateDetail.textContent=state.status;
    const active=state.flights.find(f=>f.visible);
    if(active&&!reduced){
      const crop=CROPS[active.crop],start=sourcePositions[active.crop]||sourcePositions.corn,end=mapPoint(PARCELS[active.parcel].center,view,state),point=flightPoint(start,end,active.progress),t=active.progress;
      if(flight.dataset.crop!==active.crop){flight.innerHTML=`${cropIcon(crop.icon)}<span>${crop.name}</span>`;flight.dataset.crop=active.crop;flight.style.color=crop.ink;}
      // Lift, carry and set down: the card grows while carried and settles as it lands.
      const lift=Math.sin(Math.min(1,t*1.15)*Math.PI);
      set(flight,'opacity',String(+Math.min(1,t*8,(1-t)*7).toFixed(3)));
      set(flight,'transform',`translate(${(point.x-46).toFixed(1)}px,${(point.y-18).toFixed(1)}px) rotate(${(lift*-4).toFixed(2)}deg) scale(${(1+lift*.08-Math.max(0,t-.85)*.9).toFixed(3)})`);
      set(flight,'boxShadow',`0 ${(6+lift*14).toFixed(1)}px ${(16+lift*22).toFixed(1)}px #16342138`);
      stage.dataset.mapFlight=active.crop;
    }else{set(flight,'opacity','0');stage.dataset.mapFlight='none';}
  }
  new ResizeObserver(()=>{measure();draw(current.index,current.progress,current.reduced);}).observe(viewport);
  return draw;
}
