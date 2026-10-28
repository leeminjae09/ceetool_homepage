# 씨툴 CEETOOL

개발 서비스와 프로젝트 수행 이력을 소개하는 단일 페이지 사이트입니다.
운영 주소는 https://ceetool.com 입니다.

## 기술 구성

- React 18, TypeScript, Vite 5, React Router
- Tailwind CSS 3, Heroicons
- 소개 사이트는 정적 파일로 배포
- 결제는 별도 Node.js 22.13 이상 API, MySQL 8 영구 저장, Google 관리자 로그인

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

- `/admin`: 허용한 Google 계정으로 로그인. **결제 관리**에서 링크 발급·결제 내역 조회, **홈페이지 관리**에서 카테고리·이미지·영상 편집
- 기존 `/admin/payments`는 검색 매개변수·해시를 유지해 `/admin`으로 이동
- `/pay/:token`: 결제 항목·금액·과세 구분·계약/환불조건·이름/연락처·동의·카드 결제
- `/pay/:token/result`: 서버에 저장된 결과 조회. 브라우저가 보내는 성공 여부를 신뢰하지 않습니다.
- `/api/payments/*`: 서버 전용 해시 생성, 승인, 모바일 form POST 반환, 서버 통지

결제 항목과 최종 원화 금액, 과세/면세, 유효기간, 계약·환불조건은 발급 후 수정할 수 없습니다.
변경이 필요하면 관리자에서 미결제 링크를 종료한 뒤 별도 링크를 발급합니다.
이미 승인 처리 중이거나 결제된 링크는 종료할 수 없으며 이 기능은 PG 취소가 아닙니다.
관리자가 선택한 과세/면세가 실제 MID 계약 조건과 일치하는지 확인해야 합니다.
링크 생성 시 주문자 이름·연락처는 선택 입력입니다. 입력하면 유효한 미결제 링크에서
고객이 확인·수정할 수 있도록 미리 표시하며 동의 제출 후 및 만료·완료 상태에서는 API에 노출하지 않습니다.
관리자는 사전에 수집·제공이 가능한 정보만 입력하고 링크는 해당 고객에게만 전달해야 합니다.
주문자가 결제 화면에서 확인한 최종 이름·연락처가 결제 요청과 관리자 내역에 반영됩니다.
고객 링크는 비밀 토큰이므로 담당 고객 외에는 공유하지 마세요.
확인 중인 주문에 새 링크를 발급하여 재결제시키지 말고 PaySM 거래부터 확인하세요.

결제금액 입력은 천 단위 쉼표를 표시하지만 서버에는 정수 원화 금액만 전송합니다.
내역은 항목·금액·주문자·상태·발급일의 요약 목록이며 펼치면 링크·거래번호·연락처·조건을 확인합니다.
검색 대상은 결제 항목·주문번호·주문자 이름·연락처이며, 만료 상태도 실제 유효기간을 기준으로 필터링합니다.

계약·환불조건은 선택 사항입니다. 비워 두면 고객 화면에서 해당 항목과 계약조건 동의 문구를 숨기며
개인정보 수집·이용 동의는 계속 필수입니다. 별도 계약과 필요한 환불 안내를 대체하는 의미는 아닙니다.
자주 쓰는 조건은 관리자에서 **현재 문구를 기본으로 저장**해 서버 DB에 보관할 수 있습니다.
새 발급 폼에 자동 입력되지만 개별 링크에서는 수정·삭제할 수 있으며, 기존 링크의 조건은 바뀌지 않습니다.
빈 문구를 기본으로 저장하면 기본 문구를 지울 수 있습니다. 기본 문구 저장은 관리자 인증·Origin·CSRF 검사를 거칩니다.

### 공개 정책 안내

