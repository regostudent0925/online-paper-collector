import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
fs.mkdirSync(path.join(root,'data'),{recursive:true});
for(const name of ['events.json','direct-events.json','npay.json','sources.json']){const dest=path.join(root,'data',name);if(fs.existsSync(dest)){console.log('유지: data/'+name);continue;}fs.copyFileSync(path.join(root,'examples/data',name),dest,fs.constants.COPYFILE_EXCL);console.log('생성: data/'+name);}
console.log('기존 데이터·참여 기록은 덮어쓰지 않습니다. 포함된 공개 조사 자료의 확인 시각·종료 여부를 다시 확인하세요.');
