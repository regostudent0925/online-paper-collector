import {createHash} from 'node:crypto';

export const REVIEW_STATES = ['발견','검증 중','조건 충족','확인 보류','제외','종료'];
export const CONDITIONS = ['purchase','payment','deposit','paidMembership','paidShipping','publicComment','channelSubscription','newsletter','follow','like','marketing','login','signup','appInstall','identityVerification'];
export const CONDITION_LABELS = {purchase:'구매',payment:'결제',deposit:'입금',paidMembership:'유료 가입',paidShipping:'유료 배송',publicComment:'공개 댓글',channelSubscription:'채널 구독',newsletter:'뉴스레터 구독',follow:'팔로우',like:'좋아요',marketing:'마케팅 동의',login:'기존 계정 로그인',signup:'신규 가입',appInstall:'앱 설치',identityVerification:'본인인증'};
const EXCLUDE = CONDITIONS.slice(0,9);
export const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function publicURL(value) {
  try {
    const u = new URL(value);
    if(u.protocol !== 'https:' || u.username || u.password || u.port || !u.hostname.includes('.') || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname) || u.hostname.includes(':')) return null;
    if([...u.searchParams.keys()].some(k=>/token|cookie|session|password|email|phone|mobile|name|auth|key/i.test(k))) return null;
    return u;
  } catch { return null; }
}
export function canonical(value) {
  const u = publicURL(value); if(!u) return null;
  u.hash = ''; for(const k of [...u.searchParams.keys()]) if(/^utm_|^(fbclid|gclid|ppck)$/i.test(k)) u.searchParams.delete(k);
  u.searchParams.sort(); return u.href;
}
const textKey = s => String(s ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
function identities(e) {
  const owner = textKey(e.organizer), round = textKey(e.round);
  // No URL-only merge without round: mutable landing pages must never fuse monthly events.
  if(!owner || !round) return [`unique:${e.id}`];
  return [e.campaignId && `campaign:${owner}:${e.campaignId}:${round}`, e.officialUrl && canonical(e.officialUrl) && `url:${owner}:${canonical(e.officialUrl)}:${round}`, e.title && `title:${owner}:${textKey(e.title)}:${round}`].filter(Boolean);
}
export function deduplicate(records) {
  const groups=[];
  for(const raw of records) {
    const e=structuredClone(raw), keys=identities(e);
    const matches=groups.filter(g=>g.keys.some(k=>keys.includes(k)));
    if(!matches.length) groups.push({keys,records:[e]});
    else {
      const first=matches[0]; first.keys=[...new Set([...first.keys,...keys,...matches.flatMap(g=>g.keys)])]; first.records.push(e);
      for(const extra of matches.slice(1)) { first.records.push(...extra.records); groups.splice(groups.indexOf(extra),1); }
    }
  }
  return groups.map(({records})=>{
    const e=records[0];
    e.aliasIds=records.map(r=>r.id);
    e.discoveryUrls=[...new Set(records.flatMap(r=>r.discoveryUrls || []))];
    e.history=records.flatMap(r=>r.history || []);
    const comparable = r => { const c=structuredClone(r); for(const k of ['id','discoveryUrls','history','lastCheckedAt','aliasIds']) delete c[k]; return c; };
    const signatures=new Set(records.map(r=>hash(comparable(r))));
    e.mergeConflict=signatures.size>1;
    if(e.mergeConflict) e.conflictingRecords=records;
    return e;
  });
}
export function validInstant(value) {
  if(typeof value!=='string') return false;
  const m=value.match(/^\d{4}-\d\d-\d\dT(\d\d):(\d\d)(?::(\d\d)(?:\.\d{1,3})?)?(Z|[+-](\d\d):(\d\d))$/);
  return Boolean(m && +m[1]<24 && +m[2]<60 && +(m[3]||0)<60 && +(m[5]||0)<=14 && +(m[6]||0)<60 && (+m[5]!==14 || +m[6]===0) && Number.isFinite(Date.parse(value)) && dateOnly(value.slice(0,10)));
}
const dateOnly = v => /^\d{4}-\d\d-\d\d$/.test(v || '') && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().startsWith(v);
export const seoulDate = ms => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
export function windowState(e,now) {
  const start=e.dates?.start,end=e.dates?.end;
  if(!start || !end) return 'unknown';
  if((dateOnly(start) || dateOnly(end)) && e.dates?.timezone!=='Asia/Seoul') return 'invalid';
  if((!validInstant(start) && !dateOnly(start)) || (!validInstant(end) && !dateOnly(end))) return 'invalid';
  if(start.slice(0,10)>end.slice(0,10)) return 'invalid';
  if(validInstant(start) && validInstant(end) && Date.parse(start)>Date.parse(end)) return 'invalid';
  const today=seoulDate(now);
  if(validInstant(end) ? now>=Date.parse(end) : today>end) return 'closed';
  if(validInstant(start) ? now<Date.parse(start) : today<start) return 'future';
  if(dateOnly(end) && today===end) return 'end-time-unknown';
  if(dateOnly(start) && today===start) return 'start-time-unknown';
  return e.verification?.accepting===true ? 'open' : 'unknown';
}
export function answerIssues(e) {
  if(e.type!=='quiz') return [];
  const qs=e.questions;
  if(!Array.isArray(qs) || !qs.length) return ['정답형 문항 미확인'];
  return qs.flatMap(q=>{
    if(q.kind!=='factual') return ['정답형/의견형 구분 확인 필요'];
    if(!q.question || !q.answerText || !q.verified || !q.evidenceUrls?.length || q.evidenceUrls.some(u=>!publicURL(u)) || !validInstant(q.checkedAt)) return ['정답 또는 공식 근거 미확인'];
    if(Array.isArray(q.options) && (q.answerNumber<1 || q.options[q.answerNumber-1]!==q.answerText)) return ['선택지 순서와 정답 내용 불일치'];
    return [];
  });
}
export function classify(e,at=new Date().toISOString()) {
  if(!validInstant(at)) throw Error('NOW_REQUIRES_TIMEZONE');
  const now=Date.parse(at), reasons=[], warnings=[];
  const condition=e.conditions || {}, v=e.verification || {};
  const excluded=EXCLUDE.filter(k=>condition[k]===true);
  const window=windowState(e,now);
  if(window==='closed') return {reviewStatus:'종료',bucket:'종료',reasons:['공식 접수 기간 종료',...excluded.map(k=>'필수 조건: '+CONDITION_LABELS[k])],warnings,window,participationStatus:'미참여',submissionEvidence:null};
  if(excluded.length) return {reviewStatus:'제외',bucket:'제외',reasons:excluded.map(k=>'제외 필수 조건: '+CONDITION_LABELS[k]),warnings,window,participationStatus:'미참여',submissionEvidence:null};
  if(e.mergeConflict) reasons.push('중복 자료의 조건 충돌: 원문 재검증 필요');
  if(v.access==='already-participated-notice') reasons.push('응모 폼에 이미 참여 안내: 과거 참여·중복 제한 확인 필요');
  if(!e.round || !e.organizer || !e.title) reasons.push('주최사·행사·회차 누락');
  if(!publicURL(e.officialUrl) || !publicURL(e.entryUrl)) reasons.push('공식 공고 또는 응모 URL 미확인');
  if(v.official!==true || v.form!==true || v.conditionsComplete!==true || v.access!=='ok') reasons.push('공식 공고·응모 폼·필수 조건 검증 미완료');
  if(!validInstant(e.lastCheckedAt) || Date.parse(e.lastCheckedAt)>now || now-Date.parse(e.lastCheckedAt)>86400000) reasons.push('검증 시각 미확인 또는 24시간 경과: 재확인 필요');
  if(window!=='open') reasons.push(({future:'접수 시작 전',invalid:'기간 또는 시간대 오류','end-time-unknown':'마감 당일 종료 시각 미확인','start-time-unknown':'시작 당일 개시 시각 미확인',unknown:'현재 접수 여부·기간 미확인'})[window]);
  for(const key of CONDITIONS) if(typeof condition[key]!=='boolean') reasons.push('필수 조건 미확인: '+CONDITION_LABELS[key]);
  if(condition.like===true) reasons.push('필수 좋아요 조건: 사용자 판단 필요');
  if(condition.marketing===true) reasons.push('필수 마케팅 동의: 사용자 별도 판단 필요');
  if(e.eligibility?.userConfirmed!==true) reasons.push('사용자 자격 확인 필요: '+(e.eligibility?.description || '미확인'));
  const p=e.privacy;
  if(!p || !Array.isArray(p.fields) || !p.fields.length || !p.purpose || !p.retention || !p.recipients || !p.processors || p.consentReviewed!==true) reasons.push('개인정보 항목·목적·보유기간·제공/위탁·동의 확인 필요');
  if(!e.prize?.method || !['guaranteed','first-come','lottery','judged'].includes(e.prize.method)) reasons.push('선정 방식 미확인');
  if(!e.duplicateRule) reasons.push('중복 참여 제한 미확인');
  reasons.push(...answerIssues(e));
  if(e.type==='quiz' && e.questions?.some(q=>!validInstant(q.checkedAt) || Date.parse(q.checkedAt)>now || now-Date.parse(q.checkedAt)>86400000)) reasons.push('정답 확인 시각 재검증 필요');
  if(!validInstant(e.dates?.end)) warnings.push('마감 시각 미공개: 자정으로 가정하지 않음');
  if(e.userResponseItems?.length) warnings.push('본인의 실제 경험·의견 응답 필요');
  if(e.automationPolicy!=='allowed') warnings.push('향후 자동 제출 허용 여부 미확인 또는 금지');
  if(e.type==='survey' && e.questions?.some(q=>q.answerText)) reasons.push('설문에 정답 자동 부여 금지');
  const status=reasons.length?'확인 보류':'조건 충족';
  return {reviewStatus:status,bucket:condition.marketing===true?'마케팅 별도 검토':status,reasons:[...new Set(reasons)],warnings,window,participationStatus:'미참여',submissionEvidence:null};
}
export function review(records,at,previous=[]) {
  const old=new Map(previous.map(e=>[e.id,e]));
  return deduplicate(records).map(e=>{
    const result=classify(e,at), prior=old.get(e.id);
    const fingerprint=hash(e), history=[...(e.history || [])];
    if(prior) for(const item of prior.history || []) if(!history.some(h=>hash(h)===hash(item))) history.push(item);
    if(!prior || prior.fingerprint!==fingerprint || prior.reviewStatus!==result.reviewStatus) history.push({at,action:prior?'재판정':'최초 판정',before:prior?.reviewStatus ?? null,after:result.reviewStatus,fingerprint,reasons:result.reasons});
    return {...e,...result,fingerprint,history};
  });
}