- `/privacy`: [개인정보처리방침](src/components/PolicyPage.tsx). 처리 항목·목적·이름/연락처 보관기간, PG 정보 전달, 외부 서비스, 쿠키, 권리 행사 및 문의 창구를 안내합니다.
- `/refund`: 같은 파일의 취소·환불 안내. 개별 계약·결제 전 안내와 관계 법령을 기준으로 하며 임의의 환불 비율·기간은 정하지 않습니다.
- 홈페이지와 결제·결제 결과 화면의 [공통 사업자 정보](src/components/BusinessInfo.tsx)에 두 링크를 표시합니다.
  정책은 로그인 없이 직접 열 수 있으며, 링크는 새 창으로 열어 결제 화면의 입력을 유지합니다.
- 결제 화면의 개인정보 수집·이용 문구는 공개 정책과 같은 컴포넌트를 사용합니다.
  기존 필수 동의, 주문별 계약·환불조건 및 결제 처리 동작은 변경하지 않습니다.
- 개인정보 보호 문의·고충처리는 사용자 확인에 따라 씨툴(CEETOOL), `john@ceetool.com`, `010-2195-6202`로 안내합니다.
  실제 처리 업무·외부 서비스 계약·판매 조건이 바뀌면 정책과 시행일을 함께 수정해야 합니다.
  공개 페이지 추가만으로 PG 심사 승인이나 법적 요건 충족이 보장되지는 않으므로 실제 운영·계약에 맞춘 최종 검토가 필요합니다.

### 서버 전용 환경변수

로컬에서는 [서버 설정 예시](server/.env.example)를 `server/.env`로 복사합니다.
실제 값은 Git에 커밋하거나 `VITE_` 변수, GitHub 빌드 결과, 브라우저에 넣지 않습니다.

```dotenv
PAYSM_MID=발급받은_실가맹점_MID
PAYSM_MERCHANT_KEY=발급받은_Merchant_Key
DB_HOST=localhost
DB_USER=ceetool_user
DB_PASS=
DB_NAME=ceetool_payments
GOOGLE_CLIENT_ID=Google_OAuth_웹_Client_ID
GOOGLE_CLIENT_SECRET=Google_OAuth_Client_Secret
ADMIN_GOOGLE_EMAILS=john@ceetool.com
```

`DB_PASS`에는 직접 실제 비밀번호를 입력합니다. 커밋되는 설정 예시는 빈 값이며
로컬 `server/.env`는 Git에서 제외됩니다. 기본 MySQL 포트는 3306이고 필요할 때만 `DB_PORT`를 추가합니다.
`DB_PASS`가 없거나 DB 연결·스키마 검증이 실패하면 서버는 시작하지 않습니다.
테이블을 자동 생성하지 않으며 MySQL만 사용합니다.

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
운영 데이터 저장은 `mysql2` 연결 풀과 InnoDB 트랜잭션을 사용합니다.

```sh
npm --prefix server run check
npm --prefix server test
npm run lint
npm run build
```

테스트는 가짜 PaySM·Google·SES 응답과 실제 MySQL 8의 격리된 임시 DB를 사용하며
실제 승인·과금·메일 발송을 하지 않습니다. 로컬에서는 별도 테스트 MySQL 인스턴스의
`MYSQL_TEST_HOST`, `MYSQL_TEST_PORT`, `MYSQL_TEST_USER`, `MYSQL_TEST_PASSWORD`를 설정합니다.
테스트 계정은 임시 `ceetool_test_*` DB 생성·삭제 권한이 필요합니다.
운영 계정/DB를 테스트에 사용하지 마세요. GitHub Actions는 별도의 MySQL 8 서비스 컨테이너를 사용합니다.
금액 변조·중복/동시 승인·응답 유실·위조 통지·모바일 반환·세션/CSRF·허용 계정·재연결·개인정보 보관을 검사합니다.

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

배포 시 기존 `확인 중` 거래를 `/receipt.do` GET으로 최대 5건 조회합니다.
기존 `0000` 통지 또는 승인 응답 유실 건만 대상으로 하며 승인·취소 요청은 보내지 않습니다.
조회 성공, 거래번호·금액·주문번호(제공 시) 일치 및 `TRX_ST_CD=0`을 확인해야 복구합니다.
조회 중 새 통지가 도착하면 해당 결과로 덮어쓰지 않습니다. 기존 결제일은 유지하며 없으면 복구 시각을 기록합니다.
취소·불일치·조회 실패는 명시적으로 기록하고 `확인 중`을 유지합니다.
결과는 배포 로그의 `payment_reconciliation` 건수로 확인합니다.
추가 확인은 호출 제한(MID당 분당 5회)을 고려해 최소 1분 후 서버에서 실행합니다.

