const prefix='npay-owned:';
const starting=new Set();
export function claimSource(sender,entry){
 if(sender.frameId!==0||sender.tab?.id!==entry.tabId)return false;
 try{const u=new URL(sender.url);return entry.test?u.origin==='http://127.0.0.1:4179'&&u.pathname==='/npay-close-test':u.origin==='https://campaign2.naver.com'&&u.pathname==='/npay/v2/click-point/';}catch{return false;}
}
export async function rememberTab(storage,entry){await storage.set({[prefix+entry.tabId]:entry});}
export async function forgetTab(storage,id){await storage.remove(prefix+id);}
export async function startClaimTimer(message,sender,api,schedule=setTimeout,now=()=>performance.now()){
 if(message?.type!=='NPAY_CLAIM_CLICKED'||!Number.isInteger(sender.tab?.id))return {ok:false};
 if(message.completionKind!==undefined&&!['new','already-participated'].includes(message.completionKind))return {ok:false};
 if(starting.has(sender.tab.id))return {ok:true,alreadyStarted:true};
 starting.add(sender.tab.id);
 try{
 const key=prefix+sender.tab.id,entry=(await api.storage.session.get(key))[key];
 if(!entry||!claimSource(sender,entry))return {ok:false};
 if(entry.started)return {ok:true,alreadyStarted:true};
 entry.started=true;await api.storage.session.set({[key]:entry});
 const startedAt=now(),dueAt=startedAt+5000;
 const closeWhenDue=async()=>{
  const remaining=dueAt-now();
  if(remaining>0){schedule(closeWhenDue,Math.ceil(remaining));return;}
  const elapsedMs=Math.floor(now()-startedAt);
  try{await api.tabs.remove(entry.tabId);}catch{await forgetTab(api.storage.session,entry.tabId);return;}
  await forgetTab(api.storage.session,entry.tabId);
  try{await api.tabs.sendMessage(entry.homeId,{type:entry.test?'NPAY_TIMER_TEST_CLOSED':'NPAY_TAB_CLOSED',key:entry.key,attemptId:entry.attemptId,elapsedMs,completionKind:message.completionKind||'new'});}catch{}
 };
 schedule(closeWhenDue,5000);
 return {ok:true};
 }finally{starting.delete(sender.tab.id);}
}
