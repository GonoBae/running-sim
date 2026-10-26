import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import * as THREE from 'three';

const root=fileURLToPath(new URL('..',import.meta.url));
// Load the real TS modules through the project's Vite, without a browser or UI.
globalThis.location={hostname:'unit-test.invalid'};
const server=await createServer({root,server:{middlewareMode:true},appType:'custom'});
const cases=[];
try {
  const {createRunningPose}=await server.ssrLoadModule('/src/running-pose.ts');
  const {createPoseSnapshotStore,validatePoseSnapshot}=await server.ssrLoadModule('/src/pose-snapshot.ts');
  const {defaults}=await server.ssrLoadModule('/src/settings.ts');
  const hash='a'.repeat(64), otherHash='b'.repeat(64);
  const A={upperarm_l:20,lowerarm_l:90,thigh_l:35,calf_l:60,upperarm_r:-10,lowerarm_r:65,thigh_r:-5,calf_r:25};
  const B={upperarm_l:-20,lowerarm_l:55,thigh_l:5,calf_l:10,upperarm_r:30,lowerarm_r:110,thigh_r:50,calf_r:100};
  function fixture(settings=defaults()) {
    const model=new THREE.Group(),bones=[];
    // Deliberately asymmetric rest directions and a rotated parent exercise world/local conversion.
    const parent=new THREE.Bone();parent.name='pelvis';parent.rotation.y=.17;model.add(parent);bones.push(parent);
    for (const [side,sign] of [['l',1],['r',-1]]) {
      for (const names of [['upperarm','lowerarm','hand'],['thigh','calf','foot']]) {
        let previous=parent;
        for (let i=0;i<names.length;i++) {
          const b=new THREE.Bone();b.name=`${names[i]}_${side}`;
          b.position.set(i===0?sign*.2:sign*.04,i===0?(names[0]==='upperarm'?1.3:.7):-.4,i*.02);
          previous.add(b);bones.push(b);previous=b;
        }
      }
    }
    model.updateMatrixWorld(true);
    const pose=createRunningPose(model,bones,settings);assert(pose);pose.apply();
    const context={state:'ready',modelHash:hash,loadId:1,settingsRevision:settings.revision,latestSettingsRevision:settings.revision,pose};
    const store=createPoseSnapshotStore(()=>({...context}));
    return {model,bones,pose,context,store};
  }
  function state(f) {
    const nodes=[];f.model.traverse(n=>nodes.push({name:n.name,q:n.quaternion.toArray(),m:n.matrix.toArray(),world:n.matrixWorld.toArray(),dirty:n.matrixWorldNeedsUpdate}));
    return {values:{...f.pose.values},nodes};
  }
  function test(name,fn) {
    try {fn();cases.push({name,passed:true});}
    catch (error) {cases.push({name,passed:false,error:String(error.stack)});}
  }
  test('A -> B -> A restores all 8 values and bone transforms',()=>{
    const f=fixture();assert(f.pose.restore(A).ok);const before=state(f);
    assert(f.store.save().ok);assert(f.pose.restore(B).ok);assert(f.store.restore().ok);
    assert.deepEqual(state(f),before);assert.deepEqual(f.store.getSnapshot().values,A);
  });
  test('saved values are independent and externally immutable',()=>{
    const f=fixture();f.pose.restore(A);f.store.save();const saved=f.store.getSnapshot();
    assert.notEqual(saved.values,f.pose.values);assert(Object.isFrozen(saved));assert(Object.isFrozen(saved.values));
    assert.throws(()=>{saved.values.upperarm_l=0;},TypeError);
    f.pose.set('upperarm_l',0);assert.equal(saved.values.upperarm_l,20);
  });
  test('explicit save replaces the single slot; restore does not consume it',()=>{
    const f=fixture();f.pose.restore(A);f.store.save();const first=f.store.getSnapshot();
    f.pose.restore(B);f.store.save();f.pose.restore(A);f.store.restore();
    assert.deepEqual(f.pose.values,B);assert.deepEqual(first.values,A);assert(f.store.restore().ok);
  });
  test('empty and newly created page stores cannot restore',()=>{
    const f=fixture(),before=state(f);assert(!f.store.restore().ok);assert.deepEqual(state(f),before);
    f.store.save();const fresh=createPoseSnapshotStore(()=>f.context);assert.equal(fresh.getSnapshot(),null);
  });
  for (const mode of ['loading','error','unsupported']) test(`${mode} rejects save and restore, preserves slot and model`,()=>{
    const f=fixture();f.store.save();const saved=f.store.getSnapshot(),before=state(f);f.context.state=mode;
    assert(!f.store.save().ok);assert(!f.store.restore().ok);assert.equal(f.store.getSnapshot(),saved);assert.deepEqual(state(f),before);
  });
  test('missing pose controller blocks both operations',()=>{
    const f=fixture();f.context.pose=undefined;assert(!f.store.save().ok);assert(!f.store.restore().ok);
  });
  test('different model blocks restore; returning to same model allows it',()=>{
    const f=fixture();f.pose.restore(A);f.store.save();f.pose.restore(B);const before=state(f);
    f.context.modelHash=otherHash;assert.equal(f.store.restore().reason,'model-mismatch');assert.deepEqual(state(f),before);
    f.context.modelHash=hash;f.context.loadId++;assert(f.store.restore().ok);assert.deepEqual(f.pose.values,A);
  });
  test('a new model may explicitly replace the slot',()=>{
    const f=fixture();f.store.save();f.context.modelHash=otherHash;f.pose.restore(B);
    assert(f.store.save().ok);assert.equal(f.store.getSnapshot().modelHash,otherHash);
  });
  for (const field of ['settingsRevision','latestSettingsRevision']) test(`changed ${field} prevents both operations`,()=>{
    const f=fixture();f.store.save();const saved=f.store.getSnapshot(),before=state(f);f.context[field]++;
    assert(!f.store.restore().ok);assert(!f.store.save().ok);assert.equal(f.store.getSnapshot(),saved);assert.deepEqual(state(f),before);
  });
  test('old snapshot rejected even when new context and controller revisions agree',()=>{
    const f=fixture();f.store.save();const old=f.store.getSnapshot();
    const settings=defaults();settings.revision=1;const next=fixture(settings);
    assert.equal(validatePoseSnapshot(old,next.context).reason,'settings-changed');
  });
  for (const [key,value] of [['schemaVersion',2],['unit','rad'],['poseDefinitionVersion','unknown'],['settingsRevision',7],['modelHash',otherHash]])
    test(`snapshot metadata rejects ${key} mismatch`,()=>{
      const f=fixture();f.store.save();const before=state(f);
      assert(!validatePoseSnapshot({...f.store.getSnapshot(),[key]:value},f.context).ok);assert.deepEqual(state(f),before);
    });
  const badValues=[null,[],{...A,head:0},Object.fromEntries(Object.entries(A).filter(([k])=>k!=='calf_r')),
    ...[NaN,Infinity,-Infinity,1.5,'20',null,-26,46].map(v=>({...A,upperarm_l:v}))];
  badValues.forEach((values,i)=>test(`invalid joint payload ${i+1} is rejected without partial changes`,()=>{
    const f=fixture();f.pose.restore(B);f.store.save();const before=state(f),saved=f.store.getSnapshot();
    assert(!validatePoseSnapshot({...saved,values},f.context).ok);assert(!f.pose.restore(values).ok);
    assert.deepEqual(state(f),before);assert.equal(f.store.getSnapshot(),saved);
  }));
  test('invalid current values cannot replace a good snapshot',()=>{
    const f=fixture();f.store.save();const saved=f.store.getSnapshot();f.pose.values.calf_r=NaN;
    assert(!f.store.save().ok);assert.equal(f.store.getSnapshot(),saved);
  });
  test('hidden joints accept only their policy default',()=>{
    const settings=defaults();settings.categories.upperarm.enabled=false;
    const f=fixture(settings),valid={...A,upperarm_l:0,upperarm_r:0};
    assert(!f.pose.restore(A).ok);assert(f.pose.restore(valid).ok);assert(f.store.save().ok);
    assert.equal(Object.keys(f.store.getSnapshot().values).length,8);
  });
  test('current narrowed policy rejects otherwise valid default-range angles',()=>{
    const settings=defaults();settings.categories.thigh.max=20;const f=fixture(settings);
    assert(!f.pose.restore(A).ok);assert(f.pose.restore({...A,thigh_l:20}).ok);
  });
  test('exact policy endpoints survive save and restore without rounding or clamping',()=>{
    const f=fixture(),edges={};
    f.pose.definitions.forEach((joint,i)=>{edges[joint.id]=i%2?joint.max:joint.min;});
    assert(f.pose.restore(edges).ok);assert(f.store.save().ok);f.pose.restore(A);
    assert(f.store.restore().ok);assert.deepEqual(f.pose.values,edges);
    assert(f.bones.every(b=>b.quaternion.toArray().every(Number.isFinite)));
  });
  test('mid-apply failure rolls back values, rotations and cached matrices',()=>{
    const f=fixture();f.pose.restore(A);f.store.save();f.pose.restore(B);
    const before=state(f),saved=f.store.getSnapshot(),original=f.model.updateMatrixWorld;let count=0;
    f.model.updateMatrixWorld=function(...args){if(++count>=4)throw Error('injected persistent update failure');return original.apply(this,args);};
    assert.equal(f.store.restore().reason,'apply-failed');assert.deepEqual(state(f),before);assert.equal(f.store.getSnapshot(),saved);
    f.model.updateMatrixWorld=original;assert(f.store.restore().ok);assert.deepEqual(f.pose.values,A);
  });
  test('restore retains changed segment length and overall scale/position',()=>{
    const f=fixture();f.pose.restore(A);f.store.save();f.pose.restore(B);
    const calf=f.bones.find(b=>b.name==='calf_l');calf.position.multiplyScalar(1.1);
    f.model.scale.setScalar(1.07);f.model.position.set(.1,.2,.3);
    const segment=calf.position.clone();assert(f.store.restore().ok);
    assert(calf.position.equals(segment));assert.deepEqual(f.model.scale.toArray(),[1.07,1.07,1.07]);
    assert.deepEqual(f.model.position.toArray(),[.1,.2,.3]);assert.deepEqual(f.pose.values,A);
  });
  for (const operation of ['save','restore']) test(`${operation} rejects a load change between validation and commit`,()=>{
    const f=fixture();let changing=false,calls=0;
    const store=createPoseSnapshotStore(()=>({...f.context,loadId:changing?++calls:1}));
    f.pose.restore(A);store.save();f.pose.restore(B);const before=state(f),saved=store.getSnapshot();changing=true;
    assert.equal(store[operation]().reason,'context-changed');assert.deepEqual(state(f),before);assert.equal(store.getSnapshot(),saved);
  });
  test('ordinary slider clamp and reset retain previous behavior',()=>{
    const f=fixture();assert(f.pose.set('upperarm_l',100));assert.equal(f.pose.values.upperarm_l,45);
    assert(f.pose.set('upperarm_l',10.6));assert.equal(f.pose.values.upperarm_l,11);
    assert(!f.pose.set('head',20));f.pose.reset();assert.equal(f.pose.values.upperarm_l,0);
  });
} finally {
  await server.close();delete globalThis.location;
}
const report={testedAt:new Date().toISOString(),scope:'M01-a logic; synthetic Three.js skeleton, no UI or production GLB validation',
  node:process.version,passed:cases.filter(c=>c.passed).length,failed:cases.filter(c=>!c.passed).length,cases};
const output=path.resolve(root,'../../docs/05-validation/reports/pose-snapshot-logic.json');
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.failed)process.exitCode=1;