```sh
/home/ubuntu/ceetool-payments/current/runtime/node \
  --env-file=/home/ubuntu/ceetool-payments/.env \
  /home/ubuntu/ceetool-payments/current/server/src/reconcile.mjs
```

### 관리자 메일 알림 (AWS SES)

서울 리전(`ap-northeast-2`)의 SES로 `john@ceetool.com`에서 같은 주소로 알립니다.
고객 영수증 메일과 팝빌 세금계산서 자동 발행은 아직 구현하지 않았습니다.

- 고객이 실제 결제 페이지를 열면 접속 알림을 등록합니다. 단순 GET, 결과 화면의 조회·폴링,
  관리자 조회는 접속 메일을 생성하지 않습니다. 자바스크립트 실행 없는 링크 미리보기도 제외됩니다.
- 같은 링크·브라우저는 **30분마다 최대 1회**입니다. 무작위 HttpOnly 쿠키는 최대 30일,
  DB에는 해시만 보관합니다. 쿠키 삭제·시크릿 모드·다른 브라우저는 별도로 인식하며,
  자바스크립트를 실행하는 봇이나 유효한 링크를 아는 제3자를 사람과 구별하는 기능은 아닙니다.
- 검증된 승인·서버 통지·영수증 복구는 결제 완료 알림을, 응답 유실·재시작 등은 확인 필요 알림을 생성합니다.
  취소 통지는 별도로 알리며 환불 완료로 단정하지 않습니다. 최초 설치 전 과거 거래는 소급 발송하지 않습니다.
- PC 결제창 실패·명시적 닫기 및 모바일 실패 반환은 **인증 실패·미완료**로 알립니다.
  브라우저 신고는 승인 여부의 근거로 사용하지 않습니다. 탭 강제 종료·통신 단절은 감지하지 못할 수 있습니다.
- 결제 상태 변경과 메일 등록은 같은 MySQL InnoDB 트랜잭션과 트리거에서 처리합니다. SDK 호출은 별도 작업자가 수행하며,
  SES 지연·오류로 결제 응답을 기다리게 하지 않습니다. 대기열은 재시작에도 유지됩니다.
- 5초마다 최대 10건을 처리하고, 오류는 1분부터 지수 간격으로 최대 8회 시도합니다.
  중단된 발송은 1분 임대 만료 후 다시 처리합니다. 실패 소진 건은 버리지 않으며 관리자가 재시도할 수 있습니다.
  중복 승인·중복 통지는 같은 발송 건으로 통합합니다.
  발송 건 선점은 `FOR UPDATE SKIP LOCKED`로 처리하며 네트워크 발송 중에는 DB 잠금을 유지하지 않습니다.
- SES 수락 직후 서버가 중단되거나 응답을 잃으면 재시도 메일이 중복 도착할 수 있습니다.
  **발송 접수는 SES 수락이며 받은편지함 도착 보장이 아닙니다.** 반송·스팸 여부는 SES 지표와 수신함에서 확인합니다.
- 메일에는 주문번호·제목·금액·발생 시각·관리자 주소만 포함합니다.
  이름·연락처·카드정보·인증 원문·결제 링크 토큰은 포함하지 않습니다.
  발송된 본문 스냅샷은 30일 후 제거하고 중복 방지 키·발송 결과는 유지합니다.
  발송 대기·오류 건은 처리할 때까지 보관하며, 만료된 접속 해시는 30일 후 정리합니다.

**AWS에서 필요한 설정**

1. SES **서울**에서 `ceetool.com` 도메인 또는 `john@ceetool.com` 발신 자격을 검증합니다.
   도메인 인증은 안내된 DKIM DNS 레코드를 등록합니다. Cloudflare의 해당 DNS 레코드는 프록시하지 않습니다.
