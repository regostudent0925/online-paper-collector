import {setAccountStore} from './browser-records.js';
import {AccountRecordStore,localRecordsBackup} from './account-records.js';
if(document.documentElement.dataset.mode==='web-preview')init();
async function init(){
 const $=s=>document.querySelector(s),panel=$('#account-panel'),status=$('#auth-status');panel.hidden=false;
 let config,session=null,store=null,pendingEmail='',working=false;
 const changed=()=>{document.dispatchEvent(new Event('account-changed'));document.dispatchEvent(new Event('personal-records-changed'));};
 const clear=()=>{store?.close();store=null;session=null;setAccountStore(null);$('#auth-member').hidden=true;$('#auth-send').hidden=false;$('#auth-verify').hidden=true;$('#auth-identity').textContent='';$('#auth-code').value='';$('#auth-email').value='';$('#auth-name').value='';pendingEmail='';changed();};
 async function request(path,options={}){
  if(session&&Date.now()>=session.expires){clear();throw Error('로그인이 만료되었습니다. 이메일 인증으로 다시 로그인해 주세요.');}
  const response=await fetch(config.url+path,{...options,headers:{apikey:config.key,...(session?{Authorization:'Bearer '+session.token}:{}),'Content-Type':'application/json'},cache:'no-store',referrerPolicy:'no-referrer'});
  if(!response.ok){if(response.status===401&&session)clear();throw Error(response.status===409?'다른 기기에서 기록이 바뀌었습니다. 내 기록을 새로 읽고 다시 저장해 주세요.':response.status===429?'요청이 많습니다. 잠시 후 다시 시도해 주세요.':'인증 또는 저장에 실패했습니다. 입력 내용과 연결을 확인해 주세요.');}
  return response.status===204?null:response.json();
 }
 async function action(fn){if(working)return;working=true;for(const e of panel.querySelectorAll('button'))e.disabled=true;try{await fn();}catch(e){status.textContent=e.message;}finally{working=false;for(const e of panel.querySelectorAll('button'))e.disabled=false;}}
 try{const r=await fetch('/auth-config.json',{cache:'no-store'});if(!r.ok)throw Error();config=await r.json();if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url)||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.key))throw Error();}catch{status.textContent='이메일 로그인은 인증 서비스 연결 후 사용할 수 있습니다. 현재는 이 브라우저의 기록을 사용합니다.';for(const e of panel.querySelectorAll('input,button'))e.disabled=true;return;}
 $('#auth-send').addEventListener('submit',e=>{e.preventDefault();action(async()=>{const email=$('#auth-email').value.trim();await request('/auth/v1/otp',{method:'POST',body:JSON.stringify({email,create_user:true,data:{display_name:$('#auth-name').value.trim()}})});pendingEmail=email;$('#auth-verify').hidden=false;$('#auth-code').value='';$('#auth-code').focus();status.textContent='이메일의 인증번호를 입력해 주세요. 재전송은 잠시 후 가능합니다.';});});
 $('#auth-verify').addEventListener('submit',e=>{e.preventDefault();action(async()=>{if(!pendingEmail)throw Error('인증번호를 먼저 요청해 주세요.');const data=await request('/auth/v1/verify',{method:'POST',body:JSON.stringify({email:pendingEmail,token:$('#auth-code').value.trim(),type:'email'})});if(!data.access_token||!data.user?.id||!Number.isFinite(data.expires_in))throw Error('인증 결과를 확인하지 못했습니다.');session={token:data.access_token,expires:Date.now()+data.expires_in*1000};const candidate=new AccountRecordStore(request);try{await candidate.load();}catch(e){candidate.close();session=null;throw e;}store=candidate;setAccountStore(store);$('#auth-member').hidden=false;$('#auth-send').hidden=true;$('#auth-verify').hidden=true;$('#auth-code').value='';$('#auth-email').value='';$('#auth-name').value='';$('#auth-identity').textContent=(data.user.user_metadata?.display_name||'내 계정')+' · '+data.user.email;pendingEmail='';status.textContent='로그인했습니다. 내 기록을 불러왔습니다. 페이지를 새로 열면 다시 인증합니다.';changed();});});
 $('#auth-sync').addEventListener('click',()=>action(async()=>{if(!store||!await store.load())throw Error('저장 처리 후 다시 시도해 주세요.');changed();status.textContent='내 계정의 최신 기록을 읽었습니다.';}));
 $('#auth-import-local').addEventListener('click',()=>action(async()=>{if(!store)return;await store.import(localRecordsBackup(window.localStorage));changed();status.textContent='기존 브라우저 기록을 내 계정에 합쳤습니다. 원래 브라우저 기록도 유지됩니다.';}));
 $('#auth-logout').addEventListener('click',()=>action(async()=>{if(store?.busy)throw Error('기록 저장을 마친 뒤 로그아웃해 주세요.');let failed=false;try{await request('/auth/v1/logout',{method:'POST'});}catch{failed=true;}clear();status.textContent=failed?'이 화면에서 로그아웃했습니다. 서버 세션 종료는 확인되지 않았습니다.':'로그아웃했습니다. 이 브라우저의 비로그인 기록으로 돌아왔습니다.';}));
 setInterval(()=>{if(session&&Date.now()>=session.expires){clear();status.textContent='로그인이 만료되었습니다. 다시 인증해 주세요.';}},10000);
}
