// Chrome의 매치 패턴은 포트를 구분하지 않으므로 실행 시 정확한 origin을 제한한다.
if(location.origin==='http://127.0.0.1:4179'&&location.pathname==='/'){
 document.documentElement.dataset.npayTabHelper='ready';
 document.documentElement.dataset.npayClaimTimer='v4';
 document.documentElement.dataset.npayMissionLinks='v1';
 document.dispatchEvent(new Event('npay-helper-ready'));
 document.addEventListener('click',event=>{
  if(!event.isTrusted||event.button!==0||event.ctrlKey||event.shiftKey||event.metaKey||event.altKey)return;
  const anchor=event.target.closest?.('#npay-content a.npay-go');
  const test=event.target.closest?.('#npay-content .npay-close-test');if(!anchor&&!test)return;
  event.preventDefault();event.stopImmediatePropagation();
  chrome.runtime.sendMessage(test?{type:'NPAY_TEST_5S'}:{type:'NPAY_OPEN_5S',url:anchor.href,key:anchor.dataset.npayKey},reply=>{
   const status=document.querySelector('.npay-feedback');
   if(chrome.runtime.lastError||!reply?.ok){if(status)status.textContent='탭 열기 실패 · '+(reply?.reason||'확장을 새로고침해 주세요.');}
   else if(status)status.textContent=reply.manual?'이 링크는 클릭 감지 대상이 아닙니다. 직접 닫고 참여완료로 기록해 주세요.':test?'가상 포인트 받기 버튼을 직접 누른 뒤5초 타이머를 시험합니다.':'포인트 받기를 직접 누르면5초 뒤 닫고 자동 보관합니다.';
  });
 },true);
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(sender.id!==chrome.runtime.id)return;
  if(message?.type==='NPAY_TIMER_TEST_CLOSED'){
   const status=document.querySelector('.npay-feedback');
   if(status)status.textContent='가상 시험: 버튼 감지 후 '+(message.elapsedMs/1000).toFixed(2)+'초에 닫기 요청 · 실제 참여 기록 없음';
   return;
  }
  if(sender.id!==chrome.runtime.id||message?.type!=='NPAY_TAB_CLOSED'||!/^[a-f0-9]{64}$/.test(message.key||'')||!/^[a-f0-9-]{36}$/.test(message.attemptId||''))return;
  fetch('/api/npay/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:message.key,trigger:'tab-closed',attemptId:message.attemptId,...(message.completionKind==='already-participated'?{completionKind:'already-participated'}:{})})}).then(async response=>{
   if(!response.ok)throw Error();
   document.documentElement.dataset.npayCloseElapsed=Number.isFinite(message.elapsedMs)?String(message.elapsedMs):'';
   document.documentElement.dataset.npayCompletionKind=message.completionKind||'new';
   document.dispatchEvent(new Event('npay-auto-completed'));reply({saved:true});
  }).catch(()=>{const status=document.querySelector('.npay-feedback');if(status)status.textContent='탭은 닫혔지만 완료 저장에 실패했습니다. 참여완료 버튼으로 기록해 주세요.';reply({saved:false});});
  return true;
 });
}
