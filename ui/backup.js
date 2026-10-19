if(document.documentElement.dataset.mode==='web-preview'){
 const panel=document.querySelector('#record-backup'),status=document.querySelector('#backup-result'),input=document.querySelector('#records-import'),preview=document.querySelector('#import-preview');
 panel.hidden=false;
 let pending=null;
 const reset=()=>{pending=null;input.value='';preview.hidden=true;};
 document.querySelector('#records-export').addEventListener('click',async()=>{try{const m=await import('./browser-records.js');m.downloadLocal(m.browserStore().export(),'my-event-records-'+new Date().toISOString().slice(0,10)+'.json');status.textContent='백업 파일을 내려받았습니다. 이 파일에는 참여 기록이 포함됩니다.';}catch(e){status.textContent=e.message;}});
 input.addEventListener('change',async()=>{pending=null;preview.hidden=true;try{const file=input.files[0];if(!file)return;if(file.size>5*1024*1024)throw Error('5MB 이하의 기록 백업 파일만 가져올 수 있습니다.');const m=await import('./browser-records.js'),raw=await file.text(),records=m.parseBackup(raw);m.browserStore().read();pending=raw;document.querySelector('#import-summary').textContent='파일 확인: 이벤트 '+records.events.length+'건 · Npay '+records.npay.length+'건. 중복은 합치며 기존 기록을 지우지 않습니다. 서버로 업로드하지 않습니다.';preview.hidden=false;status.textContent='내용을 확인한 뒤 병합 버튼을 눌러 주세요.';}catch(e){status.textContent=e.message;input.value='';}});
 document.querySelector('#import-cancel').addEventListener('click',()=>{reset();status.textContent='가져오기를 취소했습니다. 기록은 바뀌지 않았습니다.';});
 document.querySelector('#import-apply').addEventListener('click',async()=>{if(!pending)return;try{const m=await import('./browser-records.js'),result=m.browserStore().import(pending);reset();status.textContent='병합 완료: 이벤트 '+result.events+'건 · Npay '+result.npay+'건을 이 브라우저에 보관합니다.';document.dispatchEvent(new Event('personal-records-changed'));}catch(e){status.textContent=e.message;}});
}
