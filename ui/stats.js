const statsRoot=document.querySelector('#stats-content');
let statsPeriod='month';
const statsLabels={day:'일간',week:'주간',month:'월간',year:'연간'};
const statsAdd=(tag,value,parent,cls)=>{const el=document.createElement(tag);el.textContent=value;if(cls)el.className=cls;parent.append(el);return el;};
const points=n=>n.toLocaleString('ko-KR')+'P';
function statsPeriodLabel(key,period){if(period!=='week')return key;const end=new Date(Date.parse(key+'T00:00:00Z')+6*86400000).toISOString().slice(0,10);return key+' ~ '+end;}
async function loadStats(){try{const browserLocal=document.documentElement.dataset.mode==='web-preview';let data;if(browserLocal)data=(await import('./browser-records.js')).browserStore().stats();else{const response=await fetch('/api/stats');if(!response.ok)throw Error();data=await response.json();}statsRoot.replaceChildren();
 const summary=statsAdd('div','',statsRoot,'stats-cards');
 for(const [period,label]of [['day','오늘'],['week','이번 주'],['month','이번 달'],['year','올해']]){const p=data.periods[period],g=p.groups.find(g=>g.key===p.current),card=statsAdd('article','',summary);statsAdd('span',label+' · 완료 기준 적립액',card);statsAdd('strong',points(g.assumedPoints),card);statsAdd('small','Npay '+g.npayCount+'건 · 이벤트 '+g.eventCount+'건'+(g.unknownPointsCount?' · 금액 미확인 '+g.unknownPointsCount+'건':''),card);}
 statsAdd('p',data.basis+' 주간은 월요일~일요일 기준입니다.',statsRoot,'time-note');
 const toolbar=statsAdd('div','',statsRoot,'stats-toolbar'),tabs=statsAdd('div','',toolbar,'stats-tabs');tabs.role='group';tabs.ariaLabel='통계 기간';
 for(const [period,label]of Object.entries(statsLabels)){const b=statsAdd('button',label,tabs,'button-light');b.ariaPressed=String(statsPeriod===period);b.addEventListener('click',()=>{statsPeriod=period;loadStats();});}
 const download=statsAdd('a','통계 CSV 저장 ↓',toolbar,'button-light');if(browserLocal){download.href='#';download.addEventListener('click',async event=>{event.preventDefault();try{const m=await import('./browser-records.js');m.downloadLocal(m.browserStore().csv(statsPeriod),'participation-'+statsPeriod+'.csv','text/csv;charset=utf-8');}catch(e){document.querySelector('#backup-result').textContent=e.message;}});}else download.href='/api/stats.csv?period='+statsPeriod;download.download='participation-'+statsPeriod+'.csv';
 statsAdd('h3',statsLabels[statsPeriod]+' 참여 내역',statsRoot,'stats-heading');
 const wrap=statsAdd('div','',statsRoot,'stats-table-wrap'),table=statsAdd('table','',wrap,'stats-table'),thead=statsAdd('thead','',table),head=statsAdd('tr','',thead);for(const label of ['기간','이벤트','Npay','완료 기준 적립액','내역'])statsAdd('th',label,head).scope='col';const tbody=statsAdd('tbody','',table);
 for(const g of data.periods[statsPeriod].groups){const row=statsAdd('tr','',tbody);statsAdd('th',statsPeriodLabel(g.key,statsPeriod),row).scope='row';statsAdd('td',g.eventCount+'건',row);statsAdd('td',g.npayCount+'건',row);const amount=statsAdd('td',points(g.assumedPoints),row);if(g.unknownPointsCount)statsAdd('small','미확인 '+g.unknownPointsCount+'건 제외',amount);const detailCell=statsAdd('td','',row);if(!g.items.length){detailCell.textContent='기록 없음';continue;}const details=statsAdd('details','',detailCell);statsAdd('summary',g.items.length+'건 보기',details);const items=statsAdd('ul','',details);for(const item of g.items){const li=statsAdd('li','',items);statsAdd('span',new Date(item.at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' · '+(item.type==='npay'?'Npay':'이벤트'),li);statsAdd('strong',item.title,li);if(item.type==='npay')statsAdd('small',item.points===null?'금액 미확인':points(item.points),li);}}
 statsAdd('p','전체 기록: 이벤트 '+data.total.eventCount+'건 · Npay '+data.total.npayCount+'건 · 완료 기준 적립액 '+points(data.total.assumedPoints),statsRoot,'time-note');statsAdd('p',data.eventBasis+' 통계는 저장된 참여 기록으로 계산합니다.',statsRoot,'time-note');
 }catch(e){statsRoot.replaceChildren();statsAdd('p',e.message||'통계를 읽지 못했습니다. 홈페이지를 새로고침해 주세요.',statsRoot,'notice');}}
document.querySelector('#stats-refresh').addEventListener('click',loadStats);
document.addEventListener('page-changed',()=>{if(document.body.dataset.page==='stats')loadStats();});
document.addEventListener('npay-auto-completed',()=>{if(document.body.dataset.page==='stats')loadStats();});
if(location.hash==='#stats')loadStats();


document.addEventListener('personal-records-changed',()=>{if(document.body.dataset.page==='stats')loadStats();});

