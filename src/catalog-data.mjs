import fs from 'node:fs';
import path from 'node:path';
export function loadCatalogRecords(root){
  const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
  const base=read(path.join(root,'data/events.json')).events,over=path.join(root,'data/direct-events.json'),byId=new Map(base.map(e=>[e.id,e]));
  if(fs.existsSync(over))for(const e of read(over).events){const old=byId.get(e.id);if(!old||Date.parse(e.lastCheckedAt)>=Date.parse(old.lastCheckedAt))byId.set(e.id,e);}
  return [...byId.values()];
}
