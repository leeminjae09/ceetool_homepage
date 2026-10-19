# 씨툴 CEETOOL

개발 서비스와 프로젝트 수행 이력을 소개하는 단일 페이지 사이트입니다.
운영 주소는 https://ceetool.com 입니다.

## 기술 구성

- React 18, TypeScript, Vite 5
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
- [서비스 카드](src/components/organisms/card/card.tsx): 카드 레이아웃
- [전역 스타일](src/index.css), [Tailwind 설정](tailwind.config.js): 배경과 공통 스타일
- [정적 파일](public): 로고, 파비콘, 웹 매니페스트

텔레그램 연락처는 표시하지 않습니다. 프로젝트 수행 이력의 텔레그램 알림 기능 설명은 유지합니다.

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
수동 실행 시 운영 서버에 SSH로 접속하여 다음 작업을 수행합니다.

1. 서버 소스를 `origin/main`으로 동기화
2. `npm ci` 및 `npm run build` 실행
3. PM2의 `ceetool` 프로세스 재시작
4. Nginx의 정적 파일 접근을 위한 권한 설정

SSH 접속 키는 GitHub Actions의 `SSH_PRIVATE_KEY` 시크릿을 사용합니다.
Nginx 및 PM2 실행 설정은 이 저장소에 포함되어 있지 않습니다.
서버에서 직접 수정한 소스는 다음 배포 시 덮어써지므로 저장소에서 수정해야 합니다.

## 라이선스

원본 Vital 템플릿의 MIT 저작권 고지는 [LICENSE](LICENSE)에 보존합니다.
