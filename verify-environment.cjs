const E=require('./dist/engine.js'),assert=require('node:assert/strict');
const p={x:500,y:300,r:35,vx:0,vy:0,mass:10000,points:[{x:-30,y:-30},{x:30,y:-30},{x:30,y:30},{x:-30,y:30}]};
const a=E.environment({planets:[p],storms:[]},400,300,0),b=E.environment({planets:[{...p,mass:20000}],storms:[]},400,300,0);
assert.equal(b.gx,a.gx*2);assert.equal(a.gy,0);assert(a.gx>0);assert(E.gravityRadius({...p,mass:20000})>E.gravityRadius(p));assert(E.gravityRadius(p)<2.5*Math.sqrt(p.mass));
assert.equal(E.environment({planets:[p],storms:[]},500+E.gravityRadius(p)+1,300,0).gx,0);
const storm={x:120,y:430,r:100,start:0,end:2,ax:1.5,ay:-1},w={planets:[],storms:[storm]};
let f=E.environment(w,120,430,0);assert.equal(f.wx,1.5);assert.equal(f.wy,-1);assert.equal(E.environment(w,220,430,0).wx,0);assert.equal(E.environment(w,120,430,2).wx,0);
f=E.environment({planets:[],storms:[{...storm,ax:20,ay:0}]},120,430,0);assert.equal(+Math.hypot(f.wx,f.wy).toFixed(6),4.8);
const worlds=Array.from({length:50},(_,i)=>E.makeWorld(i));assert(worlds.every(world=>world.storms.every(s=>Math.hypot(s.ax,s.ay)>=2.1-1e-10&&Math.hypot(s.ax,s.ay)<=4.2+1e-10)));assert(new Set(worlds.map(world=>world.goal.x.toFixed(2)+','+world.goal.y.toFixed(2))).size>40);
for(const world of worlds){let s=E.create(E.example(),world);while(s.state==='flying')E.step(s);assert([s.x,s.y,s.vx,s.vy,s.angle].every(Number.isFinite));assert(s.t<=30);}
console.log('PASS 축소된 질량별 중력 범위 / 폭풍 방향 일치와 4.8m/s² 상한 / 무작위 목표 / 50회 유한 비행');

assert(worlds.every(w=>w.goal.x===900&&w.goal.y>=60&&w.goal.y<=540));
assert(worlds.some(w=>w.goal.y<200)&&worlds.some(w=>w.goal.y>430));
for(const [ax,ay] of [[2,0],[-2,0],[0,2],[0,-2],[1,-1]]){const world={planets:[],storms:[{...storm,ax,ay}]};let s=E.create(E.example().map(m=>m.type==='engine'?{...m,start:20,end:21}:m),world);E.step(s);assert(Math.abs(s.vx*ay-s.vy*ax)<1e-10);assert(s.vx*ax+s.vy*ay>0);}
const fs=require('node:fs'),vm=require('node:vm');const js=fs.readFileSync('./dist/game.js','utf8');const chunk=js.slice(js.indexOf('let nextEngineId=1;'),js.indexOf('\n',js.indexOf('let nextEngineId=1;')));vm.runInNewContext(chunk+`;const a=[{type:'engine',engineId:8},{type:'engine',engineId:2}];ensureEngineIds(a);a.push({type:'engine',engineId:nextEngineId++});ensureEngineIds(a);if(a.map(m=>m.engineId).join(',')!=='8,2,9')throw Error('unstable engine IDs');a.unshift({type:'engine'});ensureEngineIds(a);if(a[1].engineId!==8||a[2].engineId!==2||a[3].engineId!==9)throw Error('renumbering');`);
console.log('PASS 상하 목표 생성 / 실제 속도 변화의 폭풍 방향 일치 / 기존 엔진 번호 유지');

const modules=[{type:'body',x:0,y:0,w:2,h:2},{type:'engine',x:3,y:0,engineId:7,dir:'up',start:1,end:3}];
const original=JSON.stringify(modules);assert(!E.moveModule(modules,modules[0],8,0));assert.equal(JSON.stringify(modules),original);assert(!E.moveModule(modules,modules[0],2,0));assert.equal(JSON.stringify(modules),original);assert(E.moveModule(modules,modules[1],5,4));assert.equal(modules[1].engineId,7);assert.equal(modules[1].start,1);assert(E.moveModule(modules,modules[0],7,5));assert(!E.moveModule(modules,modules[0],7,6));
console.log('PASS 개별 드래그 이동 / 큰 동체 경계 및 충돌 차단 / 엔진 번호와 시간 유지');
const difficultyDrift=[];
for(const [difficulty,multiplier] of Object.entries(E.stormLevels)){
 const w={difficulty,planets:[],storms:[{x:120,y:430,r:1000,start:0,end:30,ax:0,ay:-3}],goal:{x:900,y:60,r:24}};
 const a=E.environment(w,120,430,1);assert.equal(a.wy,-3*multiplier);assert.equal(a.wx,0);
 const extreme=E.environment({...w,storms:[{...w.storms[0],ax:100,ay:100}]},120,430,1);assert(Math.abs(Math.hypot(extreme.wx,extreme.wy)-4.8*multiplier)<1e-8);
 const s=E.create(E.example().map(m=>m.type==='engine'?{...m,start:20,end:21}:m),w),initial=s.y;
 for(let i=0;i<240;i++)E.step(s);
 assert.equal(s.world.difficulty,difficulty);assert.equal(s.state,'flying');difficultyDrift.push({difficulty,meters:initial-s.y});
}
assert(difficultyDrift[3].meters>50);for(let i=1;i<4;i++)assert(difficultyDrift[i].meters>difficultyDrift[i-1].meters);
console.log('PASS 2초간 동일 폭풍에서 난이도별 변위:',difficultyDrift);
