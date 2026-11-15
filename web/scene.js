import * as THREE from './vendor/three.module.min.js';
import { sampleShot, altitudeOf, ALTITUDE, mix, smooth } from './timeline.js';

const R=2.2;
// The illustrative farm in Río Negro, Uruguay, and the exact extent of the field basemap.
export const FIELD={lon:-57.7056,lat:-32.7504,bbox:[-57.7226896,-32.7597424,-57.6885104,-32.7410576]};
const PATCHES=[
  // Ever-sharper imagery layered over the globe so the descent never turns blurry.
  {url:'./assets/uy-patch-country.jpg',bbox:[-59.6,-35.2,-52.8,-29.9],lift:.00022,feather:.07,show:[2.6,1.3],tint:.92,mask:'uruguay'},
  {url:'./assets/uy-patch-region.jpg',bbox:[-58.6056,-33.3704,-56.8056,-32.1304],lift:.00042,feather:.22,show:[.3,.12],tint:.95},
  {url:'./assets/uy-patch-local.jpg',bbox:[-57.7956,-32.8104,-57.6156,-32.6904],lift:.00062,feather:.12,show:[.04,.016],tint:1},
  {url:'./assets/uy-field.jpg',bbox:FIELD.bbox,lift:.0008,feather:.025,show:[.0075,.0035],tint:1},
];

function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
const seeded=random(749);
function latLon(lon,lat,r=R){const p=THREE.MathUtils.degToRad(lat),t=THREE.MathUtils.degToRad(lon);return new THREE.Vector3(Math.cos(p)*Math.cos(t)*r,Math.sin(p)*r,-Math.cos(p)*Math.sin(t)*r);}
/** Rotation that brings a place to face the camera with north pointing up. */
function face(lon,lat,roll=0){
  const p=THREE.MathUtils.degToRad(lat),t=THREE.MathUtils.degToRad(lon);
  const up=latLon(lon,lat,1),east=new THREE.Vector3(-Math.sin(t),0,-Math.cos(t)),north=new THREE.Vector3(-Math.sin(p)*Math.cos(t),Math.cos(p),Math.sin(p)*Math.sin(t));
  const q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(east,north,up).transpose());
  return roll?new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),roll).multiply(q):q;
}
function canvasTexture(draw,width,height){const c=document.createElement('canvas');c.width=width;c.height=height;draw(c.getContext('2d'),width,height);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;}

/** Decode images off the main thread and upload them before they are needed. */
function loadTexture(renderer,url){
  const finish=texture=>{texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=renderer.capabilities.getMaxAnisotropy();renderer.initTexture(texture);return texture;};
  if('createImageBitmap' in window){
    return fetch(url).then(r=>{if(!r.ok)throw new Error(url);return r.blob();}).then(blob=>createImageBitmap(blob,{imageOrientation:'flipY'})).then(bitmap=>{const texture=new THREE.Texture(bitmap);texture.flipY=false;texture.needsUpdate=true;return finish(texture);});
  }
  return new THREE.TextureLoader().loadAsync(url).then(finish);
}

/** A curved image tile that follows the sphere exactly over a lon/lat box. */
function patchMesh(patch,order){
  const [w,s,e,n]=patch.bbox,cols=48,rows=48,positions=[],uvs=[],index=[];
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const u=i/cols,v=j/rows;positions.push(...latLon(mix(w,e,u),mix(s,n,v),R+patch.lift).toArray());uvs.push(u,v);}
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+1,c=a+cols+1,d=c+1;index.push(a,b,d,a,d,c);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(index);
  // Feathered edges: each layer melts into the one below instead of showing a seam.
  const f=patch.feather,ratio=(e-w)*Math.cos(THREE.MathUtils.degToRad((s+n)/2))/(n-s);
  const alphaMap=canvasTexture((ctx,width,height)=>{const img=ctx.createImageData(width,height);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const u=x/(width-1),v=y/(height-1);const edge=Math.min(Math.min(u,1-u)*ratio,Math.min(v,1-v));const a=smooth(edge/f)*255;const k=(y*width+x)*4;img.data[k]=img.data[k+1]=img.data[k+2]=a;img.data[k+3]=255;}ctx.putImageData(img,0,0);},128,128);
  alphaMap.colorSpace=THREE.NoColorSpace;
  const material=new THREE.MeshBasicMaterial({color:new THREE.Color(patch.tint,patch.tint,patch.tint),alphaMap,transparent:true,opacity:0,depthWrite:false,toneMapped:false});
  const mesh=new THREE.Mesh(geometry,material);mesh.visible=false;mesh.renderOrder=2+order;mesh.userData.patch=patch;return mesh;
}

