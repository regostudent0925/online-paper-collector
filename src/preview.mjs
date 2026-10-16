import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function previewServer(html,json) {
  return http.createServer((req,res)=>{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return;}
    const route=req.url?.split('?')[0];
    const data=route==='/'?html:route==='/review.json'?json:null;
    if(data===null){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':route==='/'?'text/html; charset=utf-8':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'"});
    res.end(req.method==='HEAD'?undefined:data);
  });
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const latest=JSON.parse(fs.readFileSync(path.join(root,'output/latest.json'),'utf8'));
  const relative=path.relative(path.join(root,'output'),latest.output);
  if(!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw Error('PREVIEW_PATH_INVALID');
  const app=previewServer(fs.readFileSync(path.join(latest.output,'review.html')),fs.readFileSync(path.join(latest.output,'review.json')));
  app.listen(4178,'127.0.0.1',()=>console.log('읽기 전용 미리보기 http://127.0.0.1:4178 / 중지 Ctrl+C'));
}
