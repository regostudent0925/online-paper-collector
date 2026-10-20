import test from 'node:test';import assert from 'node:assert/strict';
import {browserStore,hasAccountStore,setAccountStore} from '../ui/browser-records.js';
import {emptyRecords} from '../ui/account-records.js';
const tick=async()=>{for(let i=0;i<6;i++)await new Promise(r=>setImmediate(r));};
test('이메일 요청만으로 로그인하지 않고 인증 성공·계정 읽기 이후에만 기록을 연결한다',async t=>{
 const original={document:globalThis.document,window:globalThis.window,fetch:globalThis.fetch,setInterval:globalThis.setInterval};
 t.after(()=>{Object.assign(globalThis,original);setAccountStore(null);});
 const elements=new Map(),calls=[],events=[];
 function element(id){if(!elements.has(id))elements.set(id,{hidden:true,value:'',disabled:false,textContent:'',handlers:{},addEventListener(type,fn){this.handlers[type]=fn;},querySelectorAll(){return [];},focus(){}});return elements.get(id);}
 globalThis.document={documentElement:{dataset:{mode:'web-preview'}},querySelector:element,dispatchEvent:e=>events.push(e.type)};
 globalThis.window={localStorage:{getItem:()=>null,setItem(){throw Error('계정 기록은 로컬에 저장하면 안 됨');}}};globalThis.setInterval=()=>0;
 let valid=false;
 globalThis.fetch=async(url,options)=>{calls.push({url,options});if(url==='/auth-config.json')return {ok:true,json:async()=>({url:'https://mock.supabase.co',key:'sb_publishable_fixture'})};if(url.endsWith('/otp'))return {ok:true,json:async()=>({})};if(url.endsWith('/verify'))return valid?{ok:true,json:async()=>({access_token:'fixture-token',expires_in:3600,user:{id:'mock-id',email:'mock@example.invalid',user_metadata:{display_name:'가상 사용자'}}})}:{ok:false,status:403};if(url.includes('/member_records?')){assert.equal(options.headers.Authorization,'Bearer fixture-token');return {ok:true,json:async()=>[]};}if(url.endsWith('/logout'))return {ok:true,status:204};throw Error('예상하지 못한 호출');};
 await import('../ui/auth.js?test-flow');await tick();element('#auth-email').value='mock@example.invalid';element('#auth-name').value='가상 사용자';element('#auth-send').handlers.submit({preventDefault(){}});await tick();assert.equal(hasAccountStore(),false);assert.equal(element('#auth-verify').hidden,false);assert.equal(calls.some(c=>c.url.includes('/member_records?')),false);
 element('#auth-code').value='123456';element('#auth-verify').handlers.submit({preventDefault(){}});await tick();assert.equal(hasAccountStore(),false);assert.match(element('#auth-status').textContent,/실패/);
 valid=true;element('#auth-verify').handlers.submit({preventDefault(){}});await tick();assert.equal(hasAccountStore(),true);assert.deepEqual(browserStore().read(),emptyRecords());assert.equal(element('#auth-member').hidden,false);assert.equal(element('#auth-code').value,'');assert.match(element('#auth-identity').textContent,/가상 사용자/);assert.ok(events.includes('account-changed'));
 const active=browserStore();element('#auth-logout').handlers.click();await tick();assert.equal(hasAccountStore(),false);assert.equal(active.state,null);assert.equal(element('#auth-member').hidden,true);assert.equal(element('#auth-identity').textContent,'');
});
