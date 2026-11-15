import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const html=await fs.readFile('index.html','utf8'),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length);assert.match(html,/<html lang="en">/);
let checked=0;
for(const [,value]of html.matchAll(/\b(?:href|src|poster)="([^"]+)"/g)){
  if(value.startsWith('#'))assert(ids.includes(value.slice(1)),`Missing anchor ${value}`);
  if(value.startsWith('./'))await fs.access(value.split('#')[0]);checked++;
}
for(const file of (await fs.readdir('.')).filter(file=>file.endsWith('.js')||file.endsWith('.mjs'))){
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);checked++;
  const content=await fs.readFile(file,'utf8');for(const [,value]of content.matchAll(/from ['"](\.[^'"]+)['"]/g))await fs.access(path.resolve(value));
}
for(const file of ['map.css','assets/uy-field.jpg','assets/uy-field-metadata.json','assets/boundaries-uy.json','assets/earth-4k.jpg','assets/uy-patch-country.jpg','assets/uy-patch-region.jpg','assets/uy-patch-local.jpg','assets/juxtacrop-pitch.mp4','assets/juxtacrop-pitch-poster.jpg','assets/juxtacrop-pitch-en.vtt','vendor/three.module.min.js','vendor/three.core.min.js','.nojekyll'])await fs.access(file);
// The interactive prototype ships inside the static site at /demo/.
const demo=await fs.readFile('demo/index.html','utf8');
for(const [,value]of demo.matchAll(/\b(?:href|src)="([^"]+)"/g)){
  if(/^(https?:|#|data:)/.test(value))continue;
  assert(!value.startsWith('/'),`Demo uses an absolute path, which breaks under a sub-path: ${value}`);
  await fs.access(path.join('demo',value));checked++;
}
for(const file of ['data.js','sources.js','engine.js','app.js','tour.js']){
  const result=spawnSync(process.execPath,['--check','demo/js/'+file],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);checked++;
  // No backend: every data source must be reachable straight from the browser.
  assert.doesNotMatch(await fs.readFile('demo/js/'+file,'utf8'),/['"`]\/api\//,`demo/js/${file} calls a local /api endpoint`);
}
console.log(`PASS static site: ${checked} references and syntax checks, website + demo assets present, no backend calls.`);
