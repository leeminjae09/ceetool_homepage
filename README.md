# 씨툴 CEETOOL

개발 서비스와 프로젝트 수행 이력을 소개하는 단일 페이지 사이트입니다.
운영 주소는 https://ceetool.com 입니다.

## 기술 구성

- React 18, TypeScript, Vite 5, React Router
- Tailwind CSS 3, Heroicons
- 소개 사이트는 정적 파일로 배포
- 결제는 별도 Node.js 22.13 이상 API, SQLite 영구 저장, Google 관리자 로그인

## 개발 및 검증

프런트는 Node.js 18 이상, 결제 서버는 Node.js 22.13 이상이 필요합니다.
전체 개발에는 배포 환경과 같은 Node.js 22를 권장합니다. npm 잠금 파일을 사용합니다.

```sh
npm ci
npm run dev
```

개발 서버: http://localhost:3000

```sh
npm run lint
npx tsc -p tsconfig.app.json
npm run build
npm run preview
```

빌드 결과는 `dist`에 생성됩니다. 결제 서버의 자동화된 테스트는 아래 결제 항목을 참고하세요.

## 고객별 결제 링크

홈페이지에는 결제 메뉴를 추가하지 않습니다. 견적 확정 후 관리자가 링크를 발급하여 전달합니다.

- `/admin/payments`: 허용한 Google 계정으로 로그인, 링크 발급·복사, 결제 내역 조회
- `/pay/:token`: 결제 항목·금액·과세 구분·계약/환불조건·이름/연락처·동의·카드 결제
- `/pay/:token/result`: 서버에 저장된 결과 조회. 브라우저가 보내는 성공 여부를 신뢰하지 않습니다.
- `/api/payments/*`: 서버 전용 해시 생성, 승인, 모바일 form POST 반환, 서버 통지

결제 항목과 최종 원화 금액, 과세/면세, 유효기간, 계약·환불조건은 발급 후 수정할 수 없습니다.
변경이 필요하면 관리자에서 미결제 링크를 종료한 뒤 별도 링크를 발급합니다.
이미 승인 처리 중이거나 결제된 링크는 종료할 수 없으며 이 기능은 PG 취소가 아닙니다.
관리자가 선택한 과세/면세가 실제 MID 계약 조건과 일치하는지 확인해야 합니다.
고객 이름·연락처는 서버에만 저장하며 공개 결과 API에는 포함하지 않습니다.
고객 링크는 비밀 토큰이므로 담당 고객 외에는 공유하지 마세요.
확인 중인 주문에 새 링크를 발급하여 재결제시키지 말고 PaySM 거래부터 확인하세요.

### 서버 전용 환경변수

로컬에서는 [서버 설정 예시](server/.env.example)를 `server/.env`로 복사합니다.
실제 값은 Git에 커밋하거나 `VITE_` 변수, GitHub 빌드 결과, 브라우저에 넣지 않습니다.

```dotenv
PAYSM_MID=발급받은_실가맹점_MID
PAYSM_MERCHANT_KEY=발급받은_Merchant_Key
GOOGLE_CLIENT_ID=Google_OAuth_웹_Client_ID
GOOGLE_CLIENT_SECRET=Google_OAuth_Client_Secret
ADMIN_GOOGLE_EMAILS=john@ceetool.com
```

이메일은 쉼표로 여러 개 지정할 수 있습니다. 목록이 비어 있으면 아무 계정도 허용하지 않습니다.
`.env`에 `NODE_ENV`를 지정할 필요는 없습니다. 운영 서비스가 내부적으로 `production`을 강제하여
HTTPS 전용 쿠키 등 운영 보안 설정을 유지합니다. 결제 API의 운영 포트는 `3888`입니다.
Google Cloud Console에서 OAuth **웹 애플리케이션** 클라이언트를 만들고,
승인된 리디렉션 URI를 정확히 등록합니다.

```text
https://ceetool.com/api/payments/admin/callback
```

Google 동의 화면에서도 운영할 관리자 계정이 로그인 가능한 상태여야 합니다.
관리자 로그인은 state·PKCE·nonce·검증된 이메일과 허용 목록을 확인합니다.
Google access/refresh token은 저장하지 않습니다. 관리자 세션은 8시간이며
운영 쿠키는 Secure·HttpOnly·SameSite=Lax, 변경 요청은 Origin·CSRF를 검사합니다.

`https://api.skyclassism.com`과 `https://ceetool.com`은
[서버 상수](server/src/config.mjs)에 고정되어 있으며 `.env`에 넣지 않습니다.
테스트 MID로 자동 전환하지 않습니다. 설정이 없으면 결제/로그인 요청을 HTTP 503으로 거부합니다.
공개 포트폴리오는 설정 여부와 관계없이 계속 동작합니다.

