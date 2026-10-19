const root=document.querySelector('#npay-content');
const npayOrderKey='npay-sort-order-v1';
function readNpayOrder(){try{const saved=localStorage.getItem(npayOrderKey);return ['default','points-desc'].includes(saved)?saved:'points-desc';}catch{return 'points-desc';}}
let npayTab='available',npaySaving=false,npayMessage='',npayQuery='',npayOrder=readNpayOrder();
function saveNpayOrder(value){npayOrder=value==='default'?'default':'points-desc';try{localStorage.setItem(npayOrderKey,npayOrder);}catch{}}
function npayVisibleRows(rows,query,order){const term=query.trim().toLocaleLowerCase('ko-KR');const result=rows.filter(row=>String(row.item.title||'').toLocaleLowerCase('ko-KR').includes(term));if(order==='points-desc')result.sort((a,b)=>(Number.isFinite(b.item.claimedPoints)?b.item.claimedPoints:-Infinity)-(Number.isFinite(a.item.claimedPoints)?a.item.claimedPoints:-Infinity));return result;}
const add=(tag,value,parent,cls)=>{const e=document.createElement(tag);e.textContent=value;if(cls)e.className=cls;parent.append(e);return e;};
function safeDirectUrl(raw){try{const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)return null;
if(u.hostname==='campaign2.naver.com'&&u.pathname==='/npay/v2/click-point/'&&[...u.searchParams.keys()].length===1&&/^[a-zA-Z0-9_\-]+$/.test(u.searchParams.get('eventId')||''))return u.href;
if(u.hostname==='ofw.adison.co'&&/^\/u\/naverpay\/ads\/\d+$/.test(u.pathname)&&!u.search)return u.href;
if(u.hostname==='point.pay.naver.com'&&u.pathname==='/bridge/eventbenefit'&&[...u.searchParams.keys()].length===4&&u.searchParams.get('fromPage')==='DETAIL_FROM_BANNER'&&u.searchParams.get('inventory')==='pay>benefit_group'&&u.searchParams.get('placementId')==='benefit_group_pp'&&/^\d+$/.test(u.searchParams.get('adId')||''))return u.href;
}catch{}return null;}
// 실제 광고를 자동 조회하지 않는다. 사용자의 일반 클릭으로 연 창만 닫는다.
function openTimedReward(event,url,onStatus=()=>{}){if(document.documentElement?.dataset?.mode==='web-preview'){onStatus('직접 참여한 뒤 참여완료 버튼으로 기록해 주세요. 공개 홈페이지에서는 탭을 자동으로 닫지 않습니다.');return;}onStatus('클릭 기준 자동 닫기에는 최신 Chrome 보조 확장이 필요합니다. 연결 전에는 자동으로 닫지 않습니다.');}
async function loadNpay(){if(npaySaving)return;try{
const r=await fetch('/api/npay');if(!r.ok)throw Error();let data=await r.json();const browserLocal=document.documentElement?.dataset?.mode==='web-preview';if(browserLocal)data=(await import('./browser-records.js')).browserStore().rewards(data);root.replaceChildren();
const notice=add('p',npayMessage,root,'npay-feedback');notice.role='status';
const checked=data.missionSource?.checkedAt||data.checkedAt;
add('p','목록 갱신: '+(Number.isFinite(Date.parse(checked))?new Date(checked).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})+' (한국시간)':'미확인'),root,'npay-updated');
const controls=add('div','',root,'npay-controls');
const searchLabel=add('label','제목 검색',controls,'npay-search');const searchInput=add('input','',searchLabel);searchInput.type='search';searchInput.placeholder='이벤트 제목 검색';searchInput.ariaLabel='Npay 이벤트 제목 검색';searchInput.value=npayQuery;
const orderLabel=add('label','정렬',controls,'npay-sort');const orderSelect=add('select','',orderLabel);orderSelect.ariaLabel='Npay 목록 정렬';for(const [value,label]of [['default','기본 순서'],['points-desc','포인트 높은 순']]){const option=add('option',label,orderSelect);option.value=value;}orderSelect.value=npayOrder;
const tabs=add('div','',root,'npay-tabs');tabs.role='tablist';tabs.ariaLabel='Npay 참여 상태';
const availablePanel=add('div','',root),completedPanel=add('div','',root);availablePanel.role=completedPanel.role='tabpanel';
const buttons=[];
for(const [key,label,count] of [['available','참여가능',(data.directLinks||[]).length],['completed','참여완료',(data.completed||[]).length]]){
const b=add('button',label+' '+count,tabs,'button-light');b.role='tab';buttons.push([b,key]);b.addEventListener('click',()=>{npayTab=key;updateTabs();});}
function updateTabs(){availablePanel.hidden=npayTab!=='available';completedPanel.hidden=npayTab!=='completed';for(const [b,key]of buttons)b.ariaSelected=String(key===npayTab);}
const completedCards=add('div','',completedPanel,'npay-direct-grid'),completedRows=[],availableRows=[];
for(const item of data.completed||[]){const card=add('article','',completedCards,'npay-quick-card is-completed');add('h3',item.title,card);add('strong',Number.isFinite(item.claimedPoints)?item.claimedPoints+'P':'금액 미확인',card,'npay-points');add('small',item.completionKind==='already-participated'?'기참여 확인 · 적립일 미확인':new Date(item.completedAt).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})+' 기록',card,'npay-meta');}
for(const [index,card]of [...completedCards.children].entries())completedRows.push({item:data.completed[index],card});
const completedEmpty=add('p','',completedPanel,'npay-filter-empty');
updateTabs();
const links=data.directLinks||[],cards=add('div','',availablePanel,'npay-direct-grid'),seen=new Set();
for(const item of links){const url=safeDirectUrl(item.adUrl);if(url&&seen.has(url))continue;if(url)seen.add(url);
const card=add('article','',cards,'npay-quick-card');
availableRows.push({item,card});
add('h3',item.title,card);add('strong',Number.isFinite(item.claimedPoints)?item.claimedPoints+'P':'적립 금액 미확인',card,'npay-points');
const actions=add('div','',card,'npay-quick-actions');
if(url){const bridge=new URL(url).hostname==='point.pay.naver.com',helperReady=document.documentElement?.dataset?.npayMissionLinks==='v1';const a=add('a','적립 링크 ↗',actions,bridge&&!helperReady?'npay-go-manual':'npay-go');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';a.dataset??={};a.dataset.npayKey=item.selectionKey||'';a.addEventListener('click',event=>openTimedReward(event,url,message=>{notice.textContent=message;}));}else add('span','링크 미확인',actions,'npay-meta');
if(browserLocal){const done=add('button','참여완료',actions,'button-light');done.ariaLabel=item.title+' 참여완료';done.addEventListener('click',async()=>{if(npaySaving)return;npaySaving=true;done.disabled=true;try{(await import('./browser-records.js')).browserStore().complete(item);npayMessage='참여완료로 저장했습니다. 표시 포인트를 지급된 것으로 가정하여 집계합니다.';document.dispatchEvent(new Event('personal-records-changed'));}catch(e){npayMessage=e.message;}finally{npaySaving=false;loadNpay();}});}
}
const availableEmpty=add('p','',availablePanel,'npay-filter-empty');
function applyView(){for(const [rows,container,empty,none]of [[availableRows,cards,availableEmpty,'참여가능한 링크가 없습니다.'],[completedRows,completedCards,completedEmpty,'아직 완료한 항목이 없습니다.']]){const visible=npayVisibleRows(rows,npayQuery,npayOrder);container.replaceChildren(...visible.map(row=>row.card));container.hidden=!visible.length;empty.hidden=visible.length>0;empty.textContent=rows.length?'검색 결과가 없습니다.':none;}}
searchInput.addEventListener('input',()=>{npayQuery=searchInput.value;applyView();});orderSelect.addEventListener('change',()=>{saveNpayOrder(orderSelect.value);applyView();});applyView();
add('p','금액은 각 출처의 표시 기준 · 지급 미확인',root,'npay-footnote');
add('p',browserLocal?'참여 후 참여완료 버튼을 눌러 주세요. 기록·통계는 이 브라우저에만 저장합니다. 자동 탭 닫기는 로컬 홈페이지 전용입니다.':document.documentElement?.dataset?.npayClaimTimer==='v4'?'포인트 받기를 직접 누른 뒤5초 후 닫기 · 자동 보관':'클릭 기준 닫기에는 최신 Chrome 보조 확장이 필요합니다.',root,'npay-footnote');
if(document.documentElement?.dataset?.npayTabHelper==='ready')add('button','자동 닫기 시험',root,'button-light npay-close-test');
}catch(e){root.replaceChildren();add('p',e.message||'목록을 불러오지 못했습니다. 새로고침해 주세요.',root,'notice');}}
document.querySelector('#npay-refresh').addEventListener('click',loadNpay);loadNpay();setInterval(loadNpay,60000);
document.addEventListener?.('npay-helper-ready',loadNpay);
document.addEventListener?.('personal-records-changed',loadNpay);
document.addEventListener?.('npay-auto-completed',()=>{const elapsed=Number(document.documentElement?.dataset?.npayCloseElapsed);npayMessage=(document.documentElement?.dataset?.npayCompletionKind==='already-participated'?'기참여 항목을 참여완료로 보관했습니다. 신규 적립 통계에는 합산하지 않습니다. ':'참여완료 목록에 자동 보관했습니다. ')+(elapsed>=5000?'버튼 감지 후 '+(elapsed/1000).toFixed(2)+'초에 닫기 요청. ':'')+'포인트 지급 여부는 직접 확인해 주세요.';loadNpay();});







