import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {catalogView} from '../src/catalog.mjs';import {npayCatalog} from '../src/npay-state.mjs';import {statsView,statsCsv} from '../src/stats.mjs';
export function buildVercel({rootDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),at=new Date().toISOString()}={}){
 const out=path.join(rootDir,'dist');fs.mkdirSync(path.join(out,'_public-data'),{recursive:true});
 // 실제 data/state 폴더를 읽지 않는다. 검토된 공개 예제만 빌드 입력으로 사용한다.
 const read=name=>JSON.parse(fs.readFileSync(path.join(rootDir,'examples/data',name),'utf8').replace(/^\uFEFF/,''));
 const base=read('events.json'),over=read('direct-events.json'),records=new Map(base.events.map(e=>[e.id,e]));for(const e of over.events)records.set(e.id,e);
 const state={decisions:[],batches:[],npayCompletions:[]},store={load:()=>state};
 const catalog={demo:false,at,view:catalogView(store,[...records.values()],at),due:[]},npay=npayCatalog(read('npay.json'),state,at),stats=statsView(state,at);
 const html=fs.readFileSync(path.join(rootDir,'ui/home.html'),'utf8').replace('<html lang="ko">','<html lang="ko" data-mode="web-preview">');fs.writeFileSync(path.join(out,'index.html'),html);
 for(const file of ['home.js','home.css','npay.js','stats.js'])fs.copyFileSync(path.join(rootDir,'ui',file),path.join(out,file));
 for(const [name,data]of Object.entries({catalog,npay,stats}))fs.writeFileSync(path.join(out,'_public-data',name+'.json'),JSON.stringify(data));
 for(const p of ['day','week','month','year'])fs.writeFileSync(path.join(out,'_public-data','stats-'+p+'.csv'),statsCsv(stats,p));
 fs.writeFileSync(path.join(out,'build-info.json'),JSON.stringify({mode:'web-preview',builtAt:at,sourceCommit:process.env.VERCEL_GIT_COMMIT_SHA||null,privateRecordsIncluded:false}));
 return {out,files:fs.readdirSync(out),eventCount:catalog.view.events.length,npayCount:npay.directLinks.length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(buildVercel()));
