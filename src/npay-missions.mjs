import {validInstant,seoulDate} from './core.mjs';
export const MISSION_URL='https://point.pay.naver.com/pc/mission-detail?dataType=placement&rank=1&pageKey=benefit_group_pp&rankType=RANDOM_DAILY&sortCompletedAdToLast=true&mssCode=pp';
export function missionLink(raw){try{const u=new URL(raw);if(u.protocol!=='https:'||u.hostname!=='point.pay.naver.com'||u.port||u.username||u.password||u.pathname!=='/bridge/eventbenefit'||!/^\d+$/.test(u.searchParams.get('adId')||''))return null;
 const q=new URLSearchParams();for(const key of ['fromPage','inventory','placementId','adId']){const value=u.searchParams.get(key);if(!value)return null;q.set(key,value);}
 if(q.get('fromPage')!=='DETAIL_FROM_BANNER'||q.get('inventory')!=='pay>benefit_group'||q.get('placementId')!=='benefit_group_pp')return null;
 return 'https://point.pay.naver.com/bridge/eventbenefit?'+q.toString();}catch{return null;}}
export function missionRecords(snapshot){
 if(snapshot.schema!=='npay-mission-snapshot-v1'||snapshot.sourceUrl!==MISSION_URL||!validInstant(snapshot.checkedAt)||!Array.isArray(snapshot.rows))throw Error('MISSION_SNAPSHOT_INVALID');
 if(!snapshot.rows.length&&snapshot.emptyListVerified!==true)throw Error('MISSION_EMPTY_UNVERIFIED');
 const seen=new Set(),records=[];
 for(const row of snapshot.rows){const link=missionLink(row.link);if(!link)throw Error('MISSION_LINK_INVALID');const id=new URL(link).searchParams.get('adId');if(id!==row.adId)throw Error('MISSION_ID_MISMATCH');if(seen.has(id))continue;seen.add(id);
 const lines=String(row.label).split('\n').map(s=>s.trim()).filter(Boolean),points=/^(\d+)원$/.exec(lines[1]||'');if(lines[0]!=='클릭'||!points||lines.length<4)throw Error('MISSION_LABEL_UNCONFIRMED');
 let title=lines[3]+' · '+lines[2],priorTitles=[];
 if(id==='1217967'&&lines[3]==='네이버 현대카드 Ed.3')title='네이버 현대카드 Ed.3';
 if(id==='1207727'&&lines[3]==='네이버 클립 선플을 응원해')title='클립 챌린지 · 선플을 응원해';
 if(id==='1201240'&&lines[3]==='오늘 클립 챌린지'){title='오늘 클립 챌린지';priorTitles=['오늘 클립 챌린지 ①','오늘 클립 챌린지 ②'];}
 records.push({id:'official-mission-'+id,campaignId:'npay-ad-'+id,rewardKey:'official-mission:'+id,round:'공식 광고ID 기준 · 회차 미공개',title,priorTitles,claimedPoints:Number(points[1]),pointBasis:'official-list',listingActive:true,action:'click',adUrl:link,sourceUrl:MISSION_URL,sourceName:'Npay 공식 미션 목록',sourceDate:seoulDate(Date.parse(snapshot.checkedAt)),checkedAt:snapshot.checkedAt,conditionsText:'공식 목록에서 클릭 '+points[1]+'원으로 표시. 광고 제목의 상품·금융 혜택과 클릭 보상은 구분. 최종 적립 화면 조건은 미확인.',repeatRule:null,unknowns:['현재 실제 지급·계정별 대상','체류 시간·추가 동작·최종 동의','구매·가입·개인정보 필수 여부','개별 URL의 요청 식별자 제거 후 연결 동작','동일 광고의 재적립 가능 여부'],verification:{officialListRead:true,officialConditions:false,rewardLinkOpened:false,individualLinkVerified:false},observedLabel:lines.join(' / '),linkNote:'원래 목록 href에서 조회별 requestId를 제거한 주소. 연결은 사용자 확인 필요.'});
 }
 return records;
}
export function mergeMissions(data,snapshot){const rows=missionRecords(snapshot),byId=new Map((data.directLinks||[]).map(r=>[r.id,r.pointBasis==='official-list'?{...r,listingActive:false}:r]));for(const row of rows){const prior=byId.get(row.id);if(prior?.adUrl===row.adUrl&&prior?.verification?.individualLinkVerified===true){row.verification.individualLinkVerified=true;row.linkConfirmation=prior.linkConfirmation;row.linkNote=prior.linkNote;}byId.set(row.id,row);}return {...data,checkedAt:snapshot.checkedAt,summary:'Npay 공식 미션 목록의 하단까지 '+rows.length+'개 확인. 표시 금액은 공식 목록 기준이며 실제 지급·최종 조건은 미확인. 개별 연결 확인은 항목별 기록 참조.',directLinks:[...byId.values()],missionSource:{url:MISSION_URL,checkedAt:snapshot.checkedAt,count:rows.length,coverage:snapshot.coverage,loginRequired:true,personalization:'목록이 계정·시점에 따라 달라질 수 있음',requestIdentifiersStored:false}};}
