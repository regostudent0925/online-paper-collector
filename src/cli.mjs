import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {review,validInstant} from './core.mjs';
import {fetchPublic,extractLinks,discovered} from './collect.mjs';
import {render} from './report.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),command=args.shift();
const options={};
try {
  while(args.length) {const k=args.shift();if(!['--input','--at','--previous','--url','--html','--base'].includes(k) || !args.length) throw Error('UNKNOWN_OPTION'); options[k.slice(2)]=args.shift();}
  const at=options.at || new Date().toISOString(); if(!validInstant(at)) throw Error('NOW_REQUIRES_TIMEZONE');
  if(!['review','collect'].includes(command)) throw Error('COMMANDS: review | collect (실제 제출 명령 없음)');
  const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
  const output=path.join(root,'output',at.replaceAll(/[:.]/g,'-')+'-'+process.pid);fs.mkdirSync(output,{recursive:true});
  if(command==='review') {
    const data=read(options.input || path.join(root,'data/events.json'));
    if(!Array.isArray(data.events)) throw Error('EVENTS_ARRAY_REQUIRED');
    const events=review(data.events,at,options.previous?read(options.previous).events:[]);
    const result={schema:'event-review-v1',dryRun:true,at,timeZone:'Asia/Seoul',sourceCheckedAt:data.checkedAt,events};
    fs.writeFileSync(path.join(output,'review.json'),JSON.stringify(result,null,2));
    fs.writeFileSync(path.join(output,'review.html'),render(events,at));
    fs.writeFileSync(path.join(root,'output/latest.json'),JSON.stringify({output,at},null,2));
    console.log(JSON.stringify({dryRun:true,count:events.length,counts:events.reduce((o,e)=>(o[e.reviewStatus]=(o[e.reviewStatus]||0)+1,o),{}),output},null,2));
  } else if(command==='collect') {
    let result;
    if(options.url) result=await fetchPublic(options.url,{allowedUrls:read(path.join(root,'data/sources.json')).allowedUrls});
    else if(options.html && options.base) result={status:'local-html',links:extractLinks(fs.readFileSync(options.html,'utf8'),options.base)};
    else {const data=read(options.input || path.join(root,'data/events.json'));result={status:'seed-import',links:data.events.map(e=>({title:e.title,url:e.officialUrl || e.entryUrl})).filter(e=>e.url)};}
    const data={dryRun:true,at,...result,events:discovered(result.links || [],at)};
    fs.writeFileSync(path.join(output,'discovered.json'),JSON.stringify(data,null,2));
    console.log(JSON.stringify({dryRun:true,status:result.status,count:data.events.length,output},null,2));
  } else throw Error('COMMANDS: review | collect (실제 제출 명령 없음)');
} catch(e) {console.error(e.message);process.exitCode=1;}
