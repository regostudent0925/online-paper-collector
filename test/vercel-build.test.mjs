import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {buildVercel} from '../tools/build-vercel.mjs';

test('공개 배포는 개인 저장소를 읽지 않고 공개 예제와 빈 통계만 출력한다',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'event-web-build-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const name of ['ui','examples'])fs.cpSync(new URL('../'+name,import.meta.url),path.join(root,name),{recursive:true});
 for(const name of ['data','state']){fs.mkdirSync(path.join(root,name));fs.writeFileSync(path.join(root,name,'private.json'),'{"privateMarker":"PRIVATE_FIXTURE_ONLY_9281"}');}
 const result=buildVercel({rootDir:root,at:'2026-10-16T09:00:00.000Z'});
 assert.ok(result.eventCount>0);assert.ok(result.npayCount>0);
 const html=fs.readFileSync(path.join(result.out,'index.html'),'utf8');assert.match(html,/data-mode="web-preview"/);assert.match(html,/개인 참여 기록/);
 const stats=JSON.parse(fs.readFileSync(path.join(result.out,'_public-data/stats.json'),'utf8'));assert.equal(stats.total.assumedPoints,0);assert.equal(stats.total.npayCount,0);
 const npay=JSON.parse(fs.readFileSync(path.join(result.out,'_public-data/npay.json'),'utf8'));assert.deepEqual(npay.completed,[]);
 const outputs=fs.readdirSync(result.out,{recursive:true}).filter(p=>fs.statSync(path.join(result.out,p)).isFile());
 for(const file of outputs)assert.doesNotMatch(fs.readFileSync(path.join(result.out,file),'utf8'),/PRIVATE_FIXTURE_ONLY_9281/);
 assert.equal(JSON.parse(fs.readFileSync(path.join(result.out,'build-info.json'),'utf8')).privateRecordsIncluded,false);
 for(const p of ['day','week','month','year'])assert.ok(fs.existsSync(path.join(result.out,'_public-data','stats-'+p+'.csv')));
});

test('Vercel 설정은 정적 빌드와 읽기 API만 연결한다',()=>{
 const config=JSON.parse(fs.readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 assert.equal(config.outputDirectory,'dist');assert.equal(config.buildCommand,'node tools/build-vercel.mjs');
 assert.ok(config.rewrites.every(r=>r.destination.startsWith('/_public-data/')));
 assert.ok(!config.rewrites.some(r=>r.source.includes('complete')||r.source.includes('select')));
});
