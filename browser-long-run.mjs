import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.ORBIT_URL || 'http://127.0.0.1:4173/';
const OUT = 'dist/browser-verification-current.txt';
const LONG_MS = 600_000;
const lines = [];
const errors = [];
const started = new Date();
const pass = (name, detail='') => { const line=`PASS · ${name}${detail?' '+detail:''}`; lines.push(line); console.log(line); };
const fail = (name, detail='') => { const line=`FAIL · ${name}${detail?' '+detail:''}`; lines.push(line); console.error(line); throw new Error(line); };
const assert = (ok,name,detail='') => ok ? pass(name,detail) : fail(name,detail);
const sleep = ms => new Promise(r=>setTimeout(r,ms));

const browser = await chromium.launch({headless:true});
const context = await browser.newContext({viewport:{width:1366,height:768}, reducedMotion:'no-preference'});
const page = await context.newPage();
page.on('console', msg => { if(msg.type()==='error') errors.push('console: '+msg.text()); });
page.on('pageerror', err => errors.push('pageerror: '+err.message));

async function gotoSeed(seed){
  await page.goto(`${BASE}?qa=1&seed=${seed}`,{waitUntil:'load'});
  await page.waitForFunction(()=>typeof window.orbitSnapshot==='function');
}
const snap = () => page.evaluate(()=>window.orbitSnapshot());
async function layout(width,height){
  await page.setViewportSize({width,height});
  return page.evaluate(({width,height})=>{
    const d=document.documentElement;
    const clipped=[...document.querySelectorAll('button,input,select')].filter(e=>e.getClientRects().length).filter(e=>{const r=e.getBoundingClientRect();return r.left<-.5||r.right>d.clientWidth+.5;});
    return {width,height,overflow:d.scrollWidth>d.clientWidth,clipped:clipped.length};
  },{width,height});
}
async function waitEnd(timeout=35_000){
  await page.waitForFunction(()=>window.orbitSnapshot().state!=='flying',null,{timeout});
  return snap();
}
async function setComparisonSchedule(){
  await page.evaluate(()=>{
    for(const row of document.querySelectorAll('.engine-row')){
      const inputs=row.querySelectorAll('input'), select=row.querySelector('select');
      if(select.value==='up'){
        inputs[0].value='0'; inputs[0].dispatchEvent(new Event('change',{bubbles:true}));
        inputs[1].value='1.2'; inputs[1].dispatchEvent(new Event('change',{bubbles:true}));
      }else if(select.value==='right'){
        inputs[0].value='1.6'; inputs[0].dispatchEvent(new Event('change',{bubbles:true}));
        inputs[1].value='7.6'; inputs[1].dispatchEvent(new Event('change',{bubbles:true}));
      }
    }
  });
}

