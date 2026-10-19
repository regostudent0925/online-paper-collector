import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
import {loadCatalogRecords} from '../src/catalog-data.mjs';import {makePublicCatalog,validatePublicCatalog} from '../src/public-catalog.mjs';
export function exportPublic({rootDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),at=new Date().toISOString()}={}){
 // state/current.json、배치·완료 이력·통계는 열지 않는다.
 const input=JSON.parse(fs.readFileSync(path.join(rootDir,'data/npay.json'),'utf8').replace(/^\uFEFF/,''));
 const snapshot=validatePublicCatalog(makePublicCatalog(loadCatalogRecords(rootDir),input,{at})),content=JSON.stringify(snapshot,null,2)+'\n';
 const target=path.join(rootDir,'published/catalog.json'),changed=!fs.existsSync(target)||fs.readFileSync(target,'utf8').replace(/\r\n/g,'\n')!==content;
 if(changed){fs.mkdirSync(path.dirname(target),{recursive:true});const temp=target+'.tmp';fs.writeFileSync(temp,content);fs.renameSync(temp,target);}
 return {changed,path:'published/catalog.json',sha256:createHash('sha256').update(content).digest('hex'),updatedAt:snapshot.updatedAt,eventCount:snapshot.events.length,npayCount:snapshot.npay.directLinks.length,privateRecordsIncluded:false,...(process.argv.includes('--manifest')?{content}:{})};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{console.log(JSON.stringify(exportPublic()));}catch(e){console.error(e.message);process.exitCode=1;}}
