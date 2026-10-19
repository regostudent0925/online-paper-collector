import test from 'node:test';import assert from 'node:assert/strict';
import {BrowserRecordStore,STORAGE_KEY,parseBackup,mergeRecords,rewardIdentities} from '../ui/browser-records.js';
const at='2026-10-19T00:05:00.000Z',a='a'.repeat(64),b='b'.repeat(64),c='c'.repeat(64);
const event={guideKey:a,title:'가상 퀴즈',round:'2026-10',organizer:'가상 기관'};
const item={selectionKey:b,title:'가상 클릭',claimedPoints:15,rewardKey:'mock-click',campaignId:'mock-1'};
function setup(){const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};return {data,storage,store:new BrowserRecordStore(storage,()=>at)};}
test('브라우저별 격리·새로고침 유지·회차 분리·종료 목록에서도 기록 보존',()=>{
 const x=setup(),other=setup();x.store.choose([event],[{key:a,choice:'participated'}]);const reload=new BrowserRecordStore(x.storage,()=>at);assert.equal(reload.catalog({view:{events:[event]}}).view.events[0].userChoice,'participated');assert.equal(other.store.stats().total.eventCount,0);assert.equal(reload.catalog({view:{events:[]}}).view.events[0].currentlyOpen,false);assert.equal(reload.catalog({view:{events:[{...event,guideKey:c,round:'2026-11'}]}}).view.events[0].userChoice,undefined);
});
test('링크 열기만으로 완료하지 않으며 수동 완료 중복·별칭 재노출을 막는다',()=>{
 const {store}=setup();assert.equal(store.rewards({directLinks:[item]}).directLinks.length,1);store.complete(item);store.complete(item);assert.equal(store.stats().total.npayCount,1);assert.equal(store.stats().total.assumedPoints,15);assert.equal(store.rewards({directLinks:[{...item,selectionKey:c,campaignId:'new-date'}]}).directLinks.length,0);assert.equal(store.rewards({directLinks:[]}).completed.length,1);assert.ok(rewardIdentities(item).includes('family:mock-click'));
});
test('JSON 왕복 복원·미관심·금액미확인·기참여 처리 및 중복 가져오기 통계 일치',()=>{
 const a=setup(),b=setup();a.store.choose([event],[{key:event.guideKey,choice:'not-interested'}]);a.store.complete(item);a.store.complete({...item,title:'가상 미확인',rewardKey:'unknown',campaignId:'unknown',selectionKey:c,claimedPoints:null});const raw=a.store.export();assert.equal(parseBackup(raw).events[0].choice,'not-interested');b.store.import(raw);b.store.import(raw);assert.deepEqual(b.store.stats(),a.store.stats());assert.equal(b.store.stats().total.unknownPointsCount,1);assert.match(b.store.csv('month'),/15/);const x=setup();x.store.complete(item,'already-participated');assert.equal(x.store.rewards({directLinks:[]}).completed.length,1);assert.equal(x.store.stats().total.npayCount,0);
});
test('한국시간 일간·월간·연간 경계와 주간 월요일 집계가 동일하다',()=>{
 const {store}=setup();store.complete(item);const stats=store.stats();for(const period of ['day','week','month','year'])assert.equal(stats.periods[period].groups[0].assumedPoints,15);assert.equal(stats.periods.day.current,'2026-10-19');assert.equal(stats.periods.week.current,'2026-10-19');assert.equal(stats.periods.month.current,'2026-10');assert.equal(stats.periods.year.current,'2026');
});
test('악성·잘못된·미지원·과대 백업은 저장을 바꾸지 않는다',()=>{
 const {store,storage}=setup();store.complete(item);const before=storage.getItem(STORAGE_KEY),valid=JSON.parse(store.export());
 const invalids=['bad json',JSON.stringify({...valid,schema:'v999'}),JSON.stringify({...valid,phone:'010-0000-0000'}),JSON.stringify({...valid,npay:[{...valid.npay[0],points:-1}]}),JSON.stringify({...valid,npay:[{...valid.npay[0],completedAt:'2026-10-19'}]}),JSON.stringify({...valid,npay:[{...valid.npay[0],key:'__proto__'}]}),' '.repeat(5*1024*1024+1)];
 for(const raw of invalids){assert.throws(()=>store.import(raw));assert.equal(storage.getItem(STORAGE_KEY),before);}
});
test('저장소 차단·용량 부족·손상 데이터는 저장 성공으로 보고하지 않는다',()=>{
 const x=setup();x.storage.setItem=()=>{throw Error('quota');};assert.throws(()=>x.store.complete(item),/저장에 실패/);assert.equal(x.store.stats().total.npayCount,0);x.data.set(STORAGE_KEY,'damaged');assert.throws(()=>x.store.complete(item),/덮어쓰지/);assert.equal(x.data.get(STORAGE_KEY),'damaged');const blocked=new BrowserRecordStore({getItem(){throw Error('denied');}});assert.throws(()=>blocked.read(),/사용할 수 없/);
});
test('병합은 최신 상태와 최초 참여일을 보존하며 별칭이 겹친 Npay를 한 번 집계한다',()=>{
 const x=setup();x.store.choose([event],[{key:a,choice:'participated'}]);x.store.complete(item);const original=x.store.read(),next=structuredClone(original);next.events[0].choice='not-interested';next.events[0].recordedAt='2026-10-20T00:00:00Z';next.npay[0].key=c;next.npay[0].completedAt='2026-10-20T00:00:00Z';const merged=mergeRecords(original,next);assert.equal(merged.events[0].choice,'not-interested');assert.equal(merged.events[0].participatedAt,at);assert.equal(merged.npay.length,1);assert.equal(merged.npay[0].completedAt,at);assert.equal(mergeRecords(merged,next).npay.length,1);
});
