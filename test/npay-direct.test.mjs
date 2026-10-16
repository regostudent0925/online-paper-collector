import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../ui/npay.js',import.meta.url),'utf8');
const live=JSON.parse(fs.readFileSync(new URL('../data/npay.json',import.meta.url),'utf8'));
function setup(data,extra={}){
  const calls=[];
  const element=tag=>({tag,children:[],append(e){this.children.push(e);},replaceChildren(...items){this.children=items;},addEventListener(){}});
  const root=element('section'),button=element('button');
  const context=vm.createContext({URL,Date,Number,Set,document:{querySelector:s=>s==='#npay-content'?root:button,createElement:element},fetch:async url=>{calls.push(url);return {ok:true,json:async()=>data};},setInterval(){},...extra});
  vm.runInContext(code,context);
  const flatten=e=>[e,...e.children.flatMap(flatten)];
  return {context,calls,root,nodes:()=>flatten(root)};
}
test('최초 기본값·정렬 저장 후 재로드·잘못된 값·저장소 차단 처리',()=>{let value=null;const localStorage={getItem:()=>value,setItem:(k,v)=>{value=v;}};const first=setup({directLinks:[]},{localStorage});assert.equal(vm.runInContext('npayOrder',first.context),'points-desc');vm.runInContext("saveNpayOrder('default')",first.context);const reloaded=setup({directLinks:[]},{localStorage});assert.equal(vm.runInContext('npayOrder',reloaded.context),'default');value='invalid';assert.equal(vm.runInContext('npayOrder',setup({directLinks:[]},{localStorage}).context),'points-desc');const blocked=setup({directLinks:[]},{localStorage:{getItem(){throw Error();},setItem(){throw Error();}}});assert.equal(vm.runInContext('npayOrder',blocked.context),'points-desc');assert.doesNotThrow(()=>vm.runInContext("saveNpayOrder('default')",blocked.context));});
test('제목 검색은 공백·대소문자 처리, 금액 높은 순은 미확인 마지막·동점 순서 유지',()=>{const s=setup({directLinks:[],completed:[]});const result=vm.runInContext(`npayVisibleRows([{item:{title:'Npay A',claimedPoints:15}},{item:{title:'npay B',claimedPoints:null}},{item:{title:'Npay C',claimedPoints:30}},{item:{title:'Npay D',claimedPoints:15}},{item:{title:'다른 행사',claimedPoints:100}}],'  NPAY  ','points-desc').map(r=>r.item.title)`,s.context);assert.deepEqual(Array.from(result),['Npay C','Npay A','Npay D','npay B']);assert.equal(vm.runInContext("npayVisibleRows([{item:{title:'가상'}}],'없음','default').length",s.context),0);});
test('갱신 시각은 공식 목록 확인값 우선·한국시간 표시·누락은 미확인',async()=>{const s=setup({directLinks:[],missionSource:{checkedAt:'2026-10-16T00:00:00Z'},checkedAt:'2026-10-17T00:00:00Z'});await new Promise(r=>setImmediate(r));const text=s.nodes().find(n=>n.className==='npay-updated').textContent;assert.match(text,/2026\. 10\. 16\./);assert.match(text,/09:00/);const blank=setup({directLinks:[]});await new Promise(r=>setImmediate(r));assert.equal(blank.nodes().find(n=>n.className==='npay-updated').textContent,'목록 갱신: 미확인');});
test('개별 URL은 문자열만 검사하고 광고를 자동 조회하지 않음',async()=>{
  const s=setup({...live,items:[],withheld:[]});await new Promise(r=>setImmediate(r));
  assert.deepEqual(s.calls,['/api/npay']);
  const links=s.nodes().filter(n=>n.textContent==='적립 링크 ↗');
  assert.equal(links.length,live.directLinks.length);assert.ok(links.every(n=>n.target==='_blank'&&n.rel==='noopener noreferrer'&&n.referrerPolicy==='no-referrer'));
  assert.ok(s.nodes().some(n=>n.textContent==='15P'));
  assert.ok(s.nodes().some(n=>n.textContent==='금액은 각 출처의 표시 기준 · 지급 미확인'));
  assert.ok(!s.nodes().some(n=>n.textContent?.startsWith('참여 방법:')||n.textContent?.startsWith('출처:')));
  assert.equal(s.nodes().filter(n=>n.href?.includes('ppomppu')).length,0);
});
test('개별 주소는 HTTPS·관찰한 경로와 매개변수만 허용',()=>{
  const s=setup({...live,directLinks:[],items:[]});
  for(const url of ['javascript:alert(1)','http://campaign2.naver.com/npay/v2/click-point/?eventId=x','https://campaign2.naver.com.evil.test/npay/v2/click-point/?eventId=x','https://u:p@campaign2.naver.com/npay/v2/click-point/?eventId=x','https://campaign2.naver.com/npay/v2/click-point/?eventId=x&token=secret','https://campaign2.naver.com/npay/v2/click-point/?eventId=x&eventId=y','https://external-token.pay.naver.com/entry/pincrux?gd=fake','https://ofw.adison.co/u/naverpay/ads/730013?email=fake','https://127.0.0.1/reward'])assert.equal(vm.runInContext('safeDirectUrl('+JSON.stringify(url)+')',s.context),null);
  for(const row of live.directLinks)assert.equal(vm.runInContext('safeDirectUrl('+JSON.stringify(row.adUrl)+')',s.context),row.adUrl);
});
test('중복 주소 통합·다른 캠페인 유지·금액 미확인·링크 실패 표시',async()=>{
  const a=live.directLinks[0],b=live.directLinks[1];
  const s=setup({...live,items:[],directLinks:[a,a,b,{...a,adUrl:null,title:'가상 금액 미확인',claimedPoints:null}]});await new Promise(r=>setImmediate(r));
  assert.equal(s.nodes().filter(n=>n.textContent==='적립 링크 ↗').length,2);
  assert.ok(s.nodes().some(n=>n.textContent==='적립 금액 미확인'));
  assert.ok(s.nodes().some(n=>n.textContent==='링크 미확인'));
});
test('간결한 목록은 제목·금액·링크만 표시하고 검증 배지·수동 완료 버튼은 생략',async()=>{
  const s=setup({...live,items:[],directLinks:[{...live.directLinks[0],checkedAt:'2020-01-01T00:00:00Z'}]});await new Promise(r=>setImmediate(r));
  assert.ok(s.nodes().some(n=>n.textContent===live.directLinks[0].title));
  assert.equal(s.nodes().filter(n=>n.textContent==='적립 링크 ↗').length,1);
  assert.ok(!s.nodes().some(n=>n.className==='tag'||n.className==='npay-done'));
});
test('실제 공개 자료는 확인 완료와 분리하고 캠페인 URL·출처를 보존',()=>{
  assert.equal(live.items.length,0);assert.ok(live.directLinks.length>=7);
  for(const row of live.directLinks){assert.equal(row.verification.rewardLinkOpened,false);assert.equal(row.verification.officialConditions,false);assert.match(row.sourceDate,/^\d{4}-\d{2}-\d{2}$/);assert.equal(row.repeatRule,null);assert.ok(row.unknowns.length);}
});

test('확장 미연결 시 기존 열기 기준5초 타이머를 실행하지 않음',()=>{let opened=0,timed=0;const s=setup({...live,directLinks:[]},{window:{open:()=>opened++},setTimeout:()=>timed++});const messages=[];s.context.status=m=>messages.push(m);vm.runInContext('openTimedReward({},"https://example.test",status)',s.context);assert.equal(opened,0);assert.equal(timed,0);assert.equal(messages.length,1);});

