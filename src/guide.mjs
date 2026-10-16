import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {CONDITIONS,canonical,deduplicate,hash,validInstant,seoulDate,windowState,answerIssues} from './core.mjs';
export const CHOICES=['pending','participated','not-interested'];
export const CHOICE_LABELS={pending:'미참여·나중에 참여',participated:'참여했음', 'not-interested':'참여 의사 없음'};
export const iso = at=>{if(!validInstant(at))throw Error('TIMEZONE_REQUIRED');return new Date(at).toISOString();};
const normalized=s=>String(s || '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
export function eventKeys(e) {
  if(!e.organizer || !e.round || !e.title) throw Error('IDENTITY_INCOMPLETE');
  const scope=normalized(e.organizer)+'|'+normalized(e.round)+'|';
  return [e.campaignId && 'campaign:'+e.campaignId,canonical(e.officialUrl) && 'url:'+canonical(e.officialUrl),'title:'+normalized(e.title)].filter(Boolean).map(v=>hash(scope+v));
}
export function nextDay(at) {return seoulDate(Date.parse(seoulDate(Date.parse(iso(at)))+'T00:00:00+09:00')+86400000);}
export function effectiveDecision(e,state,at) {
  const keys=eventKeys(e),today=seoulDate(Date.parse(iso(at)));
  return [...state.decisions].reverse().find(d=>d.effectiveDate<=today && d.keys.some(k=>keys.includes(k))) || null;
}
export function guideAssessment(e,at) {
  const reasons=[];
  if(!['quiz','simple-entry'].includes(e.type)) reasons.push('간단 응모·정답형 퀴즈 범위 아님');
  const c=e.conditions || {},v=e.verification || {};
  for(const k of CONDITIONS.slice(0,9)) if(c[k]===true)reasons.push('필수 제외 조건: '+k);
  if(c.marketing===true)reasons.push('필수 마케팅 동의: 별도 검토');
  if(c.like===true)reasons.push('좋아요 조건 별도 검토');
  for(const k of ['signup','appInstall','identityVerification'])if(c[k]===true)reasons.push('단순 입력 외 조건: '+k);
  if(e.mergeConflict)reasons.push('중복 자료 충돌');
  if(v.official!==true || v.form!==true || v.conditionsComplete!==true || v.access!=='ok')reasons.push('최종 공고·폼 필수 조건 미확인');
  if(CONDITIONS.some(k=>typeof c[k]!=='boolean'))reasons.push('일부 필수 조건 미확인');
  if(!canonical(e.officialUrl) || !canonical(e.entryUrl))reasons.push('공식·응모 URL 미확인');
  if(windowState(e,Date.parse(at))!=='open')reasons.push('현재 접수 여부·시각 미확인 또는 종료');
  if(!validInstant(e.lastCheckedAt)||Date.parse(e.lastCheckedAt)>Date.parse(at)||Date.parse(at)-Date.parse(e.lastCheckedAt)>86400000)reasons.push('24시간 내 조건 재확인 필요');
  if(!e.privacy?.consentReviewed || !e.privacy.fields?.length || !e.privacy.purpose || !e.privacy.retention)reasons.push('최종 개인정보 동의문 미확인');
  reasons.push(...answerIssues(e));
  if(e.type==='quiz' && e.questions?.some(q=>Date.parse(q.checkedAt)>Date.parse(at)||Date.parse(at)-Date.parse(q.checkedAt)>86400000))reasons.push('정답 재확인 필요');
  try{eventKeys(e);}catch{reasons.push('회차 식별 미확인');}
  return {eligible:reasons.length===0,reasons};
}
export class GuideStore {
  constructor(directory){this.directory=path.resolve(directory);fs.mkdirSync(path.join(this.directory,'revisions'),{recursive:true});fs.mkdirSync(path.join(this.directory,'batches'),{recursive:true});}
  load(){const p=path.join(this.directory,'current.json');return fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):{version:1,revision:0,decisions:[],batches:[]};}
  transact(fn){
    const lock=path.join(this.directory,'write.lock');let fd;
    try{fd=fs.openSync(lock,'wx');}catch{throw Error('STATE_BUSY_RETRY');}
    try{
      const state=this.load(),result=fn(state);state.revision++;
      const bytes=JSON.stringify(state,null,2)+'\n';
      fs.writeFileSync(path.join(this.directory,'revisions',String(state.revision).padStart(6,'0')+'-'+randomUUID()+'.json'),bytes,{flag:'wx'});
      const temp=path.join(this.directory,randomUUID()+'.tmp');fs.writeFileSync(temp,bytes,{flag:'wx'});fs.renameSync(temp,path.join(this.directory,'current.json'));
      return result;
    }finally{fs.closeSync(fd);fs.unlinkSync(lock);}
  }
  batch(id){if(!/^[a-f0-9]{24}$/.test(id))throw Error('BATCH_INVALID');return JSON.parse(fs.readFileSync(path.join(this.directory,'batches',id+'.json'),'utf8'));}
  prepare(records,at,{assess=guideAssessment}={}){
    at=iso(at);const date=seoulDate(Date.parse(at));
    return this.transact(state=>{
      const existing=state.batches.find(b=>b.date===date && b.publishedAt);
      if(existing)return {...existing,reused:true,batch:this.batch(existing.id)};
      const priorKeys=new Set(state.batches.filter(b=>b.publishedAt).flatMap(b=>this.batch(b.id).events.flatMap(eventKeys)));
      const included=[],withheld=[];
      for(const e of deduplicate(records)){
        const assessment=assess(e,at);
        if(!assessment.eligible){withheld.push({id:e.id,title:e.title,reasons:assessment.reasons});continue;}
        if(e.observedParticipation?.status==='already-participated'){withheld.push({id:e.id,title:e.title,reasons:['공식 응모 화면에서 이미 참여한 설문으로 표시됨']});continue;}
        const decision=effectiveDecision(e,state,at);
        if(decision && decision.choice!=='pending'){withheld.push({id:e.id,title:e.title,reasons:['사용자 선택으로 제외: '+CHOICE_LABELS[decision.choice]]});continue;}
        included.push({...e,listingTier:assessment.tier||'조건 확인',listingWarnings:assessment.warnings||[],guideKey:eventKeys(e)[0],guideNumber:included.length+1,guideKind:eventKeys(e).some(k=>priorKeys.has(k))?'재안내':'처음 안내'});
      }
      const id=hash({date,at,included:included.map(e=>e.guideKey)}).slice(0,24);
      const retry=state.batches.find(b=>b.id===id);if(retry)return {...retry,reused:true,batch:this.batch(id)};
      const batch={id,date,preparedAt:at,events:included,withheld};
      fs.writeFileSync(path.join(this.directory,'batches',id+'.json'),JSON.stringify(batch,null,2)+'\n',{flag:'wx'});
      const entry={id,date,preparedAt:at,publishedAt:null,reminderDueAt:null,reminderSentAt:null};state.batches.push(entry);
      return {...entry,batch};
    });
  }
  publish(id,at){at=iso(at);return this.transact(state=>{
    const b=state.batches.find(b=>b.id===id);if(!b)throw Error('BATCH_UNKNOWN');
    if(state.batches.some(other=>other.date===b.date && other.id!==id && other.publishedAt))throw Error('DAY_ALREADY_PUBLISHED');
    if(b.publishedAt)return b;if(Date.parse(at)<Date.parse(b.preparedAt))throw Error('PUBLICATION_BEFORE_PREPARATION');
    b.publishedAt=at;b.reminderDueAt=new Date(Date.parse(at)+1800000).toISOString();return b;
  });}
  select(id,selections,at){
    at=iso(at);if(!Array.isArray(selections)||!selections.length||selections.length>100)throw Error('CHOICES_INVALID');
    const batch=this.batch(id),events=new Map(batch.events.map(e=>[e.guideKey,e]));
    if(selections.some(s=>!events.has(s.key)||!CHOICES.includes(s.choice))||new Set(selections.map(s=>s.key)).size!==selections.length)throw Error('CHOICES_INVALID');
    return this.transact(state=>{
      const b=state.batches.find(b=>b.id===id);if(!b?.publishedAt)throw Error('BATCH_NOT_PUBLISHED');
      if(Date.parse(at)<Date.parse(b.publishedAt))throw Error('SELECTION_BEFORE_PUBLICATION');
      for(const s of selections){const e=events.get(s.key);state.decisions.push({batchId:id,key:s.key,keys:eventKeys(e),title:e.title,round:e.round,choice:s.choice,at,effectiveDate:nextDay(at),source:'user-declared',submissionEvidence:null});}
      return {saved:selections.length,effectiveDate:nextDay(at),selections};
    });
  }
  view(id){const state=this.load();const entry=id?state.batches.find(b=>b.id===id):[...state.batches].reverse().find(b=>b.publishedAt);if(!entry)return null;
    const batch=this.batch(entry.id);return {...entry,events:batch.events.map(e=>({...e,userChoice:[...state.decisions].reverse().find(d=>d.keys.some(k=>eventKeys(e).includes(k)))?.choice || null})),withheld:batch.withheld};
  }
  due(at){at=iso(at);const state=this.load();const due=state.batches.filter(b=>b.publishedAt && !b.reminderSentAt && Date.parse(b.reminderDueAt)<=Date.parse(at)).map(b=>this.view(b.id)).filter(b=>b.events.some(e=>!e.userChoice||e.userChoice==='pending'));
    const latest=[...state.batches].reverse().find(b=>b.publishedAt);
    return due.filter(b=>b.id===latest?.id).map(b=>({...b,events:b.events.filter(e=>!e.userChoice||e.userChoice==='pending')}));
  }
  markReminder(id,at){at=iso(at);return this.transact(state=>{const b=state.batches.find(b=>b.id===id);if(!b?.publishedAt||Date.parse(at)<Date.parse(b.reminderDueAt))throw Error('REMINDER_NOT_DUE');b.reminderSentAt ||= at;return b;});}
}
