import {BrowserRecordStore,validateRecords,STORAGE_KEY} from './browser-records.js';
export const emptyRecords=()=>({schema:'paper-collector-backup-v1',events:[],npay:[]});
// 인증 토큰과 계정 기록은 메모리에만 둔다. 로컬 비로그인 기록과 섞지 않는다.
export class AccountRecordStore extends BrowserRecordStore{
 constructor(request){super(null);this.request=request;this.state=null;this.revision=0;this.busy=false;this.closed=false;}
 read(){if(this.closed||!this.state)throw Error('로그인한 계정의 기록을 먼저 불러와 주세요.');return structuredClone(this.state);}
 async load(){if(this.busy||this.closed)return false;this.busy=true;try{const rows=await this.request('/rest/v1/member_records?select=records,revision');if(this.closed)return false;if(!Array.isArray(rows)||rows.length>1)throw Error('계정 기록 응답을 확인하지 못했습니다.');this.state=validateRecords(rows[0]?.records||emptyRecords());this.revision=rows[0]?.revision||0;return true;}finally{this.busy=false;}}
 async transact(fn){if(this.busy||this.closed)throw Error('계정 기록을 처리 중입니다. 잠시 후 다시 시도해 주세요.');const state=this.read(),result=fn(state),clean=validateRecords(state);this.busy=true;try{const revision=await this.request('/rest/v1/rpc/save_member_records',{method:'POST',body:JSON.stringify({expected_revision:this.revision,next_records:clean})});if(this.closed)throw Error('로그인 상태가 바뀌었습니다. 계정 기록을 다시 확인해 주세요.');if(!Number.isSafeInteger(revision)||revision<=this.revision)throw Error('서버 저장 결과를 확인하지 못했습니다.');this.state=clean;this.revision=revision;return result;}finally{this.busy=false;}}
 close(){this.closed=true;this.state=null;}
}
export function localRecordsBackup(storage,at=new Date().toISOString()){const raw=storage.getItem(STORAGE_KEY);if(raw===null)throw Error('이 브라우저에 가져올 기존 기록이 없습니다.');return JSON.stringify({...validateRecords(JSON.parse(raw)),exportedAt:at});}