function maskPatch(mesh,geometry){
  const [w,s,e,n]=mesh.userData.patch.bbox,width=512,height=Math.round(512*(n-s)/((e-w)*Math.cos(THREE.MathUtils.degToRad((s+n)/2))));
  const texture=canvasTexture((ctx,W,H)=>{ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);ctx.filter='blur(5px)';ctx.fillStyle='#fff';
    for(const polygon of geometry.coordinates){ctx.beginPath();polygon[0].forEach(([lon,lat],i)=>{const x=(lon-w)/(e-w)*W,y=(n-lat)/(n-s)*H;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();ctx.fill();}},width,height);
  texture.colorSpace=THREE.NoColorSpace;mesh.material.alphaMap?.dispose();mesh.material.alphaMap=texture;mesh.material.needsUpdate=true;
}

function planet(scene,renderer,mobile,onBase){
  const group=new THREE.Group();scene.add(group);
  const surfaceMat=new THREE.MeshStandardMaterial({color:'#0d2233',roughness:.92,metalness:0});
  group.add(new THREE.Mesh(new THREE.SphereGeometry(R,mobile?96:160,mobile?64:100),surfaceMat));
  const apply=texture=>{const old=surfaceMat.map;surfaceMat.map=texture;surfaceMat.color.set('#ffffff');surfaceMat.needsUpdate=true;old?.dispose();};
  const patches=PATCHES.map(patchMesh);patches.forEach(mesh=>group.add(mesh));
  // A light texture first for a fast first paint, then the sharp layers in the order they are needed.
  loadTexture(renderer,'./assets/earth-mobile.jpg').then(texture=>{apply(texture);onBase();})
    .then(async()=>{
      if(!mobile)apply(await loadTexture(renderer,'./assets/earth-4k.jpg'));
      for(const mesh of patches){const texture=await loadTexture(renderer,mesh.userData.patch.url);mesh.material.map=texture;mesh.material.needsUpdate=true;mesh.userData.ready=true;}
    }).catch(()=>onBase());
  const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(R*1.04,96,64),new THREE.ShaderMaterial({side:THREE.BackSide,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{intensity:{value:1}},vertexShader:'varying vec3 n;varying vec3 p;void main(){n=normalize(normalMatrix*normal);vec4 v=modelViewMatrix*vec4(position,1.);p=v.xyz;gl_Position=projectionMatrix*v;}',fragmentShader:'varying vec3 n;varying vec3 p;uniform float intensity;void main(){float f=pow(clamp(1.-abs(dot(normalize(n),normalize(-p))),0.,1.),2.6);gl_FragColor=vec4(.32,.62,1.,f*.85*intensity);}'}));group.add(atmosphere);
  const cloudMap=canvasTexture((ctx,w,h)=>{for(let i=0;i<220;i++){const x=seeded()*w,y=h*.12+seeded()*h*.76,r=6+seeded()*22;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,255,255,.35)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.save();ctx.translate(x,y);ctx.scale(2.2,.5);ctx.translate(-x,-y);ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();}},1024,512);
  const clouds=new THREE.Mesh(new THREE.SphereGeometry(R*1.008,96,64),new THREE.MeshStandardMaterial({map:cloudMap,transparent:true,opacity:.22,roughness:1,depthWrite:false}));group.add(clouds);
  const lines={southamerica:[],uruguay:[],rionegro:[]};
  const style={southamerica:['#d9e6ee',.34],uruguay:['#eef6e2',.95],rionegro:['#f3e3ae',.95]};
  fetch('./assets/boundaries-uy.json').then(r=>r.json()).then(data=>{
    for(const [name,geometry]of Object.entries(data)){
      if(!lines[name])continue;
      const mat=new THREE.LineBasicMaterial({color:style[name][0],transparent:true,opacity:0,depthWrite:false});mat.userData.opacity=style[name][1];
      for(const polygon of geometry.coordinates){const points=polygon[0].map(([lon,lat])=>latLon(lon,lat,R+.0011));const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),mat);line.renderOrder=8;group.add(line);}
      lines[name].push(mat);
    }
    // The national imagery takes the shape of Uruguay, so the country stands out from the globe.
    for(const mesh of patches)if(mesh.userData.patch.mask&&data[mesh.userData.patch.mask])maskPatch(mesh,data[mesh.userData.patch.mask]);
  }).catch(()=>{});
  // A location ring that keeps the same size on screen while the camera descends.
  const marker=new THREE.Group();
  marker.add(new THREE.Mesh(new THREE.RingGeometry(.62,1,48),new THREE.MeshBasicMaterial({color:'#f6ecc4',transparent:true,depthWrite:false,toneMapped:false})));
  marker.add(new THREE.Mesh(new THREE.CircleGeometry(.26,32),new THREE.MeshBasicMaterial({color:'#f6ecc4',transparent:true,depthWrite:false,toneMapped:false})));
  marker.position.copy(latLon(FIELD.lon,FIELD.lat,R+.0013));marker.lookAt(latLon(FIELD.lon,FIELD.lat,R*2));
  marker.children.forEach(m=>m.renderOrder=9);group.add(marker);
  const starsGeometry=new THREE.BufferGeometry();const stars=[];for(let i=0;i<(mobile?220:600);i++){const angle=seeded()*Math.PI*2,r=13+seeded()*12;stars.push(Math.cos(angle)*r,(seeded()-.5)*25,-10-seeded()*20);}starsGeometry.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));
  const starField=new THREE.Points(starsGeometry,new THREE.PointsMaterial({color:'#c3d4de',size:.03,transparent:true,opacity:.7,sizeAttenuation:true,depthWrite:false}));scene.add(starField);
  return {group,atmosphere,clouds,lines,marker,patches,starField,initial:face(-52,-14,-.1),target:face(FIELD.lon,FIELD.lat)};
}