2. 결제 서버 EC2에 IAM 역할을 연결하고 아래와 같은 최소 발송 정책을 부여합니다.
   계정 ID와 인증 방식에 맞게 `Resource`를 설정합니다.
   SDK 기본 자격 증명 체인을 사용하므로 EC2 역할을 권장하며 AWS 키를 코드·프런트엔드에 넣지 않습니다.

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": "ses:SendEmail",
         "Resource": [
           "arn:aws:ses:ap-northeast-2:YOUR_ACCOUNT_ID:identity/ceetool.com",
           "arn:aws:ses:ap-northeast-2:YOUR_ACCOUNT_ID:identity/john@ceetool.com",
           "arn:aws:ses:ap-northeast-2:YOUR_ACCOUNT_ID:configuration-set/my-first-configuration-set"
         ],
         "Condition": {
           "StringEquals": { "ses:FromAddress": "john@ceetool.com" },
           "ForAllValues:StringEquals": {
             "ses:Recipients": ["john@ceetool.com"]
           }
         }
       }
     ]
   }
   ```

   `YOUR_ACCOUNT_ID`를 실제 AWS 계정 ID로 바꾸고 사용하는 발신 자격의 ARN을 포함합니다.
   운영 발송에는 `my-first-configuration-set` 구성 세트가 적용됩니다. 발신 자격뿐 아니라
   해당 구성 세트에도 `ses:SendEmail`을 허용해야 하며, 누락하면 `AccessDeniedException`이 발생합니다.
   다른 환경에서는 실제 적용되는 구성 세트 이름에 맞추고, 구성 세트를 사용하지 않으면 해당 ARN은 제외합니다.
   역할에서 IMDSv2 자격 증명을 읽을 수 있어야 합니다.

3. SES 샌드박스에서는 수신 주소도 검증되어야 합니다. 현재는 검증된 동일 주소 간 발송이므로
   샌드박스에서도 사용할 수 있지만, 향후 고객 메일은 운영 액세스 신청과 수신 동의·반송 처리가 필요합니다.
4. 배포 후 최초 1회만 연결 확인 메일을 대기열에 등록합니다. 관리자 화면의
   **관리자 메일 알림**에서 발송 접수·대기·오류, 테스트 메일, 오류 메일 재시도를 확인합니다.
   AWS 설정을 수정한 뒤 **오류 메일 재시도**를 누르면 미발송 오류 건을 바로 다시 시도합니다.
   테스트·재시도는 로그인·Origin·CSRF 검증과 시간당 요청 제한을 적용합니다.

배포 로그의 `payment_email_status`로 연결 확인 결과를 확인합니다.
`CredentialsProviderError`는 역할/자격 증명, `AccessDeniedException`은 IAM 권한,
`MessageRejected`는 발신인 검증·샌드박스·발송 상태 등을 우선 점검합니다.
키와 SES 원문 오류 메시지는 기록하지 않습니다. 별도 `NODE_ENV`나 AWS 리전 환경변수를 추가할 필요는 없습니다.
수동 상태 확인은 서버에서 다음 읽기 명령을 사용합니다.

```sh
/home/ubuntu/ceetool-payments/current/runtime/node \
  --env-file=/home/ubuntu/ceetool-payments/.env \
  /home/ubuntu/ceetool-payments/current/server/src/email.mjs --status
