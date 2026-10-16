import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {previewServer} from '../src/preview.mjs';
import {review} from '../src/core.mjs';
const root=new URL('../',import.meta.url);
test('실제 공개 조사 데이터 9건: 보류6·제외2·종료1, 제출 증거 없음',()=>{
  const data=JSON.parse(fs.readFileSync(new URL('data/events.json',root),'utf8'));
  const rows=review(data.events,'2026-10-16T11:36:00+09:00');
  assert.equal(rows.length,9);
  assert.deepEqual(rows.reduce((o,e)=>(o[e.reviewStatus]=(o[e.reviewStatus]||0)+1,o),{}),{'확인 보류':6,'제외':2,'종료':1});
  assert.ok(rows.every(e=>e.participationStatus==='미참여' && e.submissionEvidence===null));
});
test('실제 후보에서 다음날 재실행 시 검증 만료로 보류',()=>{
  const data=JSON.parse(fs.readFileSync(new URL('data/events.json',root),'utf8'));
  const latestCheck=Math.max(...data.events.map(e=>Date.parse(e.lastCheckedAt)));
  const expiredAt=new Date(latestCheck+25*60*60*1000).toISOString();
  assert.ok(review(data.events,expiredAt).filter(e=>e.reviewStatus==='확인 보류').every(e=>e.reasons.some(r=>r.includes('24시간'))));
});
test('CLI에서 제출 명령·비 dry-run 인자 거부',()=>{
  for(const args of [['submit'],['review','--submit'],['review','--dry-run','false']]) {
    const r=spawnSync(process.execPath,[new URL('src/cli.mjs',root).pathname.replace(/^\/([A-Za-z]:)/,'$1'),...args],{encoding:'utf8'});
    assert.equal(r.status,1);assert.ok(/UNKNOWN_OPTION|COMMANDS/.test(r.stderr));
  }
});
test('미리보기 실제 HTTP: GET 읽기, POST 405, 임의 파일 404',async()=>{
  const server=previewServer('<h1>가상 검토표</h1>','{"dryRun":true}');
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const url='http://127.0.0.1:'+server.address().port;
    const page=await fetch(url);assert.equal(page.status,200);assert.ok((await page.text()).includes('가상 검토표'));
    assert.equal((await fetch(url,{method:'POST',body:'FAKE'})).status,405);
    assert.equal((await fetch(url+'/package.json')).status,404);
    assert.equal((await (await fetch(url+'/review.json')).json()).dryRun,true);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
