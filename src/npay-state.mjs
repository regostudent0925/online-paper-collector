import {randomUUID} from 'node:crypto';
import {validInstant,hash} from './core.mjs';
import {npayView} from './npay.mjs';
const normalized=v=>String(v||'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
// 게시일·회차는 완료 식별자에 쓰지 않는다. 새 게시글만으로 완료가 해제되면 안 된다.
export function rewardKeys(item){
  let u;try{u=new URL(item.adUrl||item.officialUrl);}catch{throw Error('NPAY_IDENTITY_INVALID');}
  const scope=['campaign2.naver.com','point.pay.naver.com'].includes(u.hostname)?'naver-click':u.hostname;
  return [item.rewardKey&&'family:'+normalized(item.rewardKey),item.campaignId&&'campaign:'+scope+':'+item.campaignId,'url:'+u.href,item.title&&'title:'+scope+':'+normalized(item.title),...(item.priorTitles||[]).map(title=>'title:'+scope+':'+normalized(title))].filter(Boolean).map(hash);
}
function latestCompletion(item,completions){const keys=rewardKeys(item);return [...completions].reverse().find(c=>c.keys.some(k=>keys.includes(k)));}
export function repeatConfirmed(item,completion,at){
  const p=item.repeatEligibility;if(!p||p.verified!==true||p.completionId!==completion.completionId||!p.rule)return false;
  if(![at,p.checkedAt,p.availableFrom,p.availableUntil].every(validInstant))return false;
  const now=Date.parse(at),checked=Date.parse(p.checkedAt),from=Date.parse(p.availableFrom),until=Date.parse(p.availableUntil);
  if(checked< Date.parse(completion.completedAt)||checked>now||now-checked>86400000||from<=Date.parse(completion.completedAt)||now<from||now>=until)return false;
  try{const u=new URL(p.sourceUrl);if(u.protocol!=='https:'||u.username||u.password||!['naver.com','adison.co'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h))||u.pathname.includes('click-point')||u.pathname.includes('/naverpay/ads/'))return false;}catch{return false;}
  return p.accepting===true;
}
export function npayCatalog(data,state,at){
  const view=npayView(data,at),completions=state.npayCompletions||[],available=[],seen=new Set();
  const candidates=[...(view.directLinks||[]),...view.items.map(i=>({...i,adUrl:i.adUrl||i.officialUrl,claimedPoints:i.points,conditionsText:i.repeatRule,unknowns:[]}))];
  for(const item of candidates){if(item.listingActive===false)continue;let keys;try{keys=rewardKeys(item);}catch{continue;}
    const identity=item.adUrl;if(seen.has(identity))continue;seen.add(identity);
    const completion=latestCompletion(item,completions);
    if(!completion||repeatConfirmed(item,completion,at))available.push({...item,selectionKey:hash(keys[0]),repeatConfirmed:!!completion,repeatExplanation:completion?item.repeatEligibility.rule:null});
  }
  // 새 발견 목록에서 빠진 광고도 완료 시점의 공개 설명과 함께 보존한다.
  const completed=[];const used=new Set();
  for(const c of [...completions].reverse()){if(c.keys.some(k=>used.has(k)))continue;c.keys.forEach(k=>used.add(k));completed.push({...c.snapshot,completedAt:c.completedAt,completionId:c.completionId,completionKind:c.completionKind,reentryStatus:available.some(i=>i.repeatConfirmed&&rewardKeys(i).some(k=>c.keys.includes(k)))?'재적립 조건 확인 · 참여가능 목록에 표시':'재적립 미확인 · 참여가능에서 제외',source:c.source||'user-declared',submissionEvidence:null});}
  return {...view,items:[],directLinks:available,completed,at};
}
export function completeNpay(store,data,key,at,{trigger='manual',attemptId=null,completionKind='new'}={}){
  if(!validInstant(at)||typeof key!=='string'||!/^[a-f0-9]+$/.test(key))throw Error('NPAY_CHOICE_INVALID');
  if(!['manual','tab-closed'].includes(trigger)||(trigger==='tab-closed'&&!/^[a-f0-9-]{36}$/.test(attemptId||'')))throw Error('NPAY_CHOICE_INVALID');
  if(!['new','already-participated'].includes(completionKind)||(completionKind==='already-participated'&&trigger!=='tab-closed'))throw Error('NPAY_CHOICE_INVALID');
  return store.transact(state=>{
    if(attemptId&&(state.npayCompletions||[]).some(c=>c.attemptId===attemptId&&c.selectionKey===key))return {saved:true,alreadyRecorded:true};
    const item=npayCatalog(data,state,at).directLinks.find(i=>i.selectionKey===key);
    if(!item){const existing=(state.npayCompletions||[]).find(c=>c.selectionKey===key);if(existing)return {saved:true,alreadyRecorded:true};throw Error('NPAY_CHOICE_INVALID');}
    const {selectionKey,repeatConfirmed:repeat,repeatExplanation,...snapshot}=item;
    state.npayCompletions??=[];
    state.npayCompletions.push({completionId:randomUUID(),selectionKey,keys:rewardKeys(item),completedAt:new Date(at).toISOString(),snapshot,source:trigger==='tab-closed'?'user-authorized-tab-close':'user-declared',attemptId,completionKind,earnedAt:completionKind==='already-participated'?null:undefined,submissionEvidence:null});
    return {saved:true,alreadyRecorded:false};
  });
}

