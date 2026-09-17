const E=require('./dist/engine.js'),assert=require('node:assert/strict');
const world=E.makeWorld(100),p={...world.planets[0],x:500,y:300,vx:0,vy:0,mass:10000};
const a=E.environment({planets:[p]},400,300,0),b=E.environment({planets:[{...p,mass:20000}]},400,300,0);
assert.equal(b.gx,a.gx*2);assert.equal(a.gy,0);assert(a.gx>0);assert(E.environment({planets:[p]},300,300,0).gx<a.gx);
assert(Number.isFinite(E.environment({planets:[p]},500,300,0).gx));
const storm={x:120,y:430,r:100,start:0,end:2,ax:3,ay:-2},w={planets:[],storms:[storm]};
assert.equal(E.environment(w,120,430,0).wx,3);assert.equal(E.environment(w,220,430,0).wx,0);assert.equal(E.environment(w,120,430,2).wx,0);
let craft=E.example().map(m=>m.type==='engine'?{...m,start:20,end:21}:m),s=E.create(craft,w);E.step(s);assert(s.vx>0&&s.vy<0);let sg=E.create(craft,{planets:[{...p,x:300,y:350}]});E.step(sg);assert(sg.vx>0&&sg.vy<0);
assert.equal(E.GOAL.r,24);for(const [dx,result] of [[25,'flying'],[23,'success']]){let s=E.create(craft,{planets:[]});s.x=E.GOAL.x+dx;s.y=E.GOAL.y;E.step(s);assert.equal(s.state,result);}
assert.deepEqual(E.makeWorld(100),world);assert.notDeepEqual(E.makeWorld(101),world);const copy=JSON.stringify(world);s=E.create(E.example(),world);for(let i=0;i<100;i++)E.step(s);assert.equal(JSON.stringify(world),copy);
for(let seed=0;seed<50;seed++){s=E.create(E.example(),E.makeWorld(seed));while(s.state==='flying')E.step(s);assert([s.x,s.y,s.vx,s.vy,s.angle].every(Number.isFinite));assert(s.t<=30);}
console.log('PASS mass proportionality / distance falloff / finite gravity / storm timing and area / actual acceleration / goal radius 24 / seeded forecast stable / 50 complete finite flights');

assert(E.gravityRadius({...p,mass:20000})>E.gravityRadius(p));
assert.equal(E.environment({planets:[p]},500+E.gravityRadius(p)+1,300,0).gx,0);
assert(E.environment({planets:[p]},500+E.gravityRadius(p)-1,300,0).gx<0);
console.log("PASS mass-based range / zero gravity outside / nonzero inside");
