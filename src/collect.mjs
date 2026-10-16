import {publicURL,canonical} from './core.mjs';

// GET only, no cookies, no login, no redirect follow, no raw response/header storage.
export async function fetchPublic(url,{allowedUrls,fetcher=fetch,timeoutMs=10000}={}) {
  if(!publicURL(url) || !allowedUrls?.includes(url)) throw Error('PUBLIC_EXACT_URL_NOT_ALLOWED');
  try {
    const r=await fetcher(url,{method:'GET',redirect:'manual',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(timeoutMs),headers:{Accept:'text/html'}});
    if(r.status>=300 && r.status<400) return {url,status:'redirect-not-followed',httpStatus:r.status};
    if(r.status!==200) return {url,status:'access-failed',httpStatus:r.status};
    if(!/text\/html/i.test(r.headers.get('content-type') || '')) return {url,status:'unsupported-content'};
    const reader=r.body.getReader();let size=0,chunks=[];
    while(true) { const {done,value}=await reader.read(); if(done) break; size+=value.length; if(size>2000000) {await reader.cancel(); return {url,status:'too-large'};} chunks.push(value); }
    const bytes=Buffer.concat(chunks),encoding=/charset\s*=\s*(?:euc-kr|ks_c_5601-1987)/i.test(r.headers.get('content-type'))?'euc-kr':'utf-8';
    const html=new TextDecoder(encoding).decode(bytes);
    return {url,status:'read',httpStatus:200,links:extractLinks(html,url),verification:'발견용 링크만 추출; 조건 자동 확정 안 함'};
  } catch {return {url,status:'access-failed',error:'네트워크·시간초과·연결 오류 (상세/비밀정보 저장 안 함)'};}
}
export function extractLinks(html,base) {
  const safe=html.replace(/<(script|style|form)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
  const links=[];
  for(const m of safe.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {const u=canonical(new URL(m[1].replaceAll('&amp;','&'),base).href); if(u && !links.some(x=>x.url===u)) links.push({url:u,title:m[2].replace(/<[^>]*>/g,'').replaceAll('&amp;','&').trim().slice(0,160)});} catch {}
  }
  return links;
}
export function discovered(links,at) {
  return links.map((l,i)=>({id:'discovered-'+i,title:l.title,entryUrl:l.url,officialUrl:null,organizer:null,round:null,discoveryUrls:[l.url],lastCheckedAt:at,reviewStatus:'발견',participationStatus:'미참여'}));
}
