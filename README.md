# 온라인 폐지줍기 - 티끌모아 태산

실제 운영 앱의 소스 저장소입니다. HTML/CSS/JavaScript 화면과 로컬 Node.js 서버, Chrome 보조 확장으로 구성됩니다. 행사 참여·로그인·포인트 받기·동의는 사용자가 직접 수행합니다.

## 실행

Node.js 22 이상, 외부 npm 의존성·API 키 불필요.

```powershell
npm run setup
npm run choices
```

http://127.0.0.1:4179/ 에서 오늘의 이벤트·Npay·참여 통계를 확인합니다. setup은 data 파일이 없을 때만 공개 조사 예제를 복사하며 기존 데이터·참여 기록을 덮어쓰지 않습니다. 예제는 과거 확인 자료이므로 현재 접수·지급 조건을 다시 확인해야 합니다. 실제 기록이 없는 새 설치의 통계는0입니다.

## 기능

- 이벤트 게시판: 정답 즉시 표시, 상세 조건 펼치기, 상태 선택·저장
- Npay: 검색·정렬·완료 목록·재적립 확인 전 재노출 방지
- 보조 확장: 사용자가 포인트 받기 또는 지정된 기참여 안내 확인을 누른 뒤5초에 소유 탭만 닫고 로컬 완료 보관
- 통계: 한국시간 일간·주간(월요일 시작)·월간·연간 및 CSV. 표시 포인트를 지급되었다고 가정하되 기참여 안내로 보관한 적립일 미확인 항목은 새 기간 합계에서 제외

확장 설치는 browser-helper/README.md 참조. 새 권한은 별도 사용자 승인이 필요합니다. 기존 일일 예약은 Codex 앱의 로컬 자동화이며 GitHub/Vercel만으로 실행되지 않습니다. 예약 식별자·현재 설정은 저장소에 포함하지 않았습니다.

## 변경 관리

```powershell
npm run git:check
npm run git:publish -- "변경 내용을 한 줄로 설명"
```

publish는 허용된 코드·문서만 스테이징 → 경로·대표 비밀정보 패턴 점검 → 전체 테스트 → 변경 중인 파일 여부 점검 → 커밋 → origin의 현재 브랜치 업로드 순서입니다. Git 인증이 준비되어 있어야 합니다. 강제 push는 하지 않으며 실패하면 오류를 확인하고 중단합니다. 파일을 저장하는 즉시 무조건 업로드하는 감시 작업은 없습니다.

단독 테스트: `npm test`

## 보관 경계

추적: src, ui, browser-helper, test, 명시한 tools, 설정·문서, examples/data의 공개 조사 예제.
제외: 실제 data·state(참여 이력/통계 원본)·verification·output·exports·automation-config.json·automation-existing.json·TASK 파일·비밀정보·의존성.

참여 기록은 이 컴퓨터의 state 폴더에 남습니다. GitHub는 개인 참여 기록의 백업이 아닙니다. 로컬 데이터의 별도 보관은 사용자가 관리합니다. examples/data에는 사용자 참여 표시·확인 이력·개인 선택을 제거한 공개 조사 자료만 포함했습니다.

이 공개 운영 코드 저장소는 공개 v0 디자인 사본(online-paper-collector-design)과 분리됩니다. 디자인 사이트의 v0 변경은 운영 코드로 자동 병합하지 않습니다.


## Vercel 웹 배포

GitHub 운영 저장소의 main 변경을 Vercel에 자동 배포하도록 연결합니다. 저장 → 검증·커밋 → GitHub 업로드 → Vercel 빌드 → 새 웹 화면 순서이며 파일 저장만으로 배포되지 않습니다.

`npm run build`는 dist에 정적 웹 미리보기를 만듭니다. Vercel은 vercel.json의 buildCommand/outputDirectory를 사용합니다. 빌드는 published/catalog.json의 검증된 공개 사본을 읽으며, 사본이 없는 새 설치에서는 examples/data 예제를 사용합니다. 실제 data/state는 배포 입력으로 읽지 않습니다. 이벤트 상태 저장, 개인 통계, Chrome 자동 닫기는 로컬 주소에서 사용합니다. 웹의 통계는 빈 상태이며 사이트에 이를 표시합니다. 매일 조사 뒤 public:export로 허용된 공개 필드만 내보내고 GitHub에 업로드하면 Vercel에 자동 반영됩니다. 기존 로컬 오전9시 조사 예약을 클라우드 실행으로 바꾸지는 않습니다.

배포 주소: https://online-paper-collector.vercel.app/
Vercel 프로젝트: https://vercel.com/lee-9bfb/online-paper-collector
GitHub 소스: https://github.com/regostudent0925/online-paper-collector (main)
기존 디자인 검토: https://online-paper-collector-design.vercel.app/ (별도 저장소)


## 매일 공개 목록 갱신

`npm run public:export`는 로컬 조사자료에서 검증된 공개 필드만 `published/catalog.json`으로 내보냅니다. 원본 객체의 알 수 없는 필드·참여 선택·이력·계정·완료·통계·완료ID 기반 재적립 증거를 제외합니다. state 폴더는 열지 않으며, 의심 개인정보 텍스트·허용되지 않은 URL 쿼리는 오류로 중단합니다. 변경이 없으면 같은 사본을 다시 저장하거나 커밋하지 않습니다. GitHub에는 이 파일 한 개만 일일 갱신합니다. 인증은 연결된 GitHub 커넥터 또는 기존 Git 인증을 사용하며 새 토큰을 소스에 저장하지 않습니다.

매일9시 기존 Codex 작업에 내보내기→검사→GitHub main 업로드→Vercel Ready 확인 절차를 추가했습니다. PC와 Codex가 켜져 있어야 새 조사를 수행합니다. PC가 꺼져 있어도 이미 배포된 사이트는 열립니다.

공개 웹은 방문자 공통 목록입니다. 개인별 참여완료·미관심 제외 결과를 공개 목록에 반영하지 않습니다. 따라서 로컬 목록과 개수가 다를 수 있으며, 웹 개인 통계는0입니다. 실제 개인정보와 개인 선택은 계속 로컬에만 남습니다. 새 필드를 공개하려면 src/public-catalog.mjs의 허용 목록과 검사를 명시적으로 수정해야 합니다.