```

### 운영 설정·저장

#### MySQL 설정

1. MySQL **8.0.16 이상**에서 관리자가 저장소 루트의 [tables.sql](tables.sql)을 직접 실행합니다.
   이 파일은 `ceetool_payments` DB, 8개 테이블, 결제 상태 알림 트리거를 생성합니다.
   비밀번호나 사용자 생성 쿼리는 포함하지 않습니다.

   ```sh
   sudo mysql < tables.sql
   ```

   root 비밀번호 인증 방식이면 대신 `mysql -u root -p < tables.sql`을 사용합니다.
   `ceetool_user`가 이미 생성되어 있는지 확인하고 해당 계정에 다음 권한을 부여합니다.
   `TRIGGER`는 결제 상태 알림 트리거의 존재를 점검하기 위해 필요합니다.

   ```sql
   GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER
     ON ceetool_payments.* TO 'ceetool_user'@'localhost';
   ```

   테이블 생성 SQL을 다시 실행할 때도 신규 결제를 차단하세요. 테이블은 삭제하지 않지만 트리거를 재생성합니다.

2. **운영 서버** `/home/ubuntu/ceetool-payments/.env`에 아래 항목을 추가하고 비밀번호를 직접 입력합니다.
   기존 결제·Google OAuth 설정은 그대로 보존합니다. 로컬 파일을 운영 `.env` 위에 덮어쓰지 마세요.

   ```dotenv
   DB_HOST=localhost
   DB_USER=ceetool_user
   DB_PASS=
   DB_NAME=ceetool_payments
   ```

   비밀번호에 `#`, 공백 등이 있다면 Node 환경변수 파일 문법에 맞게 따옴표로 감싸세요.
   비밀번호를 채팅·Git·명령행 인자로 전달하지 않습니다.

3. 준비가 완료된 후 `main`에 push해 배포합니다. 배포는 **현재 서비스 정지 전에**
   MySQL 연결·스키마를 확인합니다. 미설정 상태에서는 기존 서비스를 건드리지 않고 중단합니다.
   기존 MySQL 데이터는 다시 복사하거나 초기화하지 않습니다.

운영 데이터의 MySQL 전환은 완료되었습니다. SQLite 모듈·이전 도구는 사용하지 않습니다.
서비스 전환 중에는 결제 API가 잠시 응답하지 않을 수 있습니다.

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
- 영구 DB: MySQL `ceetool_payments` (결제 서비스는 MySQL 데이터 파일을 직접 관리하지 않음)

DB·설정은 웹 공개 폴더 및 코드 릴리스와 분리하며 다음 배포에 덮어쓰지 않습니다.
운영 프로세스의 umask는 0077입니다. 이름·연락처는 미결제 만료 후 30일, 완료 거래는 결제 후 5년 기준으로 정리합니다.
**DB 자동 백업은 사용하지 않습니다.** Git은 코드만 보관하므로 운영 MySQL 데이터의 복구 수단은 아닙니다.
기존 DB 백업 timer/service, SQLite 원본·보조 파일과 과거 DB 백업은 운영에서 제거했습니다.
일회성 파일 정리 코드도 제거했으며, 현재 배포는 MySQL 사전 점검과 코드 전환만 수행합니다.
메일 발송 대기열과 개인정보 보관기간 정리는 백업이 아닌 운영 기능으로 그대로 유지합니다.

## 콘텐츠 수정

