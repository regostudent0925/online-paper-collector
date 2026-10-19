import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {makePublicCatalog,validatePublicCatalog,publicUrl} from '../src/public-catalog.mjs';import {exportPublic} from '../tools/export-public.mjs';import {buildVercel} from '../tools/build-vercel.mjs';
const at='2026-10-16T09:00:00.000Z',read=name=>JSON.parse(fs.readFileSync(new URL('../examples/data/'+name,import.meta.url),'utf8').replace(/^\uFEFF/,''));
const records=()=>[...read('events.json').events,...read('direct-events.json').events];
test('공개 사본은 참여·계정·동의 결과 및 알 수 없는 필드를 버리고 정답·조건만 남긴다',()=>{
 const es=records(),npay=read('npay.json');for(const e of es){e.userChoice='PRIVATE_CHOICE_9281';e.observedParticipation={status:'already-participated',name:'PRIVATE_NAME_9281'};e.history=[{private:'PRIVATE_HISTORY_9281'}];e.eligibility.userConfirmed=true;e.directReview&&(e.directReview.warnings=['PRIVATE_ACCOUNT_9281']);e.answers={phone:'010-1234-5678'};}
 npay.completed=[{phone:'010-1234-5678',completionId:'PRIVATE_COMPLETION_9281'}];npay.account={token:'PRIVATE_TOKEN_9281'};for(const x of npay.directLinks)x.repeatEligibility={completionId:'PRIVATE_REPEAT_9281'};
 const snapshot=validatePublicCatalog(makePublicCatalog(es,npay,{at})),json=JSON.stringify(snapshot);assert.doesNotMatch(json,/PRIVATE_|010-1234-5678|userChoice|observedParticipation|completionId|repeatEligibility|account|history/);assert.ok(snapshot.events.length>0);assert.ok(snapshot.events.some(x=>x.questions?.some(q=>q.answerText)));assert.ok(snapshot.events.every(x=>x.eligibility.userConfirmed===null));
 const publicOnly=makePublicCatalog(records(),read('npay.json'),{at});assert.equal(json,JSON.stringify(publicOnly));
});
test('개인정보 의심 텍스트·추적 식별자·악성 적립 URL은 내보내기 전에 차단한다',()=>{
 for(const value of ['https://example.com/?request_id=PRIVATE','https://example.com/?token=PRIVATE','https://user:pass@example.com/'])assert.throws(()=>publicUrl(value),/PUBLIC_URL/);
 assert.throws(()=>publicUrl('https://campaign2.naver.com/npay/v2/click-point/?eventId=abc&request_id=PRIVATE',{ad:true}),/PUBLIC_AD_URL/);
 const es=records();es[0].title='테스트 010-1234-5678';assert.throws(()=>makePublicCatalog(es,read('npay.json'),{at}),/PUBLIC_TEXT_REJECTED/);
 const snapshot=makePublicCatalog(records(),read('npay.json'),{at});snapshot.npay.completed=[];assert.throws(()=>validatePublicCatalog(snapshot),/UNEXPECTED_FIELDS/);
});
test('실제 상태를 읽지 않는 내보내기→빌드, 변동 없는 재실행, 개인 통계0',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'public-catalog-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.cpSync(new URL('../examples/data',import.meta.url),path.join(root,'data'),{recursive:true});fs.cpSync(new URL('../ui',import.meta.url),path.join(root,'ui'),{recursive:true});fs.mkdirSync(path.join(root,'state'));fs.writeFileSync(path.join(root,'state/current.json'),'INVALID PRIVATE_STATE_9281');
 const first=exportPublic({rootDir:root,at}),second=exportPublic({rootDir:root,at});assert.equal(first.changed,true);assert.equal(second.changed,false);assert.equal(first.sha256,second.sha256);
 const result=buildVercel({rootDir:root,at});assert.ok(result.eventCount>0);const stats=JSON.parse(fs.readFileSync(path.join(result.out,'_public-data/stats.json'),'utf8'));assert.equal(stats.total.npayCount,0);assert.equal(stats.total.assumedPoints,0);assert.equal(JSON.parse(fs.readFileSync(path.join(result.out,'build-info.json'),'utf8')).dataMode,'daily-public');assert.match(fs.readFileSync(path.join(result.out,'index.html'),'utf8'),/매일 조사한 공개 자료/);
 assert.equal(fs.readFileSync(path.join(root,'state/current.json'),'utf8'),'INVALID PRIVATE_STATE_9281');
});
