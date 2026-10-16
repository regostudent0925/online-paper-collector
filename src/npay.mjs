import {validInstant} from './core.mjs';
// 광고에 접근하거나 적립하지 않고, 검증 기록의 완전성만 확인한다.
export function assessNpay(item,at){
  const reasons=[];const c=item.conditions||{};
  if(!item.id||!item.campaignId||!item.round)reasons.push('광고·회차 식별 미확인');
  if(!['click','visit'].includes(item.action))reasons.push('클릭·방문형 범위 아님');
  if(item.verification?.publicConditions!==true||item.verification?.accepting!==true)reasons.push('공개 조건·현재 접수 미확인');
  if(!validInstant(at)||!validInstant(item.checkedAt)||Date.parse(item.checkedAt)>Date.parse(at)||Date.parse(at)-Date.parse(item.checkedAt)>86400000)reasons.push('24시간 내 조건 재확인 필요');
  for(const key of ['purchase','payment','subscription','follow','marketing','signup','appInstall','identityVerification']){
    if(c[key]!==false)reasons.push('필수 조건 확인 필요: '+key);
  }
  for(const key of ['login','mobileOnly'])if(typeof c[key]!=='boolean')reasons.push('이용 환경 미확인: '+key);
  if(!Number.isFinite(item.points)||item.points<0||!['guaranteed','first-come','lottery','random'].includes(item.method))reasons.push('적립 금액·지급 방식 미확인');
  if(!item.repeatRule||!item.privacySummary)reasons.push('중복·개인정보 조건 미확인');
  try{const u=new URL(item.officialUrl);if(u.protocol!=='https:'||!(u.hostname==='naver.com'||u.hostname.endsWith('.naver.com'))||u.username||u.password)throw Error();}catch{reasons.push('공식 근거 URL 미확인');}
  if(!item.evidenceUrls?.length)reasons.push('공식 조건 근거 미확인');
  return {eligible:!reasons.length,reasons};
}
export function npayView(data,at){
  if(data.schema!=='npay-click-guide-v1'||!Array.isArray(data.items))throw Error('NPAY_DATA_INVALID');
  const seen=new Set(),items=[],withheld=[];
  for(const item of data.items){const key=JSON.stringify([item.campaignId,item.round]);if(item.campaignId&&item.round&&seen.has(key))continue;seen.add(key);const result=assessNpay(item,at);if(result.eligible)items.push(item);else withheld.push({id:item.id,title:item.title,reasons:result.reasons});}
  return {...data,items,withheld};
}
