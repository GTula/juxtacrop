import { initCommon } from './common.js';
import { locateShot, sampleShot, SHOTS } from './timeline.js';
import { initFieldMap } from './field-map.js';
initCommon();
const demoLink=document.createElement('a');
demoLink.className='button small';
demoLink.href='/demo/';
demoLink.textContent='Open the demo';
document.querySelector('.header-actions')?.prepend(demoLink);
const sections=[...document.querySelectorAll('[data-chapter]')];
const stage=document.querySelector('#world-stage');
const paintMap=initFieldMap(stage);
const locationName=document.querySelector('.location-name');
const navLinks=[...document.querySelectorAll('.chapter-nav a')];
const chapterCopy=[...document.querySelectorAll('.chapter-inner')];
let anchors=[],renderScene=null,frame=0,lastTime=0,smoothScroll=scrollY,lastIndex=-1;
const motionReduced=()=>document.documentElement.classList.contains('motion-paused');
const measure=()=>{anchors=sections.map(section=>section.getBoundingClientRect().top+scrollY-(innerWidth<=680?100:Math.max(105,innerHeight*.2)));anchors[0]=0;};
function update(position){
  const location=locateShot(position,anchors);
  const shot=SHOTS[location.index];
  document.body.classList.toggle('is-space',sampleShot(location.index,location.progress).light<.55);
  paintMap(location.index,location.progress,motionReduced());
  if(renderScene)renderScene(location.index,location.progress);
  else stage.classList.toggle('fallback-field-view',location.index>=3);
  if(location.index===lastIndex)return;
  // Chapter-level changes only happen at boundaries.
  lastIndex=location.index;
  document.body.dataset.chapter=shot.id;
  document.body.classList.toggle('is-reading',location.index>=8);
  stage.dataset.shot=shot.id;
  if(location.index>=3){stage.style.background='#f6f7f0';stage.style.setProperty('--stage-background','#f6f7f0');}
  locationName.textContent=shot.label;
  navLinks.forEach((link,i)=>{if(i===location.index)link.setAttribute('aria-current','step');else link.removeAttribute('aria-current');});
  chapterCopy.forEach((copy,i)=>{copy.style.setProperty('--chapter-focus',i===location.index?'1':'.78');});
}
// The scene follows a damped copy of the scroll position: wheel steps become one continuous glide.
function tick(now){
  frame=0;
  const target=scrollY,dt=lastTime?Math.min(.05,(now-lastTime)/1000):1/60;lastTime=now;
  const gap=target-smoothScroll;
  if(motionReduced()||Math.abs(gap)>innerHeight*1.6)smoothScroll=target;
  else smoothScroll+=gap*(1-Math.exp(-dt*8.5));
  if(Math.abs(target-smoothScroll)<.35)smoothScroll=target;
  update(smoothScroll);
  if(smoothScroll!==target)frame=requestAnimationFrame(tick);else lastTime=0;
}
const requestUpdate=()=>{if(!frame)frame=requestAnimationFrame(tick);};
const remeasure=()=>{measure();lastIndex=-1;requestUpdate();};
measure();smoothScroll=scrollY;update(smoothScroll);
addEventListener('scroll',requestUpdate,{passive:true});
addEventListener('resize',remeasure);
addEventListener('hashchange',requestUpdate);
new ResizeObserver(remeasure).observe(document.querySelector('.journey-content'));
addEventListener('motionchange',requestUpdate);
document.fonts.ready.then(remeasure);
import('./scene.js').then(({initOrbit})=>{
  renderScene=initOrbit(stage);
  stage.classList.toggle('no-webgl',!renderScene);update(smoothScroll);
}).catch(error=>{stage.classList.add('no-webgl');console.warn('Using the accessible static journey.',error);});
