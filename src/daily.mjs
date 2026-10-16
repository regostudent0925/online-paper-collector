import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {GuideStore} from './guide.mjs';
import {directAssessment} from './catalog.mjs';
import {loadCatalogRecords} from './catalog-data.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),command=args.shift(),o={};
try{
  while(args.length){const key=args.shift();if(!['--at','--input','--batch','--choices','--choices-file'].includes(key)||!args.length)throw Error('UNKNOWN_OPTION');o[key.slice(2)]=args.shift();}
  const store=new GuideStore(path.join(root,'state')),at=o.at||new Date().toISOString();
  let result;
  if(command==='prepare')result=store.prepare(o.input?JSON.parse(fs.readFileSync(o.input,'utf8').replace(/^\uFEFF/,'')).events:loadCatalogRecords(root),at,{assess:directAssessment});
  else if(command==='publish')result=store.publish(o.batch,at);
  else if(command==='select')result=store.select(o.batch,JSON.parse(o['choices-file']?fs.readFileSync(o['choices-file'],'utf8').replace(/^\uFEFF/,''):o.choices),at);
  else if(command==='due')result=store.due(at);
  else if(command==='reminded')result=store.markReminder(o.batch,at);
  else if(command==='view')result=store.view(o.batch);
  else throw Error('COMMANDS: prepare | publish | select | due | reminded | view; 행사 제출 기능 없음');
  console.log(JSON.stringify(result,null,2));
}catch(e){console.error(e.message);process.exitCode=1;}