### 로컬 실행 및 과금 없는 검증

```sh
npm ci --prefix server --ignore-scripts
npm --prefix server start
```

다른 터미널에서 `npm run dev`를 실행합니다.
Vite가 `/api/payments`를 `127.0.0.1:3888`로 프록시합니다.
Google OAuth 반환 주소는 운영 사이트로 고정되어 실제 Google 로그인은 운영 주소에서 진행합니다.
Node.js 22의 내장 SQLite를 사용하며 해당 런타임에서는 실험 기능 경고가 표시될 수 있습니다.

```sh
npm --prefix server run check
npm --prefix server test
npm run lint
npm run build
```

테스트는 가짜 PaySM·Google 응답과 임시 DB를 사용하며 실제 승인이나 과금을 하지 않습니다.
금액 변조·중복/동시 승인·응답 유실·위조 통지·모바일 반환·세션/CSRF·허용 계정·보관/백업을 검사합니다.

### 결제 결과·통지 처리

PC는 PaySM iframe의 origin과 window 참조를 확인하고, 모바일은 서버의 반환 URL에서 POST를 받습니다.
서버는 저장된 주문금액·MID·요청 시각·거래번호를 대조한 뒤 `/payment.do`를 form 인코딩으로 호출합니다.
`signData`는 수정하지 않으며 인증 성공만으로 결제 완료 처리하지 않습니다.
동기 승인 `resultCd=0000`과 일치하는 거래정보를 확인해야 완료 처리합니다.
동일 주문의 중복 요청은 재승인하지 않으며 응답 유실이나 서버 재시작은 **확인 중**으로 남깁니다.

통지는 해시·거래번호·금액·중복·순서를 검증합니다.
카드 승인 통지 `3001` 또는 `0000` + `cancelYN=N`은 자동 완료 처리합니다.
`0000` + `cancelYN=Y` 및 취소 통지 `2001`은 취소 확인 대상으로 남기며
이후 도착한 승인 통지가 취소 거래를 다시 완료 처리하지 않습니다.
`cancelYN`이 없거나 모순된 `0000`, 불일치/알 수 없는 코드는 성공·환불로 추정하지 않습니다.
통지 원본 결과코드는 보존하고 내부 마지막 통지 코드는 승인 `3001`, 취소 `2001`로 정규화합니다.
검증된 정상 승인 응답은 자동으로 결제 완료 처리하며 수동 완료 처리가 기본 흐름은 아닙니다.
고객의 확인 중 화면에는 결제사명이나 운영자용 통지 안내를 노출하지 않습니다.
결제창 자체에 표시되는 결제사·카드사 표시는 외부 서비스에서 관리합니다.
취소와 부분취소는 이 화면에서 실행하지 않으며 PaySM 관리자·계약 안내에 따라 처리합니다.