try {
  await gotoSeed(100);
  await page.evaluate(()=>localStorage.removeItem('orbit-workshop-qa-v1'));
  await page.reload({waitUntil:'load'}); await page.waitForFunction(()=>typeof window.orbitSnapshot==='function');
  let s=await snap();
  assert(s.modules===7&&s.launches===0,'C24 빈 저장값에서 기본값 시작',JSON.stringify({modules:s.modules,launches:s.launches}));

  await page.evaluate(()=>localStorage.setItem('orbit-workshop-qa-v1','{broken'));
  await page.reload({waitUntil:'load'}); await page.waitForFunction(()=>typeof window.orbitSnapshot==='function');
  s=await snap();
  assert(s.modules===7&&s.launches===0,'C25 손상 저장값 복구',JSON.stringify({modules:s.modules,launches:s.launches}));

  assert(await page.locator('#playRules').isVisible(),'C03 공개 화면에 게임 규칙 표시');
  assert(await page.locator('#launch').isVisible() && await page.locator('#grid').isVisible(),'C04 공개 화면에 핵심 조작 표시');
  assert(await page.locator('#phase').isVisible() && await page.locator('#clock').isVisible(),'C05 공개 화면에 현재 상태 표시');

  let r=await layout(1366,768); assert(!r.overflow&&r.clipped===0,'C10 1366×768 가로 넘침·조작 잘림 0',JSON.stringify(r));
  r=await layout(1920,1080); assert(!r.overflow&&r.clipped===0,'C11 1920×1080 가로 넘침·조작 잘림 0',JSON.stringify(r));
  await layout(1366,768);

  await page.click('#example');
  await page.click('[data-tool="body"]');
const beforeInputs=(await snap()).modules;
const rapid=await page.evaluate(()=>{
  const t=performance.now();
  let count=0;

  for(let i=0;i<10;i++){
    const empty=[...document.querySelectorAll('#grid .cell')]
      .find(b=>!b.textContent && !b.disabled);

    if(!empty) break;

    empty.dispatchEvent(
      new MouseEvent('click',{bubbles:true})
    );

    count++;
  }

  return {
    count,
    ms:performance.now()-t
  };
});
s=await snap();
  assert(rapid.count===10 && rapid.ms<1000 && s.modules===beforeInputs+10,'C06/C12 1초 내 핵심 입력 10건이 정확히 10회 반영',JSON.stringify({ms:+rapid.ms.toFixed(1),increase:s.modules-beforeInputs}));

  await page.click('#example');
  await page.click('#launch'); await sleep(1200); const preResize=await snap();
  await layout(1920,1080); await sleep(1200); const postResize=await snap();
  assert(postResize.state==='flying'&&postResize.t>preResize.t,'C13 창 크기 변경 뒤 상태·조작 유지',JSON.stringify({before:preResize.t,after:postResize.t}));
  await layout(1366,768);

  await page.evaluate(()=>window.dispatchEvent(new Event('blur'))); const pausedAt=await snap(); await sleep(700); const pausedLater=await snap();
  assert(pausedLater.paused&&pausedLater.t===pausedAt.t&&pausedLater.x===pausedAt.x,'C14/C15 포커스 이탈 중 상태 정지',JSON.stringify({t:pausedLater.t,paused:pausedLater.paused}));
  await page.evaluate(()=>window.dispatchEvent(new Event('focus'))); await sleep(700); const resumed=await snap();
  assert(!resumed.paused&&resumed.t>pausedLater.t,'C14/C15 복귀 뒤 이어서 진행',JSON.stringify({before:pausedLater.t,after:resumed.t}));

  // 성공 경로: 현재 최종 물리의 난이도 비교에서 실제 성공한 seed 2 / 동일 설계 사용.
  await gotoSeed(2); await page.click('#example');
  await page.evaluate(()=>{const e=document.getElementById('reduce');e.checked=false;e.dispatchEvent(new Event('change',{bubbles:true}));});
  await setComparisonSchedule(); await page.click('#launch'); let end=await waitEnd();
  assert(end.state==='success'&&end.t<=30,'C07 성공 상태 30초 이내 도달',JSON.stringify({state:end.state,t:end.t}));
  assert(end.particles>0,'C26 성공 사건에서 성공 효과 1회 실행',JSON.stringify({particles:end.particles}));
  await page.evaluate(()=>{const e=document.getElementById('reduce');e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}));});
  assert((await snap()).particles===0,'C27 효과 줄이기 즉시 적용');
  const successSeed=end.seed; await page.click('#retry'); s=await snap();
  assert(s.state==='design'&&s.t===0&&s.angle===0&&s.omega===0&&s.seed===successSeed,'C08/C22 성공 뒤 다시 시작 현재 판 초기화·같은 항로 보존');
  const launches=s.launches,wins=s.wins; await page.reload({waitUntil:'load'}); await page.waitForFunction(()=>typeof window.orbitSnapshot==='function'); s=await snap();
  assert(s.launches===launches&&s.wins===wins,'C23 재접속 뒤 보존 기록 유지',JSON.stringify({launches,wins}));

  // 실패 경로.
  await gotoSeed(0); await page.click('#example'); await setComparisonSchedule(); await page.click('#launch'); end=await waitEnd();
  assert(end.state==='failure'&&end.t<=30,'C07 실패 상태 30초 이내 도달',JSON.stringify({state:end.state,t:end.t,reason:end.state}));
  const failSeed=end.seed; await page.click('#retry'); s=await snap();
  assert(s.state==='design'&&s.t===0&&s.angle===0&&s.omega===0&&s.seed===failSeed,'C09/C22 실패 뒤 다시 시작 현재 판 초기화·같은 항로 보존');

  // 실제 벽시계 10분 연속 실행. 종료할 때마다 새 항로로 계속 발사한다.
  await gotoSeed(200); await page.click('#example');
  const longStart=Date.now(); let rounds=0,nextMinute=60_000;
  pass('10분 실시간 검사 시작',new Date(longStart).toISOString());
  while(Date.now()-longStart<LONG_MS){
    s=await snap();
    if(s.state==='design'){
      await page.click('#launch'); rounds++;
    }else if(s.state!=='flying'){
      await page.click('#retry');
      await page.click('#newRoute');
    }
    await sleep(250);
    const elapsed=Date.now()-longStart;
    if(elapsed>=nextMinute){ pass('연속 실행 진행',`${Math.floor(elapsed/1000)}초 / ${rounds}판`); nextMinute+=60_000; }
  }
  s=await snap(); if(s.state!=='design') await page.click('#retry');
  await page.click('#example'); const designBefore=(await snap()).design.map(m=>[m.x,m.y]);
  const right=page.locator('[data-shift="1,0"]'); assert(!(await right.isDisabled()),'C16 10분 뒤 조작 버튼 활성');
  await right.click(); const designAfter=(await snap()).design.map(m=>[m.x,m.y]);
  assert(designAfter.every((p,i)=>p[0]===designBefore[i][0]+1&&p[1]===designBefore[i][1]),'C16 10분 뒤 실제 조작 가능',`${Date.now()-longStart}ms / ${rounds}판`);

  assert(errors.length===0,'C17 10분 연속 실행 뒤 브라우저 콘솔 빨간 오류 0',JSON.stringify(errors));
  pass('검사 종료',new Date().toISOString());
} catch (e) {
  lines.push('ERROR · '+(e?.stack||e));
  throw e;
} finally {
  const header=[
    `COMMIT: ${process.env.GITHUB_SHA||'local'}`,
    `START: ${started.toISOString()}`,
    `END: ${new Date().toISOString()}`,
    `WALL_CLOCK_TARGET_MS: ${LONG_MS}`,
    ''
  ];
  fs.writeFileSync(OUT,header.concat(lines,`GAME_CONSOLE_ERRORS: ${JSON.stringify(errors)}`).join('\n')+'\n');
  await browser.close();
}
