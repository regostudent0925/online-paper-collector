// 탭 전체 조회·내용 읽기·쿠키·외부 요청 없이, 방금 생성한 ID만 관리한다.
import {rememberTab,forgetTab,startClaimTimer} from './claim-timer.mjs';
export function allowedReward(raw){try{const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)return null;
 if(u.hostname==='campaign2.naver.com'&&u.pathname==='/npay/v2/click-point/'&&[...u.searchParams.keys()].length===1&&/^[\w-]+$/.test(u.searchParams.get('eventId')||''))return u.href;
 if(u.hostname==='ofw.adison.co'&&/^\/u\/naverpay\/ads\/\d+$/.test(u.pathname)&&!u.search)return u.href;
 if(u.hostname==='point.pay.naver.com'&&u.pathname==='/bridge/eventbenefit'&&[...u.searchParams.keys()].length===4&&u.searchParams.get('fromPage')==='DETAIL_FROM_BANNER'&&u.searchParams.get('inventory')==='pay>benefit_group'&&u.searchParams.get('placementId')==='benefit_group_pp'&&/^\d+$/.test(u.searchParams.get('adId')||''))return u.href;
 }catch{}return null;}
export async function openOwnedTab(message,sender,api,schedule=setTimeout){
 let source;try{source=new URL(sender.url);}catch{return {ok:false};}
 if(source.origin!=='http://127.0.0.1:4179'||source.pathname!=='/'||sender.frameId!==0||!Number.isInteger(sender.tab?.id))return {ok:false,reason:'SOURCE'};
 if(!['NPAY_OPEN_5S','NPAY_TEST_5S'].includes(message?.type))return {ok:false,reason:'MESSAGE_TYPE'};
 const url=message.type==='NPAY_TEST_5S'?'http://127.0.0.1:4179/npay-close-test':allowedReward(message.url);if(!url)return {ok:false,reason:'URL'};
 if(message.type==='NPAY_OPEN_5S'&&!/^[a-f0-9]{64}$/.test(message.key||''))return {ok:false,reason:'KEY'};
 if(new URL(url).hostname!=='ofw.adison.co'&&!api.storage?.session)return {ok:false,reason:'STORAGE_PERMISSION'};
 const options={url,active:true,openerTabId:sender.tab.id};
 if(Number.isInteger(sender.tab.windowId))options.windowId=sender.tab.windowId;
 let tab;try{tab=await api.tabs.create(options);}catch{return {ok:false,reason:'TAB_CREATE'};}
 if(!Number.isInteger(tab.id))return {ok:false};
 const ownedId=tab.id;
 const attemptId=crypto.randomUUID();
 if(new URL(url).hostname==='ofw.adison.co')return {ok:true,manual:true,version:4};
 await rememberTab(api.storage.session,{tabId:ownedId,homeId:sender.tab.id,key:message.key||null,attemptId,test:message.type==='NPAY_TEST_5S',started:false});
 return {ok:true,version:4};
}
if(typeof chrome!=='undefined'&&chrome.runtime?.onMessage)chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 (message?.type==='NPAY_CLAIM_CLICKED'?startClaimTimer(message,sender,chrome):openOwnedTab(message,sender,chrome)).then(reply,()=>reply({ok:false}));return true;
});
if(typeof chrome!=='undefined'&&chrome.tabs?.onRemoved)chrome.tabs.onRemoved.addListener(id=>{forgetTab(chrome.storage.session,id).catch(()=>{});});