export function initOrbit(host){
  if(new URLSearchParams(location.search).get('view')==='static'){host.dataset.renderMode='static';return null;}
  const mobile=innerWidth<=680;let renderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}catch{host.dataset.renderMode='static';return null;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.5:1.75));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  const canvas=renderer.domElement;host.prepend(canvas);canvas.setAttribute('aria-hidden','true');canvas.style.opacity='0';
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.02,60);
  scene.add(new THREE.HemisphereLight('#dbeaff','#4f5a4a',.95));
  const sun=new THREE.DirectionalLight('#fff5df',3.1);sun.position.set(-5,6,10);scene.add(sun);
  const fill=new THREE.DirectionalLight('#8fbde4',.8);fill.position.set(6,-1,4);scene.add(fill);
  let baseReady=false,reveal=0,dirty=true,animation=0,visible=true,lost=false;
  const earth=planet(scene,renderer,mobile,()=>{baseReady=true;dirty=true;schedule();});
  const spaceColor=new THREE.Color('#030b13'),paperColor=new THREE.Color('#f6f7f0'),background=new THREE.Color(),size=new THREE.Vector2(),origin=new THREE.Vector3();
  const vignette=host.querySelector('.stage-vignette'),mapViewport=host.querySelector('.map-viewport');
  const fieldHeight=THREE.MathUtils.degToRad(FIELD.bbox[3]-FIELD.bbox[1])*R,tanHalf=Math.tan(THREE.MathUtils.degToRad(18));
  let paused=document.documentElement.classList.contains('motion-paused'),last=0,ambient=0,frames=0,current={index:0,progress:0},landing=null;
  const lastStyle={};
  // Only touch the DOM when a value changes: avoids style recalculation on every frame.
  const css=(key,apply,value)=>{if(lastStyle[key]!==value){lastStyle[key]=value;apply(value);}};
  // Where the map window sits on screen: the dive lands precisely on its aerial image.
  function measureLanding(){
    const stage=host.getBoundingClientRect(),r=mapViewport?.getBoundingClientRect();
    if(!r||!r.width||!stage.height){landing=null;return;}
    landing={cx:r.left-stage.left+r.width/2,cy:r.top-stage.top+r.height/2,altitude:fieldHeight*stage.height/(2*tanHalf*r.height)};
  }
  function resize(){const r=host.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;measureLanding();dirty=true;schedule();}
  function render(now){
    if(lost)return;
    const s=sampleShot(current.index,current.progress),compact=innerWidth<=680;
    background.copy(spaceColor).lerp(paperColor,s.light);
    css('bg',v=>{host.style.background=v;host.style.setProperty('--stage-background',v);},background.getStyle());
    css('space',v=>host.style.setProperty('--space',v),(1-s.light).toFixed(3));
    css('vig',v=>vignette.style.opacity=v,compact||current.index>=3?'0':(.94*(1-s.light)).toFixed(3));
    // No WebGL work continues behind the 2D field presentation.
    if(current.index>=3){css('hidden',v=>{canvas.style.display=v?'none':'';},true);host.classList.add('is-ready');host.dataset.renderMode='map-2d';dirty=false;last=0;return;}
    css('hidden',v=>{canvas.style.display=v?'none':'';},false);
    const delta=last?Math.min(.05,(now-last)/1000):0;last=now;if(!paused)ambient+=delta;
    if(baseReady&&reveal<1)reveal=paused?1:Math.min(1,reveal+delta/.9);
    const intro=smooth(reveal);
    css('canvas',v=>canvas.style.opacity=v,(intro*(1-s.light)).toFixed(3));
    if(!landing)measureLanding();
    const altitude=altitudeOf(s,landing?.altitude??ALTITUDE.field)*mix(1.08,1,intro);
    camera.near=Math.max(altitude*.25,1e-5);camera.far=altitude+R+40;
    camera.position.set(0,0,R+altitude);camera.lookAt(origin);
    renderer.getSize(size);
    // Frame the globe beside the copy, then glide the target onto the map window.
    let offsetX=compact?0:mix(-.17,-.05,smooth(s.orient))*size.x,offsetY=0;
    if(landing&&s.land>0){offsetX=mix(offsetX,size.x/2-landing.cx,s.land);offsetY=mix(0,size.y/2-landing.cy,s.land);}
    camera.setViewOffset(size.x,size.y,offsetX,offsetY,size.x,size.y);
    earth.group.quaternion.slerpQuaternions(earth.initial,earth.target,smooth(s.orient));
    earth.clouds.rotation.y=ambient*.006;earth.clouds.material.opacity=.22*smooth((altitude-.35)/.9);earth.clouds.visible=altitude>.36;
    earth.atmosphere.material.uniforms.intensity.value=smooth((altitude-.12)/.6);earth.atmosphere.visible=altitude>.12;
    for(const mat of earth.lines.southamerica)mat.opacity=mat.userData.opacity*smooth((s.orient-.25)/.4)*smooth((altitude-.4)/1.2);
    for(const mat of earth.lines.uruguay)mat.opacity=mat.userData.opacity*smooth((s.orient-.4)/.4)*smooth((altitude-.14)/.25);
    for(const mat of earth.lines.rionegro)mat.opacity=mat.userData.opacity*smooth((2.2-altitude)/1.2)*smooth((altitude-.12)/.22);
    const markerFade=smooth((s.orient-.55)/.3)*smooth((altitude-.1)/.25);
    earth.marker.visible=markerFade>.01;earth.marker.scale.setScalar(altitude*.009);
    for(const m of earth.marker.children)m.material.opacity=markerFade*(m.geometry.type==='RingGeometry'?.85:1);
    for(const mesh of earth.patches){const [far,near]=mesh.userData.patch.show,o=mesh.userData.ready?smooth((far-altitude)/(far-near)):0;mesh.material.opacity=o;mesh.visible=o>.003;}
    earth.starField.material.opacity=.7*intro*smooth((altitude-.8)/2);earth.starField.rotation.z=ambient*.002;
    renderer.setClearColor(spaceColor,1);
    renderer.render(scene,camera);host.classList.add('is-ready');host.dataset.renderMode='webgl';host.dataset.frames=String(++frames);host.dataset.altitude=altitude.toPrecision(3);dirty=false;
  }
  function loop(now){
    animation=0;if(document.hidden||!visible||lost)return;
    const active=current.index<3&&(!paused||baseReady&&reveal<1);
    if(dirty||active)render(now);
    if(active||dirty)schedule();else last=0;
  }
  function schedule(){if(!animation&&!document.hidden&&visible&&!lost)animation=requestAnimationFrame(loop);}
  new ResizeObserver(resize).observe(host);
  if(mapViewport)new ResizeObserver(()=>{measureLanding();dirty=true;schedule();}).observe(mapViewport);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){last=0;dirty=true;schedule();}else{cancelAnimationFrame(animation);animation=0;}}).observe(host);
  document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(animation);animation=0;last=0;if(!document.hidden){dirty=true;schedule();}});
  addEventListener('motionchange',event=>{paused=event.detail.paused;last=0;dirty=true;schedule();});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;cancelAnimationFrame(animation);host.classList.remove('is-ready');host.classList.add('no-webgl');host.dataset.renderMode='static';});
  canvas.addEventListener('webglcontextrestored',()=>location.reload());resize();
  return(index,progress)=>{
    current={index,progress};host.classList.toggle('fallback-field-view',index>=3);dirty=true;
    if(index>=3)render(performance.now());else schedule();
  };
}
