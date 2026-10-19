import {execFileSync} from 'node:child_process';import path from 'node:path';import fs from 'node:fs';import {fileURLToPath} from 'node:url';
import {validatePublicCatalog} from '../src/public-catalog.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const git=(args,extra={})=>execFileSync('git',args,{cwd:root,encoding:'utf8',...extra});
const allowed=p=>p==='published/catalog.json'||['.gitignore','README.md','AGENTS.md','package.json','vercel.json'].includes(p)||/^(src|ui|test|browser-helper)\/[\w./-]+\.(?:mjs|js|css|html|json|md)$/.test(p)||/^examples\/data\/(events|direct-events|npay|sources)\.json$/.test(p)||/^tools\/(git-publish|setup-local-data|import-npay-missions|build-vercel|export-public)\.mjs$/.test(p);
function checkPaths(paths){for(const p of paths){if(!allowed(p)||/(?:^|\/)(?:\.env[^/]*|node_modules|state|verification|exports|data|\.git)(?:\/|$)/.test(p)&&!p.startsWith('examples/data/'))throw Error('업로드 범위 밖 파일: '+p);}}
try{
 const tracked=git(['ls-files','-z']).split('\0').filter(Boolean);checkPaths(tracked);
 // 변경을 무조건 포함하지 않는다. 보호 폴더는 gitignore로 제외하며 소스만 추가한다.
 git(['add','--','.gitignore','README.md','AGENTS.md','package.json','vercel.json','src','ui','test','browser-helper','examples','tools','published/catalog.json']);
 const staged=git(['diff','--cached','--name-only','-z']).split('\0').filter(Boolean);checkPaths(staged);
 for(const p of staged){const abs=path.join(root,p);if(!fs.existsSync(abs))continue;if(fs.lstatSync(abs).isSymbolicLink())throw Error('심볼릭 링크 제외: '+p);const body=git(['show',':'+p]);if(p==='published/catalog.json')validatePublicCatalog(JSON.parse(body));if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{30,}|\bsk-proj-[A-Za-z0-9_-]{30,}/.test(body))throw Error('비밀정보 의심: '+p);}
 if(process.argv.includes('--check')){console.log('업로드 범위 점검 통과 · 준비된 변경 '+staged.length+'개');process.exit(0);}
 const message=process.argv.slice(2).join(' ').trim();if(!message)throw Error('사용: npm run git:publish -- "변경 설명"');
 execFileSync(process.execPath,['--test',...fs.readdirSync(path.join(root,'test')).filter(p=>p.endsWith('.test.mjs')).map(p=>'test/'+p)],{cwd:root,stdio:'inherit'});
 git(['diff','--exit-code'],{stdio:'inherit'});
 git(['-c','core.whitespace=-blank-at-eof','diff','--cached','--check'],{stdio:'inherit'});
 if(staged.length)git(['commit','-m',message],{stdio:'inherit'});
 // 강제 업로드하지 않는다. 원격 변경과 충돌하면 멈추고 검토한다.
 git(['push','origin','HEAD'],{stdio:'inherit',timeout:60000,env:{...process.env,GIT_TERMINAL_PROMPT:'0'}});
 console.log('GitHub 업로드 완료');
}catch(e){console.error(e.message);process.exitCode=1;}