메인 화면은 기존 색상과 배경을 유지하며, 왼쪽에 개발 분야·한 줄 설명, 오른쪽에 사진·영상 캐러셀을 배치합니다.
큰 화면(1024px 이상)에서는 6개 분야를 2열 × 3행으로, 작은 화면에서는 1열로 배치합니다.
좌우 배치에서는 카드 왼쪽의 아이콘·제목과 오른쪽 사진·영상의 상단을 맞추고, 기능은 접지 않고 바로 표시합니다.
아이콘과 제목은 나란히 배치하며, 긴 제목·기능·설명은 어절 단위로 줄바꿈합니다. 한 어절이 영역보다 길면 글자 단위로 줄바꿈해 넘침을 방지합니다.
이미지 아래에는 현재 슬라이드에 연결된 프로젝트 링크·간략한 설명만 표시하며, 이미지 전환과 함께 교체합니다.
긴 캡션도 가로 스크롤이나 잘림 없이 여러 줄로 표시합니다.
카테고리 순번과 캐러셀의 숫자 카운터, “대표 사례” 제목은 표시하지 않으며 아이콘과 이전·다음 버튼은 유지합니다.
모바일에서는 설명 아래에 캐러셀을 표시합니다.
`/admin`의 **홈페이지 관리**에서 카테고리를 추가·삭제·정렬·숨김 처리하고, 제목·소개·기능·아이콘·강조 테두리를 수정합니다.
**프로젝트·미디어**에서 프로젝트명·사이트 링크·설명·상세 본문·추가 수행 이력 노출 여부와 사진·영상을 관리합니다.
각 카테고리의 슬라이드 2개에는 등록한 프로젝트와 해당 프로젝트의 미디어를 연결합니다. 같은 프로젝트를 사용하는 화면에는 수정 내용이 함께 반영됩니다.
**기존 상세 페이지**에서는 6개 기존 주소를 유지하면서 제목·소개·본문·표시할 프로젝트를 수정합니다.
**파일 업로드 후 ‘홈페이지 저장’을 눌러야 공개됩니다.** 콘텐츠는 아래 전용 MySQL 테이블에 저장되어 재배포에도 유지됩니다.
기본 6개 분야와 기존 이력·미디어도 SQL 초기 데이터로 저장합니다. 프런트엔드 하드코딩으로 대체하지 않으며 API 오류는 재시도 안내를 표시합니다.
동시 편집은 버전 충돌로 차단하며, 다른 창에서 변경한 경우 새로 불러온 뒤 편집합니다. 저장 전 변경을 버리고 페이지를 나갈 때 확인합니다.
카테고리는 최대 24개, 기능은 1~6줄, 프로젝트는 최대 200개, 프로젝트당 미디어는 최대 30개입니다.
전체 저장 요청의 콘텐츠는 UTF-8 58,000바이트 이하로 제한해 기존 64KB JSON API 제한을 유지합니다.
상단 소개는 백엔드·프론트엔드 팀 소개와 쇼핑몰·거래소·은행 API 연동 및 웹·Android·iOS 앱 개발 범위를 두 문장으로 나누고, “15년 경력”만 기존 파란색으로 강조합니다.
CEETOOL(씨툴) 제목과 기존 로고는 같은 흰색을 사용하며, 로고 크기는 제목 글자 크기에 맞춥니다.
“개발 분야” 소제목·메뉴는 표시하지 않습니다.
사진은 `{ type: "image", src, alt }`, 영상은 `{ type: "video", src, alt, poster? }` 형식입니다.
현재는 기존 사진을 다른 분야에 끼워 넣지 않고, 미디어 미등록 항목을 명시적인 “이미지 준비 중” 화면으로 표시합니다.
캐러셀은 버튼·스와이프·포커스 후 좌우 방향키로 조작하며, 자동 전환과 영상 자동 재생은 사용하지 않습니다.
영상은 `preload="none"`으로 초기 로딩을 줄이고, 화면 전환이나 상세 보기 열기 시 재생을 멈춥니다.
수행 이력의 프로젝트를 선택하면 상세 보기가 열리며, 기존 `/docs/:docType` 경로와 결제·관리자 화면은 유지합니다.

- [메인 화면](src/app/app.tsx): 소개 문구, 카카오톡 문의, 사업자 정보
- [서비스 표현 타입](src/app/services.ts): 카드 표현에 사용하는 타입
- [홈페이지 관리](src/components/HomepageAdmin.tsx), [홈페이지 API](src/app/homepage-api.ts), [서버 콘텐츠·업로드](server/src/homepage.mjs): 관리자 편집과 공개 설정
- [분야별 미디어](src/components/ServiceShowcase.tsx): 좌우 레이아웃, 분야별 2개 화면 캐러셀 및 미디어 준비 상태
- [콘텐츠 저장소](server/src/homepage-store.mjs): 카테고리·프로젝트·갤러리·상세 페이지의 트랜잭션 읽기·저장
- [서비스 카드](src/components/organisms/card/card.tsx): 카드 레이아웃
- [프로젝트 미리보기](src/components/ProjectDialog.tsx): PC 모달 및 모바일 전체 화면
- [기존 상세 화면](src/components/ProjectPage.tsx): 6개 `/docs/:docType` 직접 접속 경로 유지
- [프로젝트 갤러리](src/components/organisms/project-details/project-details.tsx): 사진·영상 표시
- [전역 스타일](src/index.css), [Tailwind 설정](tailwind.config.js): 배경과 공통 스타일
- [정적 파일](public): `logos`의 로고, 프로젝트 미디어의 기존 원본, 파비콘, 웹 매니페스트

