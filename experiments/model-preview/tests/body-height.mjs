import assert from 'node:assert/strict';
import {createHeightBridge} from '../review/body-height.js';
const f=t=>1-.3*t+.12*t*t-.01*t*t*t;
const plan=createHeightBridge(f),h=1e-7;
for(const t of [plan.start,plan.start+plan.edge,plan.end-plan.edge,plan.end]){
 const l=plan.read(t-h),r=plan.read(t+h);
 assert(Math.abs(l.y-r.y)<1e-6,'position joins');
 assert(Math.abs(l.v-r.v)<1e-5,'velocity joins');
 assert(Math.abs(l.a-r.a)<.001,'acceleration joins');
}
for(const [t,endpoint]of [[plan.start,plan.A],[plan.end,plan.B]]){
 const actual=plan.read(t);
 assert(Math.abs(actual.y-endpoint.p)<1e-12);
 assert(Math.abs(actual.v-endpoint.v)<1e-12);
 assert(Math.abs(actual.a-endpoint.a)<1e-10);
}
for(let i=0;i<=1000;i++)assert(plan.read(plan.start+(plan.end-plan.start)*i/1000).v<0,'descending bridge');
const constant=createHeightBridge(()=>2);
assert.equal(constant.read(.15).y,2);assert.equal(constant.read(.15).v,0);
assert.throws(()=>createHeightBridge(f,{start:0,end:1,edge:.6,derivativeStep:1e-5}));
console.log('PASS: endpoint position/velocity/acceleration, internal C2 joins, descending curve, constant and invalid window.');
