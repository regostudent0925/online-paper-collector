const $=s=>document.querySelector(s);
let view=null,shown=null;
const fmt=s=>s?new Date(s).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'미확인';
const text=(tag,value,parent)=>{const e=document.createElement(tag);e.textContent=value;parent.append(e);return e;};
function link(url,label,parent){try{const u=new URL(url);if(u.protocol!=='https:')return;const a=text('a',label,parent);a.href=u.href;a.target='_blank';a.rel='noreferrer noopener';}catch{}}
function render(data){
  view=data.view;$('#demo').hidden=!data.demo;$('#events').replaceChildren();$('#withheld').replaceChildren();
  if(!view){$('#time').textContent='아직 안내된 이벤트가 없습니다.';$('#save').disabled=true;return;}
  $('#time').textContent='안내 '+fmt(view.publishedAt)+' · 선택 요청 예정 '+fmt(view.reminderDueAt)+' (한국시간)';
  if(!view.events.length)text('p','현재 확인된 조건에 맞는 안내 후보가 없습니다. 숫자를 채우지 않습니다.',$('#events'));
  for(const e of view.events){
    const card=document.createElement('article');text('h2',e.guideNumber+'. '+e.title+' · '+e.round,card);
    text('p',(e.guideKind||'처음 안내')+' / '+e.organizer+' / 마감 '+e.dates.end+(e.dates.endPrecision==='date'?' (시각 미공개)':''),card);
    link(e.entryUrl,'공식 응모 페이지 열기',card);
    text('p','기존 계정 로그인: '+(e.conditions.login?'필요':'현재 공개 폼에서 필수 아님')+' / 신규 가입·앱 설치·본인인증 필수 후보는 우선 목록에서 보류합니다.',card);
    text('p','경품: '+(e.prize.description||'미확인')+' / '+(e.prize.count??'미확인')+'명',card);
    text('p','요구 개인정보: '+e.privacy.fields.join(', ')+' / 보유: '+e.privacy.retention,card);
    text('p','제3자 제공: '+(e.privacy.recipients||'미확인')+' / 위탁: '+(e.privacy.processors||'미확인'),card);
    text('p','자격: '+(e.eligibility.description||'별도 확인 필요')+' / 중복: '+(e.duplicateRule||'허용 횟수 미공개'),card);
    for(const q of e.questions||[]){text('p',q.question+' → '+(q.answerNumber?q.answerNumber+'번 / ':'')+q.answerText,card);for(const u of q.evidenceUrls||[])link(u,'정답 공식 근거 ',card);text('small',' 확인 '+fmt(q.checkedAt),card);}
    const label=text('label','참여 상태 선택',card);const select=document.createElement('select');select.dataset.key=e.guideKey;select.setAttribute('aria-label',e.title+' 참여 상태');
    for(const [value,name]of [['','선택하지 않음'],['pending','미참여·나중에 참여'],['participated','참여했음'],['not-interested','참여 의사 없음']]){const option=new Option(name,value);select.add(option);}select.value=e.userChoice||'';label.append(select);$('#events').append(card);
  }
  for(const e of view.withheld)text('p',e.title+' — '+e.reasons.join(' / '),$('#withheld'));
  $('#save').disabled=!view.events.length;
}
async function refresh(){try{const r=await fetch('/api/view');const data=await r.json();if(!view||view.id!==data.view?.id)render(data);
  if(data.view && data.due.includes(data.view.id)&&shown!==data.view.id&&document.visibilityState==='visible'){shown=data.view.id;$('#reminder').showModal();}
}catch{$('#result').textContent='로컬 연결을 확인해 주세요. 저장했다고 추정하지 않습니다.';}}
$('#save').addEventListener('click',async()=>{
  const selections=[...document.querySelectorAll('select[data-key]')].filter(s=>s.value).map(s=>({key:s.dataset.key,choice:s.value}));
  if(!selections.length){$('#result').textContent='선택한 항목이 없습니다. 제외하지 않았습니다.';return;}
  try{const r=await fetch('/api/choices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({batchId:view.id,selections})});const result=await r.json();if(!r.ok)throw Error(result.error);$('#result').textContent=result.saved+'건 저장했습니다. '+result.effectiveDate+'부터 반영됩니다.';}catch{$('#result').textContent='저장되지 않았습니다. 연결을 확인하고 다시 시도해 주세요.';}
});
$('#dismiss').addEventListener('click',()=>$('#reminder').close());document.addEventListener('visibilitychange',refresh);refresh();setInterval(refresh,15000);
