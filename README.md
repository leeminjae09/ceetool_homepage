# 씨툴 CEETOOL

개발 서비스와 프로젝트 수행 이력을 소개하는 단일 페이지 사이트입니다.
운영 주소는 https://ceetool.com 입니다.

## 기술 구성

- React 18, TypeScript, Vite 5, React Router
- Tailwind CSS 3, Heroicons
- 별도 백엔드나 데이터베이스 없이 정적 파일로 배포

## 개발 및 검증

Node.js 18 이상과 npm이 필요합니다. 배포 환경과 동일하게 npm 잠금 파일을 사용합니다.

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

빌드 결과는 `dist`에 생성됩니다. 현재 자동화된 단위 테스트는 없습니다.

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
2. `npm ci`, `npm run lint`, `npm run build` 실행
3. 커밋 해시를 `dist/deployment.txt`에 기록
4. SCP로 `dist`를 서버의 `/home/ubuntu/ceetool_homepage/dist`에 전송
5. SSH로 정적 파일 접근 권한 설정
6. 운영 HTTPS 주소에서 커밋 해시와 HTML을 받아 빌드 결과와 비교

검사·빌드·전송·운영 확인 중 하나라도 실패하면 배포가 실패로 표시됩니다.
SSH 접속 키는 기존 GitHub Actions의 `SSH_PRIVATE_KEY` 시크릿을 사용합니다.
서버의 GitHub 인증, 소스 동기화, Node.js 빌드, PM2 재시작은 필요하지 않습니다.
기존 Nginx가 `dist`의 정적 파일을 제공하며 Nginx 설정은 저장소에 포함되어 있지 않습니다.
이전 페이지의 캐시가 참조할 수 있는 해시 기반 에셋은 전송 시 삭제하지 않습니다.
서버의 정적 파일을 직접 수정하면 다음 배포 시 덮어써지므로 저장소에서 수정해야 합니다.

## 라이선스

원본 Vital 템플릿의 MIT 저작권 고지는 [LICENSE](LICENSE)에 보존합니다.
