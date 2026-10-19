import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {GuideStore} from './guide.mjs';
import {npayCatalog,completeNpay} from './npay-state.mjs';
import {catalogView,selectCatalog} from './catalog.mjs';
import {loadCatalogRecords} from './catalog-data.mjs';
import {statsView,statsCsv,PERIODS} from './stats.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function selectionServer({directory=path.join(root,'state'),now=()=>new Date().toISOString(),demo=false}={}){
  const store=new GuideStore(directory);
  const records=()=>loadCatalogRecords(root);
  const npayData=()=>JSON.parse(fs.readFileSync(path.join(root,'data/npay.json'),'utf8'));
  return http.createServer(async(req,res)=>{
    const send=(status,value,type='application/json; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"});res.end(typeof value==='string'?value:JSON.stringify(value));};
    const host='127.0.0.1:'+serverPort(req);
    if(req.headers.host!==host)return send(403,{error:'LOCAL_HOST_REQUIRED'});
    const route=req.url?.split('?')[0];
    try{
      if(req.method==='GET'&&route==='/npay-close-test'){
        res.setHeader('Cross-Origin-Opener-Policy','same-origin');
        return send(200,'<!doctype html><meta charset="utf-8"><title>모아봄 클릭 기준 닫기 시험</title><h1>클릭 기준 닫기 시험</h1><p>이 탭은 그냥 기다려서는 닫히지 않습니다. 아래 가상 버튼을 직접 누른 시점부터5초 뒤 닫힙니다. 실제 광고·적립은 없습니다.</p><button>가상 포인트 받기</button><section><p>클릭 적립은 캠페인 당 1회만 적립됩니다.</p><button>가상 확인</button></section><section><p>관계없는 안내</p><button>확인</button></section>','text/html; charset=utf-8');
      }
      if(req.method==='GET' && ['/', '/classic'].includes(route))return send(200,fs.readFileSync(path.join(root,'ui',route==='/'?'home.html':'index.html'),'utf8'),'text/html; charset=utf-8');
      if(req.method==='GET' && ['/ui.js','/style.css','/home.js','/home.css','/npay.js','/stats.js','/backup.js'].includes(route))return send(200,fs.readFileSync(path.join(root,'ui',route.slice(1)),'utf8'),route.endsWith('.js')?'application/javascript; charset=utf-8':'text/css; charset=utf-8');
      if(req.method==='GET'&&route==='/api/stats')return send(200,statsView(store.load(),now()));
      if(req.method==='GET'&&route==='/api/stats.csv'){const period=new URL(req.url,'http://'+host).searchParams.get('period')||'month';if(!PERIODS.includes(period))return send(400,{error:'STATS_PERIOD_INVALID'});res.setHeader('Content-Disposition','attachment; filename="participation-'+period+'.csv"');return send(200,statsCsv(statsView(store.load(),now()),period),'text/csv; charset=utf-8');}
      if(req.method==='GET' && route==='/api/npay')return send(200,npayCatalog(npayData(),store.load(),now()));
      if(req.method==='POST' && route==='/api/npay/complete'){
        if(req.headers.origin!=='http://'+host || !/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return send(403,{error:'SAME_ORIGIN_JSON_REQUIRED'});
        let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>1024)return send(413,{error:'TOO_LARGE'});}
        const data=JSON.parse(body);if(!Object.hasOwn(data,'key')||Object.keys(data).some(k=>!['key','trigger','attemptId','completionKind'].includes(k)))return send(400,{error:'UNEXPECTED_FIELDS'});
        if(data.trigger!==undefined&&data.trigger!=='tab-closed'||data.trigger==='tab-closed'&&!data.attemptId||data.attemptId&&!data.trigger)return send(400,{error:'INVALID_TRIGGER'});
        return send(200,completeNpay(store,npayData(),data.key,now(),{trigger:data.trigger||'manual',attemptId:data.attemptId||null,completionKind:data.completionKind||'new'}));
      }
      if(req.method==='GET' && route==='/api/view')return send(200,{demo,at:now(),view:store.view(),due:store.due(now()).map(b=>b.id)});
      if(req.method==='GET' && route==='/api/catalog')return send(200,{demo,at:now(),view:demo?store.view():catalogView(store,records(),now()),due:store.due(now()).map(b=>b.id)});
      if(req.method==='POST' && route==='/api/choices'){
        if(req.headers.origin!=='http://'+host || !/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return send(403,{error:'SAME_ORIGIN_JSON_REQUIRED'});
        let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>16384)return send(413,{error:'TOO_LARGE'});}
        const data=JSON.parse(body);if(Object.keys(data).some(k=>!['batchId','selections'].includes(k)))return send(400,{error:'UNEXPECTED_FIELDS'});
        return send(200,data.batchId==='catalog'&&!demo?selectCatalog(store,records(),data.selections,now()):store.select(data.batchId,data.selections,now()));
      }
      if(!['GET','POST'].includes(req.method))return send(405,{error:'METHOD_NOT_ALLOWED'});
      return send(404,{error:'NOT_FOUND'});
    }catch(e){return send(400,{error:['CHOICES_INVALID','BATCH_NOT_PUBLISHED','BATCH_INVALID','STATE_BUSY_RETRY'].includes(e.message)?e.message:'INVALID_REQUEST'});}
  });
}
const serverPort=req=>req.socket.localPort;
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const demo=process.argv.includes('--demo');
  const app=selectionServer(demo?{directory:path.join(root,'verification/daily-guide-20261016/demo-state'),demo:true}:{});
  app.listen(demo?4180:4179,'127.0.0.1',()=>console.log('이벤트 상태 선택 / '+(demo?'가상 시험 ':'')+'http://127.0.0.1:'+(demo?4180:4179)));
}