참고: [PaySM 인증결제](https://paysm.co.kr/developers/auth-payment.html),
[공통 규칙](https://paysm.co.kr/developers/getting-started.html),
[결과코드](https://paysm.co.kr/developers/result-codes.html),
[취소](https://paysm.co.kr/developers/cancel.html),
[영수증 조회](https://paysm.co.kr/developers/receipt.html).

배포 시 백업을 만든 뒤 기존 `확인 중` 거래를 `/receipt.do` GET으로 최대 5건 조회합니다.
기존 `0000` 통지 또는 승인 응답 유실 건만 대상으로 하며 승인·취소 요청은 보내지 않습니다.
조회 성공, 거래번호·금액·주문번호(제공 시) 일치 및 `TRX_ST_CD=0`을 확인해야 복구합니다.
조회 중 새 통지가 도착하면 해당 결과로 덮어쓰지 않습니다. 기존 결제일은 유지하며 없으면 복구 시각을 기록합니다.
취소·불일치·조회 실패는 명시적으로 기록하고 `확인 중`을 유지합니다.
결과는 배포 로그의 `payment_reconciliation` 건수로 확인합니다.
추가 확인은 호출 제한(MID당 분당 5회)을 고려해 최소 1분 후 서버에서 실행합니다.

```sh
PAYMENT_DB_PATH=/home/ubuntu/ceetool-payments/data/payments.sqlite \
  /home/ubuntu/ceetool-payments/current/runtime/node \
  --env-file=/home/ubuntu/ceetool-payments/.env \
  /home/ubuntu/ceetool-payments/current/server/src/reconcile.mjs
```

### 운영 설정·저장·백업

첫 배포가 비어 있는 `/home/ubuntu/ceetool-payments/.env`를 생성합니다.
로컬 `.env`는 운영 서버로 자동 전송되지 않습니다. 서버에서만 실제 값을 입력한 뒤:

기존 설정 파일은 배포가 덮어쓰지 않으므로 `ADMIN_GOOGLE_EMAILS=john@ceetool.com`,
`PORT=3888`로 수정하고 `NODE_ENV=development` 줄은 삭제합니다.

```sh
sudo systemctl restart ceetool-payments
curl -fsS http://127.0.0.1:3888/api/payments/health
```

`paymentConfigured`와 `adminConfigured`가 모두 `true`인지 확인합니다.
로그는 `sudo journalctl -u ceetool-payments`로 확인하며 키·카드·인증 원문은 기록하지 않습니다.

- 코드·격리된 Node 런타임: `/home/ubuntu/ceetool-payments/releases/<커밋>/`
- 현재 코드: `/home/ubuntu/ceetool-payments/current`
- 영구 DB: `/home/ubuntu/ceetool-payments/data/payments.sqlite`
- 일일 일관성 백업: 같은 `data/backups` 아래, 최대 7개/7일 보관
- 자동 백업: `ceetool-payments-backup.timer` (UTC 19시, 한국 시간 다음 날 04시 부근)

DB·설정·백업은 웹 공개 폴더 및 코드 릴리스와 분리하며 다음 배포에 덮어쓰지 않습니다.
운영 프로세스의 umask는 0077입니다. 이름·연락처는 미결제 만료 후 30일, 완료 거래는 결제 후 5년 기준으로 정리합니다.
백업은 같은 서버에 있으므로 서버 자체 장애에 대비한 EBS 스냅샷 등 외부 백업도 별도로 운영하세요.
복원할 때는 신규 결제를 차단하고 PaySM 거래와 대조해야 하며 과거 미결제 상태를 그대로 재개하면 안 됩니다.

## 콘텐츠 수정

- [메인 화면](src/app/app.tsx): 소개 문구, 카카오톡 문의, 사업자 정보
- [서비스 데이터](src/app/services.ts): 서비스 설명과 프로젝트 목록
- [포트폴리오 데이터](src/app/portfolio.ts): DSWAR·신이·C9Pro의 외부 주소와 사진·영상
- [서비스 카드](src/components/organisms/card/card.tsx): 카드 레이아웃
- [프로젝트 미리보기](src/components/ProjectDialog.tsx): PC 모달 및 모바일 전체 화면
- [기존 상세 화면](src/components/ProjectPage.tsx): 6개 `/docs/:docType` 직접 접속 경로 유지
- [프로젝트 갤러리](src/components/organisms/project-details/project-details.tsx): 사진·영상 표시
- [전역 스타일](src/index.css), [Tailwind 설정](tailwind.config.js): 배경과 공통 스타일
- [정적 파일](public): `logos`의 로고, 프로젝트 미디어의 기존 원본, 파비콘, 웹 매니페스트

텔레그램 연락처는 표시하지 않습니다. 프로젝트 수행 이력의 텔레그램 알림 기능 설명은 유지합니다.

## 프로젝트 사진·영상

프로젝트 미리보기와 기존 상세 화면의 사진, 영상, 썸네일은 비공개 S3 버킷 `ceetool-image`를
원본으로 하는 CloudFront 배포에서 제공합니다.

- 미디어 기본 주소: `https://d2fgd6q9oovwa9.cloudfront.net/projects`
- S3 객체 키 예시: `projects/c9pro/c9pro-ex1.mp4` (`images/` 접두사 없음)
- S3 리전: 서울 (`ap-northeast-2`)
- S3 퍼블릭 액세스는 차단하고 CloudFront OAC로 읽기 허용

미디어를 추가할 때 S3의 `projects/프로젝트명/` 아래에 업로드하고
[포트폴리오 데이터](src/app/portfolio.ts)의 경로에 반영합니다.
CloudFront 도메인을 변경하면 같은 파일의 `mediaBaseUrl`을 수정합니다.
로고와 공유 이미지는 계속 홈페이지 서버에서 제공합니다.
기존 로컬 미디어 파일은 보존하지만 화면에서 자동 대체 파일로 사용하지 않습니다.
동일한 객체 키를 덮어쓰면 캐시가 남을 수 있으므로 새 파일명을 사용하거나
CloudFront에서 해당 경로를 무효화합니다.

홈페이지의 프로젝트 이름을 누르면 페이지 이동 없이 상세 보기가 열립니다.
현재 자료가 있는 DSWAR·신이·C9Pro에만 미리보기와 외부 사이트 링크를 제공합니다.
다른 프로젝트는 기존 설명을 유지하고, 분야별 "프로젝트 자세히 보기" 버튼은 표시하지 않습니다.
768px 미만에서는 전체 화면, 그 이상에서는 중앙 모달로 표시합니다.
닫기 버튼이나 Escape로 닫으면 목록 위치와 초점을 복원하고 영상 재생을 중단합니다.
PC에서는 배경 클릭으로도 닫을 수 있습니다.
기존 `/docs/:docType` 주소는 호환성을 위해 유지하며 같은 포트폴리오 데이터를 사용합니다.
상세 보기에는 제목 옆 새 창 사이트 링크와 핵심 기능을 짧게 표시하며, 갤러리 사용법 안내 문구는 넣지 않습니다.

갤러리의 `media`는 비어 있지 않은 배열이며, 사진은 `type`, `src`, `alt`,
영상은 여기에 `poster`를 추가합니다.
영상은 자동재생하지 않고 포스터를 먼저 표시하며 `preload="none"`으로
사용자가 재생하기 전의 영상 데이터 다운로드를 줄입니다.
사진은 지연 로딩하고, 썸네일은 키보드로 선택할 수 있는 가로 스크롤 버튼으로 제공합니다.
미디어를 불러오지 못하면 오류 안내와 다시 시도 버튼을 표시합니다.

## 인증정보 관리

환경변수 파일, 로컬 접속 설정, 개인키 파일은 `.gitignore`에서 제외합니다.
`.env.example`에는 실제 비밀 값 없이 설정 이름과 예시만 기록합니다.
배포용 개인키는 GitHub Actions Secrets의 `SSH_PRIVATE_KEY`로 관리하며,
소스 코드나 브라우저에 전달되는 `VITE_` 환경변수에 넣지 않습니다.
이미 커밋된 비밀 값은 `.gitignore`로 제거되지 않으므로 노출 시 폐기·재발급해야 합니다.

## 검색 및 공유 정보

[HTML 진입 파일](index.html)에 한국어 문서 설정, 검색 설명, canonical,
Open Graph와 Twitter 카드 메타데이터를 정의합니다.
공유 이미지는 기존 회사 로고를 사용합니다.

운영 도메인을 변경할 때는 HTML의 절대 주소와 함께 다음 파일도 수정합니다.

- [웹 매니페스트](public/manifest.webmanifest)
- [robots.txt](public/robots.txt)
- [사이트맵](public/sitemap.xml)
- [패키지 정보](package.json)의 `homepage`

## 배포

[GitHub Actions 워크플로](.github/workflows/deploy.yml)는 `main` 브랜치 push 또는
수동 실행 시 다음 작업을 수행합니다. 운영 배포는 한 번에 하나씩 실행합니다.

1. Actions에서 해당 커밋을 체크아웃하고 Node.js 22 설정
2. 프런트 설치·린트, 결제 서버 설치·구문 검사·과금 없는 테스트, 프런트 빌드
3. 커밋 해시를 `dist/deployment.txt`에 기록
4. SCP로 `dist`와 결제 서버·의존성·검증한 Linux x64 Node 22 런타임 묶음을 전송
5. 정적 파일 접근 권한 설정, 결제 서비스 릴리스 전환·재시작, 일일 백업 설정
6. 대상 도메인과 정적 root가 일치하는 기존 Nginx 가상호스트에만 결제 경로 include 추가
7. 운영 HTTPS 커밋·HTML·결제 API 상태와 관리자 화면 응답 확인

검사·빌드·전송·운영 확인 중 하나라도 실패하면 배포가 실패로 표시됩니다.
SSH 접속 키는 기존 GitHub Actions의 `SSH_PRIVATE_KEY` 시크릿을 사용합니다.
서버의 GitHub 인증, Git 소스 동기화, npm 설치/빌드, PM2는 필요하지 않습니다.
홈페이지는 여전히 Nginx 정적 파일입니다. 새 결제 API만 systemd로 실행·재시작합니다.
서버의 기존 Node 설치는 변경하지 않습니다. 배포 대상은 x86_64 Linux이며 다른 아키텍처는 명시적으로 거부합니다.
Nginx 변경은 기존 설정을 백업하고 `nginx -t` 통과 후 reload하며 실패하면 원래 설정을 복원합니다.
대상 가상호스트를 안전하게 특정하지 못하면 다른 호스트를 수정하지 않고 배포를 중단합니다.
이 경우 [결제 Nginx 설정](server/deploy/nginx.conf)을 `/etc/nginx/snippets/ceetool-payments.conf`에 설치하고
CEETOOL 정적 사이트의 `server` 블록에 `include /etc/nginx/snippets/ceetool-payments.conf;`를 추가합니다.
구문 검사 후 Nginx를 reload하고 배포를 다시 실행합니다.
이전 페이지의 캐시가 참조할 수 있는 해시 기반 에셋은 전송 시 삭제하지 않습니다.
서버의 정적 파일을 직접 수정하면 다음 배포 시 덮어써지므로 저장소에서 수정해야 합니다.

## 라이선스

원본 Vital 템플릿의 MIT 저작권 고지는 [LICENSE](LICENSE)에 보존합니다.
