const E=require('./dist/engine.js'),fs=require('node:fs');
function testDesign(){
  const b=E.example();
  for(const m of b){
    if(m.type==='engine'&&m.dir==='up'){m.start=0;m.end=1.2;}
    if(m.type==='engine'&&m.dir==='right'){m.start=1.6;m.end=7.6;}
  }
  return b;
}
function fly(seed,difficulty){
  const world=E.makeWorld(seed); world.difficulty=difficulty;
  const s=E.create(testDesign(),world);
  while(s.state==='flying')E.step(s);
  return {group:difficulty==='normal'?'before':'after',trial:seed+1,seed,difficulty,stormMultiplier:E.stormLevels[difficulty],result:s.state,time:+s.t.toFixed(4),reason:s.reason};
}
const records=['normal','hard'].flatMap(d=>Array.from({length:10},(_,i)=>fly(i,d)));
const median=a=>{a=[...a].sort((x,y)=>x-y);return +(a[4]+a[5])/2;};
const summaries=['normal','hard'].map(d=>{
  const a=records.filter(r=>r.difficulty===d),failures=a.filter(r=>r.result==='failure'),failureReasons={};
  for(const r of failures)failureReasons[r.reason]=(failureReasons[r.reason]||0)+1;
  return {difficulty:d,stormMultiplier:E.stormLevels[d],wins:a.filter(r=>r.result==='success').length,failures:failures.length,medianSeconds:+median(a.map(r=>r.time)).toFixed(4),minSeconds:Math.min(...a.map(r=>r.time)),maxSeconds:Math.max(...a.map(r=>r.time)),failureReasons};
});
const output={
  version:3,
  method:'현재 최종 물리에서 동일한 10개 seed(0~9)와 동일한 설계를 사용하고 폭풍 난이도 하나만 보통 ×3에서 어려움 ×6으로 변경.',
  fixed:{goalRadius:24,force:E.FORCE,timeLimit:30,dt:E.DT,seeds:'0~9',design:{upEngines:'0~1.2초',rightEngines:'1.6~7.6초',modules:'same Orbit.example() geometry'}},
  changedOnly:{parameter:'storm difficulty multiplier',before:'normal ×3',after:'hard ×6'},
  records,summaries,
  finalChoice:{difficulty:'normal',stormMultiplier:3,reason:'보통은 10회 중 성공 2회, 어려움은 1회였다. 두 묶음 모두 반복 실패 원인은 주로 행성 충돌이었고, 어려움에서 성공 수가 더 줄어 최종 기본 난이도는 보통 ×3으로 유지했다.'}
};
fs.writeFileSync('dist/difficulty-records-v3.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output,null,2));
