// 버튼을 누르지 않는다. 지정 페이지의 실제 사용자 클릭만 감지한다.
const npayClaimPage=location.origin==='https://campaign2.naver.com'&&location.pathname==='/npay/v2/click-point/';
const npayClaimTest=location.origin==='http://127.0.0.1:4179'&&location.pathname==='/npay-close-test';
if(npayClaimPage||npayClaimTest){
 document.addEventListener('click',event=>{
  if(!event.isTrusted||event.button!==0||event.ctrlKey||event.shiftKey||event.altKey||event.metaKey)return;
  const control=event.target.closest?.('button,a,[role="button"],input[type="button"],input[type="submit"]')||event.target;
  if(control.disabled||control.getAttribute?.('aria-disabled')==='true')return;
  const label=String(control.value||control.textContent||'').replace(/\s+/g,'');
  let completionKind='new';
  if(label!==(npayClaimTest?'가상포인트받기':'포인트받기')){
   if(label!==(npayClaimTest?'가상확인':'확인'))return;
   let container=control.parentElement,matched=false;
   for(let depth=0;container&&depth<6&&container!==document.body;depth++,container=container.parentElement){if(String(container.innerText||'').replace(/\s+/g,'').includes('클릭적립은캠페인당1회만적립됩니다')){matched=true;break;}}
   if(!matched)return;
   completionKind='already-participated';
  }
  chrome.runtime.sendMessage({type:'NPAY_CLAIM_CLICKED',completionKind},()=>{void chrome.runtime.lastError;});
 },true);
}
