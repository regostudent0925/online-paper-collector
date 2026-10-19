function validInstant(value) {
  if(typeof value!=='string') return false;
  const m=value.match(/^\d{4}-\d\d-\d\dT(\d\d):(\d\d)(?::(\d\d)(?:\.\d{1,3})?)?(Z|[+-](\d\d):(\d\d))$/);
  return Boolean(m && +m[1]<24 && +m[2]<60 && +(m[3]||0)<60 && +(m[5]||0)<=14 && +(m[6]||0)<60 && (+m[5]!==14 || +m[6]===0) && Number.isFinite(Date.parse(value)) && dateOnly(value.slice(0,10)));
}
const dateOnly = v => /^\d{4}-\d\d-\d\d$/.test(v || '') && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().startsWith(v);
const seoulDate = ms => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));

const DAY=86400000;
export const PERIODS=['day','week','month','year'];
export function periodKey(at,period){
 if(!validInstant(at)||!PERIODS.includes(period))throw Error('STATS_PERIOD_INVALID');
 const date=seoulDate(Date.parse(at));
 if(period==='day')return date;
 if(period==='month')return date.slice(0,7);
 if(period==='year')return date.slice(0,4);
 const d=new Date(date+'T00:00:00Z');return new Date(d.getTime()-((d.getUTCDay()+6)%7)*DAY).toISOString().slice(0,10);
}
export function participationRows(state){
 const rows=[],npaySeen=new Set(),eventsSeen=new Set();
 for(const c of state.npayCompletions||[]){
  if(c.completionKind==='already-participated')continue;
  if(!c.completionId||npaySeen.has(c.completionId)||!validInstant(c.completedAt))continue;
  npaySeen.add(c.completionId);const amount=c.snapshot?.claimedPoints;
  rows.push({id:c.completionId,type:'npay',title:c.snapshot?.title||'이름 미확인',at:c.completedAt,points:Number.isSafeInteger(amount)&&amount>=0?amount:null,basis:'참여완료 기준·지급 가정'});
 }
 // 같은 행사·회차를 반복 저장해도 최초 참여 신고 1건만 집계한다.
 for(const d of [...(state.decisions||[])].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))){
  if(d.choice!=='participated'||!validInstant(d.at)||!d.keys?.length||d.keys.some(k=>eventsSeen.has(k)))continue;
  d.keys.forEach(k=>eventsSeen.add(k));rows.push({id:d.key||d.keys[0],type:'event',title:d.title||d.eventSnapshot?.title||'이름 미확인',at:d.at,points:null,basis:'사용자 참여 신고일'});
 }
 return rows.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
}
function totals(rows){const npay=rows.filter(r=>r.type==='npay');return {eventCount:rows.filter(r=>r.type==='event').length,npayCount:npay.length,assumedPoints:npay.reduce((n,r)=>n+(r.points??0),0),unknownPointsCount:npay.filter(r=>r.points===null).length};}
export function statsView(state,at){
 const rows=participationRows(state),periods={};
 for(const period of PERIODS){const groups=new Map();for(const row of rows){const key=periodKey(row.at,period);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}const current=periodKey(at,period);if(!groups.has(current))groups.set(current,[]);periods[period]={current,groups:[...groups].sort(([a],[b])=>b.localeCompare(a)).map(([key,items])=>({key,...totals(items),items}))};}
 return {at,timezone:'Asia/Seoul',weekStartsOn:'Monday',basis:'Npay 참여완료 당시 표시 포인트를 실제 적립된 것으로 가정. 지급 내역을 조회하지 않음. 금액 미확인 및 기참여 안내로 보관한 적립일 미확인 항목은 기간별 합계에서 제외.',eventBasis:'이벤트는 최초 참여 신고일 기준. 공식 화면의 과거 참여 표시만 있고 신고 시각이 없는 항목은 집계하지 않음.',total:totals(rows),periods};
}
export function statsCsv(view,period){if(!PERIODS.includes(period))throw Error('STATS_PERIOD_INVALID');const cell=v=>'"'+String(v).replace(/"/g,'""')+'"';return '\uFEFF'+[['기간','이벤트 참여 건수','Npay 완료 건수','완료 기준 적립액(P)','금액 미확인 건수','집계 기준'],...view.periods[period].groups.map(g=>[g.key,g.eventCount,g.npayCount,g.assumedPoints,g.unknownPointsCount,'참여완료 기준·지급 가정 / 한국시간 / 주간 월요일 시작'])].map(row=>row.map(cell).join(',')).join('\r\n');}