텔레그램 연락처는 표시하지 않습니다. 프로젝트 수행 이력의 텔레그램 알림 기능 설명은 유지합니다.

메인은 쇼핑몰 구축·커스터마이징을 강조하며 결제 시스템, AI·챗봇, 마케팅·SNS,
업무 자동화·맞춤 시스템, 금융·공공 시스템의 6개 분야로 구성합니다.
각 분야는 제공 기능 3개와 현재 슬라이드의 수행 사례를 표시하고, 나머지 사례는 하단의 추가 수행 이력에 보존합니다.
AI·마케팅 및 은행 연동 등은 확인된 수행 분야만 표시하며 구체적인 고객사·성과 수치는 만들지 않습니다.
기존 상세 페이지에 연결된 24개 수행 이력과 메인 화면에 추가한 사례를 합친 28개 프로젝트를 DB에 보존합니다.
기존 상세 페이지도 DB를 사용하며 6개 주소와 수행 이력을 그대로 유지합니다.
공개 페이지에는 관리자 링크를 표시하지 않습니다. 주소창에 `/admin`을 직접 입력해 **결제 관리**와 **홈페이지 관리** 메뉴에 접근합니다.
관리자 인증·허용 계정 검사는 기존과 동일합니다.

### 홈페이지 콘텐츠 테이블·수동 마이그레이션

- **새 DB 전체 설치:** [tables.sql](tables.sql)
- **기존 운영 DB 업데이트:** [20261027_001_relational_homepage.sql](migrations/20261027_001_relational_homepage.sql)만 실행합니다.
  이후 스키마를 변경할 때도 전체 설치 SQL과 별도의 증분 SQL을 함께 유지합니다.

| 테이블 | 용도 |
|---|---|
| `homepage_categories` | 카테고리명·소개·아이콘·노출·정렬 |
| `homepage_features` | 카테고리별 기능 목록 |
| `homepage_projects` | 프로젝트명·설명·본문·외부 링크·추가 이력 여부 |
| `homepage_media` | 프로젝트별 사진·영상·썸네일 주소와 순서 |
| `homepage_slides` | 카테고리의 두 슬라이드와 프로젝트·미디어 연결 |
| `homepage_documents` | 기존 상세 페이지의 주소·제목·소개·본문 |
| `homepage_document_projects` | 상세 페이지별 프로젝트 연결과 순서 |

1. 마이그레이션 시작부터 새 코드 배포가 끝날 때까지 기존 관리자에서 홈페이지 저장을 중단합니다.
   구버전은 JSON에 저장하므로 마이그레이션 후 구버전에서 저장하면 새 테이블에 반영되지 않습니다.
2. MySQL Workbench에서 운영 `ceetool_payments` DB에 연결하고 DDL 권한이 있는 계정으로 증분 SQL **전체**를 실행합니다.
   **Stop SQL Script Execution On Errors**를 활성화합니다. 오류가 나면 계속 실행하지 말고 `ROLLBACK;` 후 오류를 해결합니다.
   MySQL DDL은 자동 커밋되지만 초기 데이터 이관은 별도 트랜잭션으로 처리합니다.
3. 마지막 결과에서 테이블별 개수와 `homepage_schema = relational-v1`, `homepage_revision`을 확인합니다.
   기존 홈페이지 저장 이력이 없으면 카테고리 6개·기능 18개·프로젝트 28개·미디어 12개·슬라이드 12개·상세 페이지 6개·상세 프로젝트 연결 24개입니다.
   기존 관리자 수정 내용이 있으면 그 카테고리·슬라이드·업로드를 우선 이관하므로 개수가 달라질 수 있습니다.
