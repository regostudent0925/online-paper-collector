// 공개 조사 메타데이터의 필드만 새 객체로 구성한다. 원본/사용자 상태를 그대로 복사하지 않는다.
import {CONDITIONS,validInstant} from './core.mjs';
import {directAssessment} from './catalog.mjs';
const queries=new Set(['id','no','board_id','act','seq','p_evnt_sn','p_pageno','evt_info_seq','page','page_no','dataType','rank','pageKey','rankType','sortCompletedAdToLast','mssCode','bbsId','menuNo','board_class','showNotice','pm','menuId','rootId']);
const blocked=/(?:\b01[016789][- .]?\d{3,4}[- .]?\d{4}\b|\b\d{6}-[1-8]\d{6}\b|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\b(?:gh[pousr]_|github_pat_|sk-proj-)[A-Za-z0-9_-]{20,}|-----BEGIN .*PRIVATE KEY-----|[A-Za-z]:\\(?:Users|CodexResearch)\\)/i;
const text=(v,where)=>{if(v==null)return null;if(typeof v!=='string'||v.length>6000||blocked.test(v))throw Error('PUBLIC_TEXT_REJECTED: '+where);return v;};
const strings=(v,where)=>(Array.isArray(v)?v:[]).map(x=>text(x,where));
const bool=v=>typeof v==='boolean'?v:null;
const number=v=>Number.isSafeInteger(v)&&v>=0?v:null;
export function publicUrl(v,{ad=false}={}){
 if(v==null)return null;let u;try{u=new URL(v);}catch{throw Error('PUBLIC_URL_INVALID');}
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||blocked.test(v))throw Error('PUBLIC_URL_REJECTED');
 if(ad){
  const keys=[...u.searchParams.keys()];
  if(u.hostname==='campaign2.naver.com'&&u.pathname==='/npay/v2/click-point/'&&keys.length===1&&/^[\w-]+$/.test(u.searchParams.get('eventId')||''))return u.href;
  if(u.hostname==='ofw.adison.co'&&/^\/u\/naverpay\/ads\/\d+$/.test(u.pathname)&&!u.search)return u.href;
  if(u.hostname==='point.pay.naver.com'&&u.pathname==='/bridge/eventbenefit'&&keys.length===4&&u.searchParams.get('fromPage')==='DETAIL_FROM_BANNER'&&u.searchParams.get('inventory')==='pay>benefit_group'&&u.searchParams.get('placementId')==='benefit_group_pp'&&/^\d+$/.test(u.searchParams.get('adId')||''))return u.href;
  throw Error('PUBLIC_AD_URL_REJECTED');
 }
 if([...u.searchParams.keys()].some(k=>!queries.has(k)))throw Error('PUBLIC_URL_QUERY_REJECTED');
 return u.href;
}
const urls=v=>(Array.isArray(v)?v:[]).map(x=>publicUrl(x));
function event(e){
 const r=e.directReview,p=e.privacy||{},v=e.verification||{},d=e.dates||{};
 return {id:text(e.id,'id'),organizer:text(e.organizer,'organizer'),title:text(e.title,'title'),round:text(e.round,'round'),type:text(e.type,'type'),campaignId:text(e.campaignId,'campaignId'),discoveryUrls:urls(e.discoveryUrls),officialUrl:publicUrl(e.officialUrl),entryUrl:publicUrl(e.entryUrl),dates:{start:text(d.start,'start'),end:text(d.end,'end'),endPrecision:text(d.endPrecision,'endPrecision'),timezone:text(d.timezone,'timezone'),announcement:text(d.announcement,'announcement')},lastCheckedAt:text(e.lastCheckedAt,'lastCheckedAt'),eligibility:{description:text(e.eligibility?.description,'eligibility'),unrestricted:bool(e.eligibility?.unrestricted),userConfirmed:null},conditions:Object.fromEntries(CONDITIONS.map(k=>[k,bool(e.conditions?.[k])])),privacy:{fields:strings(p.fields,'privacy.fields'),purpose:text(p.purpose,'privacy.purpose'),retention:text(p.retention,'privacy.retention'),recipients:text(p.recipients,'privacy.recipients'),processors:text(p.processors,'privacy.processors'),consentReviewed:bool(p.consentReviewed)},prize:{description:text(e.prize?.description,'prize'),count:number(e.prize?.count),method:text(e.prize?.method,'method')},steps:['공식 공고·힌트 및 필수 조건 확인','사용자가 직접 응모'],duplicateRule:text(e.duplicateRule,'duplicateRule'),questions:(e.questions||[]).map(q=>({kind:text(q.kind,'kind'),question:text(q.question,'question'),...(q.options?{options:strings(q.options,'options')}:{}),answerNumber:number(q.answerNumber),answerText:text(q.answerText,'answerText'),verified:bool(q.verified),evidenceUrls:urls(q.evidenceUrls),checkedAt:text(q.checkedAt,'checkedAt'),uncertainties:text(q.uncertainties,'uncertainties')})),userResponseItems:[],automationPolicy:text(e.automationPolicy,'automationPolicy'),verification:{official:bool(v.official),form:bool(v.form),accepting:bool(v.accepting),conditionsComplete:bool(v.conditionsComplete),access:['ok','consent-wall','blocked','login-required','unknown'].includes(v.access)?v.access:'unknown'},...(r?{directReview:{listingApproved:bool(r.listingApproved),officialPeriod:bool(r.officialPeriod),checkedAt:text(r.checkedAt,'directReview.checkedAt'),evidenceUrls:urls(r.evidenceUrls),warnings:['자격·중복 제한·최종 개인정보 및 동의를 제출 전에 직접 확인하세요.']}}:{})};
}
function reward(x){
 return {id:text(x.id,'reward.id'),campaignId:text(x.campaignId,'reward.campaignId'),round:text(x.round,'reward.round'),title:text(x.title,'reward.title'),rewardKey:text(x.rewardKey,'rewardKey'),priorTitles:strings(x.priorTitles,'priorTitles'),action:text(x.action,'action'),adUrl:publicUrl(x.adUrl,{ad:true}),claimedPoints:number(x.claimedPoints),pointBasis:text(x.pointBasis,'pointBasis'),sourceUrl:publicUrl(x.sourceUrl),sourceDate:text(x.sourceDate,'sourceDate'),checkedAt:text(x.checkedAt,'reward.checkedAt'),conditionsText:text(x.conditionsText,'conditionsText'),repeatRule:text(x.repeatRule,'repeatRule'),unknowns:strings(x.unknowns,'unknowns'),listingActive:bool(x.listingActive),verification:{publicPostRead:bool(x.verification?.publicPostRead),officialListingRead:bool(x.verification?.officialListingRead),officialConditions:bool(x.verification?.officialConditions),rewardLinkOpened:false}};
}
export function makePublicCatalog(records,npay,{at=new Date().toISOString()}={}){
 if(!validInstant(at)||!Array.isArray(records)||npay?.schema!=='npay-click-guide-v1'||!Array.isArray(npay.directLinks))throw Error('PUBLIC_INPUT_INVALID');
 const events=records.map(event).filter(e=>directAssessment(e,at).eligible),seen=new Set(),links=npay.directLinks.map(reward).filter(x=>{if(x.listingActive===false||!validInstant(x.checkedAt)||Date.parse(at)-Date.parse(x.checkedAt)>86400000)return false;const key=x.rewardKey||x.adUrl;if(seen.has(key))return false;seen.add(key);return true;});
 const timestamps=[...events.map(e=>e.lastCheckedAt),npay.checkedAt].filter(validInstant);
 const updatedAt=timestamps.sort((a,b)=>Date.parse(b)-Date.parse(a))[0]||null;
 return {schema:'published-event-catalog-v1',updatedAt,events,npay:{schema:'npay-click-guide-v1',checkedAt:text(npay.checkedAt,'npay.checkedAt'),items:[],directLinks:links,missionSource:npay.missionSource?{url:publicUrl(npay.missionSource.url),checkedAt:text(npay.missionSource.checkedAt,'mission.checkedAt'),count:number(npay.missionSource.count),coverage:text(npay.missionSource.coverage,'coverage')}:null}};
}
export function validatePublicCatalog(snapshot){
 if(snapshot?.schema!=='published-event-catalog-v1'||!validInstant(snapshot.updatedAt))throw Error('PUBLIC_SNAPSHOT_INVALID');
 const clean=makePublicCatalog(snapshot.events,snapshot.npay,{at:snapshot.updatedAt});
 if(JSON.stringify(clean)!==JSON.stringify(snapshot))throw Error('PUBLIC_SNAPSHOT_UNEXPECTED_FIELDS');
 return snapshot;
}
