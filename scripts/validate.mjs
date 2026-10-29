import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'data/cases.json'),'utf8'));
assert.equal(data.cases.length,26);
assert.equal(new Set(data.cases.map(c=>c.id)).size,26);
let images=0,predictions=0,internal=0;
for(const c of data.cases){
  assert.ok(Number.isFinite(c.age));
  assert.equal(c.views.axial.length,7);
  for(const file of Object.values(c.views).flat()){
    const absolute=path.resolve(root,file);
    assert.ok(absolute.startsWith(root+path.sep));
    const b=fs.readFileSync(absolute);
    assert.equal(b.subarray(1,4).toString(),'PNG');images++;
  }
  for(const [name,value] of Object.entries(c.preds)){
    if(Array.isArray(value)){assert.equal(value.length,5);internal+=value.length;}
    else{assert.ok(Number.isFinite(value),name);predictions++;}
  }
}
assert.equal(images,234);assert.equal(predictions,174);assert.equal(internal,130);
const csv=fs.readFileSync(path.join(root,'data/all_predictions.csv'),'utf8').trim();
assert.equal(csv.split(/\r?\n/).length-1,799);
const glb=fs.readFileSync(path.join(root,'assets/brain.glb'));
assert.equal(glb.subarray(0,4).toString(),'glTF');
assert.equal(glb.readUInt32LE(4),2);
assert.equal(glb.readUInt32LE(8),glb.length);
for(const file of ['index.html','app.js','styles.css','vendor/model-viewer.min.js','vendor/geist-400.woff2'])assert.ok(fs.statSync(path.join(root,file)).size>0);
console.log(`Validated ${data.cases.length} cases, ${predictions} predictions, ${internal} internal outputs, ${images} MRI images, and GLB ${glb.length} bytes.`);
