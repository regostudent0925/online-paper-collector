// 개인 기록은 이 모듈의 localStorage와 사용자가 내려받는 파일 안에서만 처리한다.
import {statsView,statsCsv} from './record-stats.js';
export const STORAGE_KEY='paper-collector-personal-v1';
const SCHEMA='paper-collector-backup-v1',MAX_BYTES=5*1024*1024,MAX_ROWS=10000;
const fail=()=>{throw Error('백업 형식이 올바르지 않습니다. 기존 기록은 변경하지 않았습니다.');};
const object=x=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
function fields(x,names){if(!object(x)||Object.keys(x).some(k=>!names.includes(k))||names.some(k=>!Object.hasOwn(x,k)))fail();}
function str(x,max=300){if(typeof x!=='string'||!x.trim()||x.length>max||/[\u0000-\u001f]/.test(x))fail();return x;}
function instant(x){const m=typeof x==='string'&&x.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](\d{2}):(\d{2}))$/);if(!m||+m[2]>=24||+m[3]>=60||+m[4]>=60||+(m[5]||0)>14||+(m[6]||0)>=60||+m[5]===14&&+m[6]!==0||!Number.isFinite(Date.parse(x))||!Number.isFinite(Date.parse(m[1]))||new Date(m[1]).toISOString().slice(0,10)!==m[1])fail();return new Date(x).toISOString();}
const key=x=>{if(typeof x!=='string'||!/^[a-f0-9]{64}$/.test(x))fail();return x;};
const empty=()=>({schema:SCHEMA,events:[],npay:[]});
export function validateRecords(input){
 fields(input,['schema','events','npay']);if(input.schema!==SCHEMA||!Array.isArray(input.events)||!Array.isArray(input.npay)||input.events.length+input.npay.length>MAX_ROWS)fail();
 const events=input.events.map(x=>{fields(x,['key','title','round','organizer','choice','recordedAt','participatedAt']);if(!['pending','participated','not-interested'].includes(x.choice))fail();return {key:key(x.key),title:str(x.title),round:str(x.round),organizer:str(x.organizer),choice:x.choice,recordedAt:instant(x.recordedAt),participatedAt:x.participatedAt===null?null:instant(x.participatedAt)};});
 if(new Set(events.map(x=>x.key)).size!==events.length)fail();
 const npay=input.npay.map(x=>{fields(x,['key','identities','title','points','completedAt','completionKind']);if(!Array.isArray(x.identities)||!x.identities.length||x.identities.length>30||x.identities.some(k=>typeof k!=='string'||k.length>500||! /^(family|campaign|title|key):[^\u0000-\u001f]+$/.test(k))||!(x.points===null||Number.isSafeInteger(x.points)&&x.points>=0&&x.points<=100000000)||!['new','already-participated'].includes(x.completionKind))fail();return {key:key(x.key),identities:[...new Set(x.identities)],title:str(x.title),points:x.points,completedAt:instant(x.completedAt),completionKind:x.completionKind};});
 if(new Set(npay.map(x=>x.key)).size!==npay.length)fail();
 return {schema:SCHEMA,events,npay};
}
export function parseBackup(raw){if(typeof raw!=='string'||new TextEncoder().encode(raw).length>MAX_BYTES)fail();let x;try{x=JSON.parse(raw.replace(/^\uFEFF/,''));}catch{fail();}fields(x,['schema','exportedAt','events','npay']);instant(x.exportedAt);return validateRecords({schema:x.schema,events:x.events,npay:x.npay});}
const first=(a,b)=>!a?b:!b?a:Date.parse(a)<=Date.parse(b)?a:b;
const overlaps=(a,b)=>a.key===b.key||a.identities.some(k=>b.identities.includes(k));
export function mergeRecords(current,incoming){
 const a=validateRecords(current),b=validateRecords(incoming),events=new Map(a.events.map(e=>[e.key,e]));
 for(const e of b.events){const old=events.get(e.key);events.set(e.key,old?{...(Date.parse(e.recordedAt)>Date.parse(old.recordedAt)?e:old),participatedAt:first(old.participatedAt,e.participatedAt)}:e);}
 const npay=[];
 // 먼저 완료한 기록을 채택하고 중복 별칭으로 연결된 기록도 하나로 합친다.
 for(const e of [...a.npay,...b.npay].sort((a,b)=>Date.parse(a.completedAt)-Date.parse(b.completedAt)||a.key.localeCompare(b.key))){const matches=npay.filter(x=>overlaps(x,e));if(!matches.length)npay.push(e);else{const keep=matches[0];keep.identities=[...new Set([...keep.identities,...e.identities,...matches.flatMap(x=>x.identities)])];for(const extra of matches.slice(1))npay.splice(npay.indexOf(extra),1);}}
 return validateRecords({schema:SCHEMA,events:[...events.values()],npay});
}
const normalized=x=>String(x||'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
export function rewardIdentities(item){return [...new Set([item.rewardKey&&'family:'+normalized(item.rewardKey),item.campaignId&&'campaign:'+item.campaignId,item.title&&'title:'+normalized(item.title),...(item.priorTitles||[]).map(t=>'title:'+normalized(t)),item.selectionKey&&'key:'+item.selectionKey].filter(Boolean))];}
function archivedEvent(e){return {guideKey:e.key,title:e.title,organizer:e.organizer,round:e.round,type:'simple-entry',conditions:{},eligibility:{},prize:{description:'보관 기록'},dates:{},privacy:{fields:[]},steps:[],questions:[],listingWarnings:[],currentlyOpen:false};}
export class BrowserRecordStore{
 constructor(storage,now=()=>new Date().toISOString()){this.storage=storage;this.now=now;}
 read(){let raw;try{raw=this.storage.getItem(STORAGE_KEY);}catch{throw Error('브라우저 저장소를 사용할 수 없습니다. 저장을 허용한 일반 창에서 이용해 주세요.');}if(raw===null)return empty();try{return validateRecords(JSON.parse(raw));}catch{throw Error('저장된 기록을 읽지 못했습니다. 기존 데이터를 덮어쓰지 않았습니다.');}}
 write(state,previous){const clean=validateRecords(state);try{if(this.storage.getItem(STORAGE_KEY)!==previous)throw Error('CONFLICT');this.storage.setItem(STORAGE_KEY,JSON.stringify(clean));}catch(e){throw Error(e.message==='CONFLICT'?'다른 탭에서 기록이 바뀌었습니다. 새로 읽은 뒤 다시 저장해 주세요.':'브라우저 저장에 실패했습니다. 저장 공간·권한을 확인해 주세요.');}return clean;}
 transact(fn){const before=this.storage.getItem(STORAGE_KEY),state=this.read(),result=fn(state);this.write(state,before);return result;}
 choose(events,selections){const at=this.now();return this.transact(state=>{for(const s of selections){const e=events.find(e=>e.guideKey===s.key);if(!e)fail();const old=state.events.find(x=>x.key===s.key);const row={key:e.guideKey,title:e.title,round:e.round,organizer:e.organizer,choice:s.choice,recordedAt:at,participatedAt:first(old?.participatedAt,s.choice==='participated'?at:null)};state.events=state.events.filter(x=>x.key!==s.key);state.events.push(row);}return {saved:selections.length};});}
 complete(item,completionKind='new'){return this.transact(state=>{const candidate={key:item.selectionKey,identities:rewardIdentities(item),title:item.title,points:Number.isSafeInteger(item.claimedPoints)?item.claimedPoints:null,completedAt:this.now(),completionKind};if(state.npay.some(x=>overlaps(x,candidate)))return {saved:true,alreadyRecorded:true};state.npay.push(candidate);return {saved:true,alreadyRecorded:false};});}
 catalog(data){const state=this.read(),view=structuredClone(data),map=new Map(view.view.events.map(e=>[e.guideKey,e]));for(const r of state.events){const e=map.get(r.key)||archivedEvent(r);e.userChoice=r.choice;e.choiceSource='browser-user-declared';map.set(r.key,e);}view.view.events=[...map.values()];return view;}
 rewards(data){const state=this.read();return {...data,directLinks:data.directLinks.filter(item=>!state.npay.some(c=>overlaps(c,{key:item.selectionKey,identities:rewardIdentities(item)}))),completed:state.npay.map(c=>({title:c.title,claimedPoints:c.points,completedAt:c.completedAt,completionKind:c.completionKind}))};}
 stats(){const state=this.read();return statsView({decisions:state.events.filter(e=>e.participatedAt).map(e=>({keys:[e.key],key:e.key,title:e.title,choice:'participated',at:e.participatedAt})),npayCompletions:state.npay.map(e=>({completionId:e.key,completedAt:e.completedAt,completionKind:e.completionKind,snapshot:{title:e.title,claimedPoints:e.points}}))},this.now());}
 csv(period){return statsCsv(this.stats(),period);}
 export(){return JSON.stringify({...this.read(),exportedAt:this.now()},null,2);}
 import(raw){const incoming=parseBackup(raw);return this.transact(state=>{const merged=mergeRecords(state,incoming);Object.assign(state,merged);return {events:state.events.length,npay:state.npay.length};});}
}
let singleton;
export function browserStore(){return singleton??=new BrowserRecordStore(window.localStorage);}
export function downloadLocal(content,name,type='application/json'){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