4. 실행 성공을 확인한 뒤 새 코드를 배포합니다. 서버는 이관 표시가 없으면 시작하지 않습니다.
   SQL은 서버 시작이나 배포 시 자동 실행하지 않습니다.

기존 결제 테이블·결제 데이터·메일 트리거는 변경하지 않습니다.
기존 `settings.homepage_v1` JSON도 삭제하지 않지만 새 코드는 전용 테이블만 사용합니다.
성공한 마이그레이션을 재실행해도 이후 관리자 수정 내용을 초기값으로 덮어쓰지 않습니다.
`settings.homepage_revision`은 동시 편집 방지용 버전이므로 콘텐츠는 관리자 화면에서 수정하는 것을 권장합니다.
실제 파일은 S3에 남고 DB에는 파일 주소·설명·연결 관계만 저장합니다.

## 프로젝트 사진·영상

프로젝트 미리보기와 기존 상세 화면의 사진, 영상, 썸네일은 비공개 S3 버킷 `ceetool-image`를
원본으로 하는 CloudFront 배포에서 제공합니다.

- 미디어 기본 주소: `https://d2fgd6q9oovwa9.cloudfront.net/projects`
- S3 객체 키 예시: `projects/c9pro/c9pro-ex1.mp4` (`images/` 접두사 없음)
- S3 리전: 서울 (`ap-northeast-2`)
- S3 퍼블릭 액세스는 차단하고 CloudFront OAC로 읽기 허용

관리자 업로드는 `projects/homepage/<UUID>.<확장자>`에 새 파일을 저장합니다.
JPG·PNG·WebP·GIF 이미지와 MP4·WebM 영상을 파일당 최대 **100MiB(104,857,600바이트)**까지 허용합니다.
서버에서 로그인·Origin·CSRF·파일 크기·MIME·파일 시그니처를 검사하고, 제한된 임시 파일을 S3로 스트리밍한 뒤 삭제합니다.
업로드는 분당 6회이며 영상 썸네일은 이미지 파일로 별도 업로드합니다. SVG·HTML은 허용하지 않습니다.
Nginx의 대용량 요청 허용은 관리자 미디어 업로드 주소에만 적용하고, 결제·콘텐츠 JSON API의 64KB 제한은 유지합니다.
교체·연결 해제·카테고리 삭제 시 S3 원본은 삭제하지 않습니다. 업로드 후 저장하지 않은 파일도 남으므로 불필요한 원본은 S3 콘솔에서 별도 정리합니다.
EC2 역할 `ceetool-payments-ec2-role`에는 기존 SES 권한을 유지하며 다음 별도 정책을 추가합니다(정적 AWS 키는 사용하지 않음).

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "UploadHomepageMedia",
    "Effect": "Allow",
    "Action": "s3:PutObject",
    "Resource": "arn:aws:s3:::ceetool-image/projects/homepage/*"
  }]
}
```

기존 프로젝트 상세 화면의 미디어도 관리자 **프로젝트·미디어**에서 관리합니다.
CloudFront 도메인을 변경할 때는 DB에 저장된 미디어 주소와 프런트엔드·서버의 업로드 도메인 검증도 함께 변경해야 합니다.
로고와 공유 이미지는 계속 홈페이지 서버에서 제공합니다.
기존 로컬 미디어 파일은 보존하지만 화면에서 자동 대체 파일로 사용하지 않습니다.
동일한 객체 키를 덮어쓰면 캐시가 남을 수 있으므로 새 파일명을 사용하거나
CloudFront에서 해당 경로를 무효화합니다.

홈페이지의 프로젝트 이름을 누르면 페이지 이동 없이 상세 보기가 열립니다.
미디어가 등록된 프로젝트에는 미리보기를 제공하고, 외부 사이트 주소가 있으면 사이트 링크를 표시합니다.
다른 프로젝트는 수행 범위를 유지하고, 분야별 "프로젝트 자세히 보기" 버튼은 표시하지 않습니다.
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
5. 정적 파일 접근 권한 설정, MySQL 사전 점검, 결제 서비스 릴리스 전환·재시작
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
