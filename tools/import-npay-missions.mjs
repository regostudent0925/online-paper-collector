// 브라우저에서 읽은 공개 표시 메타데이터만 반영. 광고 요청/적립은 실행하지 않는다.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {mergeMissions} from '../src/npay-missions.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),input=process.argv[2];if(!input)throw Error('SNAPSHOT_FILE_REQUIRED');
const target=path.join(root,'data/npay.json'),snapshot=JSON.parse(fs.readFileSync(path.resolve(root,input),'utf8')),current=JSON.parse(fs.readFileSync(target,'utf8')),next=mergeMissions(current,snapshot);
const dir=path.join(root,'verification','mission-import-'+Date.now());fs.mkdirSync(dir,{recursive:true});fs.copyFileSync(target,path.join(dir,'npay-before.json'));
const temp=path.join(root,'data','npay-'+Date.now()+'.tmp');fs.writeFileSync(temp,JSON.stringify(next,null,2)+'\n',{flag:'wx'});fs.renameSync(temp,target);console.log(JSON.stringify({imported:snapshot.rows.length,stored:next.directLinks.length,backup:dir}));
