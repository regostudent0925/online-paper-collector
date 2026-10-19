import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {catalogView} from '../src/catalog.mjs';import {npayCatalog} from '../src/npay-state.mjs';import {statsView,statsCsv} from '../src/stats.mjs';
import {validatePublicCatalog} from '../src/public-catalog.mjs';
export function buildVercel({rootDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),at=new Date().toISOString()}={}){
 const out=path.join(rootDir,'dist');fs.mkdirSync(path.join(out,'_public-data'),{recursive:true});
 // 실제 data/state 폴더를 읽지 않는다. 검토된 공개 예제만 빌드 입력으로 사용한다.
 const read=name=>JSON.parse(fs.readFileSync(path.join(rootDir,'examples/data',name),'utf8').replace(/^\uFEFF/,''));
 const snapshotPath=path.join(rootDir,'published/catalog.json');
 const snapshot=fs.existsSync(snapshotPath)?validatePublicCatalog(JSON.parse(fs.readFileSync(snapshotPath,'utf8'))):null;
 const base=snapshot?{events:snapshot.events}:read('events.json'),over=snapshot?{events:[]}:read('direct-events.json'),records=new Map(base.events.map(e=>[e.id,e]));for(const e of over.events)records.set(e.id,e);
 const state={decisions:[],batches:[],npayCompletions:[]},store={load:()=>state};
 const catalog={demo:false,at,sourceUpdatedAt:snapshot?.updatedAt||null,view:catalogView(store,[...records.values()],at),due:[]},npay=npayCatalog(snapshot?.npay||read('npay.json'),state,at),stats=statsView(state,at);
 const html=fs.readFileSync(path.join(rootDir,'ui/home.html'),'utf8').replace('<html lang="ko">','<html lang="ko" data-mode="web-preview">').replace('Web 미리보기 · 공개 조사 예제 기준입니다.','공개 이벤트 목록 · '+(snapshot?'매일 조사한 공개 자료 기준입니다.':'공개 조사 예제 기준입니다.')).replace('개인 참여 기록·통계와 자동 탭 닫기는 로컬 홈페이지에서 이용하세요. 이 화면에서는 참여 상태를 저장하지 않습니다.','개인 참여 기록·통계는 이 브라우저에만 저장됩니다. 서버로 전송하지 않습니다.').replace('이 컴퓨터에서 사용하는 개인 페이지','로그인 없이 · 내 브라우저에 저장').replace('‘참여했음’·‘참여 의사 없음’은 다음 날부터 같은 행사·회차를 제외합니다.','저장하면 이 브라우저의 목록·통계에 바로 반영됩니다. 다른 기기에는 백업을 가져와 주세요.');fs.writeFileSync(path.join(out,'index.html'),html);
 for(const file of ['home.js','home.css','npay.js','stats.js','browser-records.js','record-stats.js','backup.js'])fs.copyFileSync(path.join(rootDir,'ui',file),path.join(out,file));
 for(const [name,data]of Object.entries({catalog,npay,stats}))fs.writeFileSync(path.join(out,'_public-data',name+'.json'),JSON.stringify(data));
 for(const p of ['day','week','month','year'])fs.writeFileSync(path.join(out,'_public-data','stats-'+p+'.csv'),statsCsv(stats,p));
 fs.writeFileSync(path.join(out,'build-info.json'),JSON.stringify({mode:'web-preview',dataMode:snapshot?'daily-public':'example',dataUpdatedAt:snapshot?.updatedAt||null,builtAt:at,sourceCommit:process.env.VERCEL_GIT_COMMIT_SHA||null,privateRecordsIncluded:false}));
 return {out,files:fs.readdirSync(out),eventCount:catalog.view.events.length,npayCount:npay.directLinks.length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(buildVercel()));


