import {deduplicate,canonical,windowState,validInstant,CONDITIONS,answerIssues} from './core.mjs';
import {guideAssessment,eventKeys,CHOICES,nextDay,iso} from './guide.mjs';

export function directAssessment(e,at){
  const strict=guideAssessment(e,at);if(strict.eligible)return {eligible:true,tier:'조건 확인',warnings:[]};
  const r=e.directReview,c=e.conditions||{},reasons=[];
  if(!r?.listingApproved||!r?.officialPeriod||!r?.evidenceUrls?.length)return {eligible:false,reasons:strict.reasons};
  if(!['quiz','simple-entry'].includes(e.type))reasons.push('간단 응모·퀴즈 범위 아님');
  for(const key of CONDITIONS.slice(0,9))if(c[key]===true)reasons.push('필수 제외 조건: '+key);
  if(c.marketing===true)reasons.push('필수 마케팅 동의: 별도 판단 필요');
  if(c.like===true)reasons.push('좋아요 필수 조건 별도 판단');
  if(!canonical(e.officialUrl)||!canonical(e.entryUrl)||e.mergeConflict)reasons.push('공식 URL·중복 자료 확인 필요');
  if(windowState(e,Date.parse(at))!=='open')reasons.push('현재 접수 시각 미확인 또는 종료');
  if(!validInstant(r.checkedAt)||Date.parse(r.checkedAt)>Date.parse(at)||Date.parse(at)-Date.parse(r.checkedAt)>86400000)reasons.push('24시간 내 공고 재확인 필요');
  try{eventKeys(e);}catch{reasons.push('회차 미확인');}
  const warnings=[...(r.warnings||[])];
  if(!e.verification?.conditionsComplete||!e.privacy?.consentReviewed)warnings.push('최종 개인정보·동의 화면은 본인이 제출 전에 확인해야 합니다.');
  if(CONDITIONS.some(k=>typeof c[k]!=='boolean'))warnings.push('일부 필수 조건이 공개 화면에서 미확인입니다. 조건이 맞을 때만 참여하세요.');
  if(answerIssues(e).length)warnings.push('일부 퀴즈 정답·근거는 미확인입니다.');
  return {eligible:!reasons.length,tier:'조건부 · 직접 확인',warnings:[...new Set(warnings)],reasons};
}
const decisionFor=(e,state)=>[...state.decisions].reverse().find(d=>d.keys.some(k=>eventKeys(e).includes(k)));
export function statusOf(e){return e.userChoice==='participated'?'participated':e.userChoice==='not-interested'?'not-interested':'available';}
export function catalogView(store,records,at){
  const state=store.load(),events=[],withheld=[];
  const history=[];for(const d of state.decisions)if(d.eventSnapshot)history.push(d.eventSnapshot);
  for(const b of state.batches.filter(b=>b.publishedAt)){try{history.push(...store.batch(b.id).events);}catch{}}
  const source=new Map(records.map(e=>[e.id,e]));for(const e of history)if(!source.has(e.id))source.set(e.id,e);
  for(const e of deduplicate([...source.values()])){
    let choice;try{choice=decisionFor(e,state)?.choice||null;}catch{withheld.push({id:e.id,title:e.title,reasons:['회차 식별 미확인']});continue;}
    const a=directAssessment(e,at);
    const site=e.observedParticipation?.status==='already-participated'?'participated':null;
    if(!a.eligible && !choice && !site){withheld.push({id:e.id,title:e.title,reasons:a.reasons||[]});continue;}
    // 기록 탭은 접수 종료/검증 만료 뒤에도 유지. 참여가능 목록에서는 별도로 숨긴다.
    const row={...e,guideKey:eventKeys(e)[0],guideNumber:events.length+1,userChoice:choice||site,choiceSource:choice?'user-declared':site?'official-page':null,listingTier:a.tier||'기록',listingWarnings:a.warnings||[],currentlyOpen:a.eligible,observedAt:e.observedParticipation?.at};
    if(!a.eligible && statusOf(row)==='available'){withheld.push({id:e.id,title:e.title,reasons:a.reasons||[]});continue;}
    events.push(row);
  }
  events.sort((a,b)=>(a.listingTier==='조건 확인'?0:1)-(b.listingTier==='조건 확인'?0:1)||String(a.dates.end).localeCompare(String(b.dates.end)));
  return {id:'catalog',publishedAt:state.batches.filter(b=>b.publishedAt).at(-1)?.publishedAt||null,updatedAt:at,events,withheld};
}
export function selectCatalog(store,records,selections,at){
  at=iso(at);const view=catalogView(store,records,at),allowed=new Map(view.events.map(e=>[e.guideKey,e]));
  if(!Array.isArray(selections)||!selections.length||selections.length>100||new Set(selections.map(s=>s.key)).size!==selections.length||selections.some(s=>!allowed.has(s.key)||!CHOICES.includes(s.choice)))throw Error('CHOICES_INVALID');
  return store.transact(state=>{for(const s of selections){const e=allowed.get(s.key);state.decisions.push({batchId:'catalog',key:s.key,keys:eventKeys(e),title:e.title,round:e.round,choice:s.choice,at,effectiveDate:nextDay(at),source:'user-declared',submissionEvidence:null,eventSnapshot:e});}return {saved:selections.length,effectiveDate:nextDay(at),selections};});
}
