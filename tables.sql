CREATE DATABASE IF NOT EXISTS `ceetool_payments`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;
USE `ceetool_payments`;

CREATE TABLE IF NOT EXISTS invoices (
  token VARCHAR(43) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  order_no VARCHAR(128) NOT NULL UNIQUE,
  title TEXT NOT NULL,
  amount BIGINT UNSIGNED NOT NULL CHECK (amount BETWEEN 1 AND 9007199254740991),
  tax_type VARCHAR(16) NOT NULL CHECK (tax_type IN ('taxable','exempt')),
  terms TEXT NOT NULL,
  expires_at BIGINT UNSIGNED NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  state VARCHAR(16) NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending','processing','paid','review')),
  tid VARCHAR(128) UNIQUE,
  paid_at BIGINT UNSIGNED,
  buyer_name VARCHAR(50),
  buyer_phone VARCHAR(24),
  consent_at BIGINT UNSIGNED,
  note TEXT NOT NULL DEFAULT (''),
  noti_code VARCHAR(16),
  noti_date VARCHAR(14),
  INDEX invoices_created (created_at DESC, token DESC)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS attempts (
  token VARCHAR(43) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  invoice_token VARCHAR(43) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  mid VARCHAR(10) NOT NULL,
  edi_date VARCHAR(14) NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  state VARCHAR(16) NOT NULL DEFAULT 'prepared'
    CHECK (state IN ('prepared','processing','closed','paid','review')),
  FOREIGN KEY (invoice_token) REFERENCES invoices(token),
  INDEX attempts_invoice (invoice_token)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS settings (
  setting_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  value TEXT NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  hash VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  email VARCHAR(320) NOT NULL,
  csrf VARCHAR(43) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  expires_at BIGINT UNSIGNED NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS oauth_states (
  hash VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  verifier VARCHAR(43) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  nonce VARCHAR(43) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  expires_at BIGINT UNSIGNED NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  fingerprint VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  invoice_token VARCHAR(43) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  result_code VARCHAR(16) NOT NULL,
  amount VARCHAR(32) NOT NULL,
  received_at BIGINT UNSIGNED NOT NULL,
  FOREIGN KEY (invoice_token) REFERENCES invoices(token)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS email_outbox (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_key VARCHAR(512) NOT NULL UNIQUE,
  kind VARCHAR(32) NOT NULL,
  payload LONGTEXT NOT NULL CHECK (JSON_VALID(payload)),
  created_at BIGINT UNSIGNED NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sending','sent','failed')),
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  next_at BIGINT UNSIGNED NOT NULL,
  lease_until BIGINT UNSIGNED,
  message_id VARCHAR(256),
  sent_at BIGINT UNSIGNED,
  last_error VARCHAR(80),
  INDEX email_outbox_pending (status, next_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payment_visits (
  invoice_token VARCHAR(43) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  visitor_hash VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  notified_at BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (invoice_token, visitor_hash),
  FOREIGN KEY (invoice_token) REFERENCES invoices(token)
) ENGINE=InnoDB;

DROP TRIGGER IF EXISTS payment_status_email;
DELIMITER $$
CREATE TRIGGER payment_status_email AFTER UPDATE ON invoices
FOR EACH ROW
BEGIN
  DECLARE email_kind VARCHAR(32);
  DECLARE event_time BIGINT UNSIGNED;
  IF NEW.state IN ('paid','review') AND
    (OLD.state <> NEW.state OR
      (NEW.state = 'review' AND NOT (OLD.noti_code <=> NEW.noti_code))) THEN
    SET email_kind = CASE WHEN NEW.state = 'paid' THEN 'paid'
      WHEN NEW.noti_code = '2001' THEN 'cancelled' ELSE 'review' END;
    SET event_time = CAST(UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000 AS UNSIGNED);
    INSERT INTO email_outbox (event_key, kind, payload, created_at, next_at)
    VALUES (CONCAT(email_kind, ':', NEW.token, ':', COALESCE(NEW.tid, '')),
      email_kind, JSON_OBJECT('orderNo', NEW.order_no, 'title', NEW.title, 'amount', NEW.amount),
      event_time, event_time)
    ON DUPLICATE KEY UPDATE event_key = event_key;
  END IF;
END$$
DELIMITER ;

INSERT INTO settings (setting_key, value) VALUES ('schema_version', 'mysql-v1')
ON DUPLICATE KEY UPDATE value = value;

-- Homepage schema and initial content (fresh installations).
CREATE TABLE IF NOT EXISTS homepage_categories (
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  title VARCHAR(40) NOT NULL,
  tagline VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  icon VARCHAR(16) NOT NULL CHECK (icon IN ('shopping','payment','ai','marketing','automation','finance')),
  visible BOOLEAN NOT NULL CHECK (visible IN (0,1)),
  featured BOOLEAN NOT NULL CHECK (featured IN (0,1)),
  sort_order INT UNSIGNED NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS homepage_features (
  category_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  position TINYINT UNSIGNED NOT NULL CHECK (position BETWEEN 1 AND 6),
  text VARCHAR(150) NOT NULL,
  PRIMARY KEY (category_id, position),
  FOREIGN KEY (category_id) REFERENCES homepage_categories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS homepage_projects (
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(250) NOT NULL,
  details TEXT NOT NULL,
  url VARCHAR(2048),
  archived BOOLEAN NOT NULL CHECK (archived IN (0,1)),
  sort_order INT UNSIGNED NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS homepage_media (
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  project_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  position INT UNSIGNED NOT NULL,
  type VARCHAR(8) NOT NULL CHECK (type IN ('image','video')),
  src VARCHAR(2048) NOT NULL,
  alt VARCHAR(300) NOT NULL,
  poster VARCHAR(2048),
  UNIQUE KEY homepage_media_project (id, project_id),
  UNIQUE KEY homepage_media_position (project_id, position),
  FOREIGN KEY (project_id) REFERENCES homepage_projects(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS homepage_slides (
  category_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  position TINYINT UNSIGNED NOT NULL CHECK (position IN (1,2)),
  label VARCHAR(150) NOT NULL,
  project_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  media_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin,
  PRIMARY KEY (category_id, position),
  FOREIGN KEY (category_id) REFERENCES homepage_categories(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES homepage_projects(id),
  FOREIGN KEY (media_id, project_id) REFERENCES homepage_media(id, project_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS homepage_documents (
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  details TEXT NOT NULL,
  sort_order INT UNSIGNED NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS homepage_document_projects (
  document_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  project_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  position INT UNSIGNED NOT NULL,
  PRIMARY KEY (document_id, position),
  UNIQUE KEY homepage_document_project (document_id, project_id),
  FOREIGN KEY (document_id) REFERENCES homepage_documents(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES homepage_projects(id)
) ENGINE=InnoDB;


-- BEGIN HOMEPAGE SEED AND LEGACY IMPORT
START TRANSACTION;
SET @homepage_apply = NOT EXISTS (
  SELECT 1 FROM settings WHERE setting_key = 'homepage_schema' AND value = 'relational-v1'
);
SET @homepage_seed = CAST('{
  "categories": [
    {
      "id": "shopping",
      "icon": "shopping",
      "title": "쇼핑몰·웹사이트",
      "tagline": "브랜드와 서비스에 맞는 웹사이트",
      "description": "자사몰 제작부터 카페24·WooCommerce 기능 추가, 주문·재고·배송 연동까지.",
      "visible": true,
      "featured": true,
      "features": [
        "자사몰 맞춤 개발",
        "카페24·WooCommerce 커스터마이징",
        "상품·주문·배송 시스템 연동"
      ],
      "slides": [
        {
          "label": "메인 화면",
          "project": {
            "name": "DSWAR Market",
            "description": "쇼핑몰·어드민 페이지 제작",
            "portfolioId": "dswar",
            "url": "https://dswstore.io/"
          }
        },
        {
          "label": "상품·서비스 상세 화면",
          "project": {
            "name": "DSWAR Market",
            "description": "쇼핑몰·어드민 페이지 제작",
            "portfolioId": "dswar",
            "url": "https://dswstore.io/"
          }
        }
      ]
    },
    {
      "id": "payment",
      "icon": "payment",
      "title": "결제 시스템",
      "tagline": "결제부터 취소·정산까지",
      "description": "새로운 결제 수단을 연결하고 승인·취소·환불 흐름을 구현합니다.",
      "visible": true,
      "featured": false,
      "features": [
        "국내 카드·해외 결제",
        "결제 링크·정기결제",
        "취소·부분취소·결제 오류 개선"
      ],
      "slides": [
        {
          "label": "고객 결제 화면",
          "project": {
            "name": "C9Pro",
            "description": "카드·USDT·PayPal·멤버십 연동",
            "portfolioId": "c9pro",
            "url": "https://c9-pro.com/"
          }
        },
        {
          "label": "결제 내역·관리 화면",
          "project": {
            "name": "ForYouPay",
            "description": "우커머스 통합결제 플러그인"
          }
        }
      ]
    },
    {
      "id": "ai",
      "icon": "ai",
      "title": "AI·챗봇",
      "tagline": "서비스에 필요한 AI 기능",
      "description": "기존 서비스에 AI를 연결해 상담과 문서 처리에 필요한 기능을 만듭니다.",
      "visible": true,
      "featured": false,
      "features": [
        "상품·서비스 상담 챗봇",
        "내부 문서 검색·답변",
        "문서 요약·분류 자동화"
      ],
      "slides": [
        {
          "label": "챗봇 대화 화면",
          "project": {
            "name": "AI 챗봇 연동",
            "description": "AI를 활용한 챗봇 연동 개발"
          }
        },
        {
          "label": "AI 처리 결과 화면",
          "project": {
            "name": "AI 챗봇 연동",
            "description": "AI를 활용한 챗봇 연동 개발"
          }
        }
      ]
    },
    {
      "id": "marketing",
      "icon": "marketing",
      "title": "마케팅·SNS",
      "tagline": "채널과 데이터를 연결하는 기능",
      "description": "메타·인스타그램과 서비스를 연결해 채널 운영과 성과 확인을 돕습니다.",
      "visible": true,
      "featured": false,
      "features": [
        "광고 전환 측정 연동",
        "SNS 콘텐츠·고객 문의 연동",
        "마케팅 데이터·보고서"
      ],
      "slides": [
        {
          "label": "SNS 연동·운영 화면",
          "project": {
            "name": "메타·인스타그램 마케팅",
            "description": "SNS 마케팅 관련 기능 개발"
          }
        },
        {
          "label": "성과·통계 화면",
          "project": {
            "name": "메타·인스타그램 마케팅",
            "description": "SNS 마케팅 관련 기능 개발"
          }
        }
      ]
    },
    {
      "id": "automation",
      "icon": "automation",
      "title": "업무 자동화·관리 시스템",
      "tagline": "반복 업무를 줄이는 맞춤 도구",
      "description": "예약·정산부터 반복 작업까지, 실제 업무 방식에 맞는 화면과 도구를 만듭니다.",
      "visible": true,
      "featured": false,
      "features": [
        "예약·견적·발주·정산 관리",
        "엑셀·PDF·상품 일괄 처리",
        "관리자 화면·알림·운영 도구"
      ],
      "slides": [
        {
          "label": "업무 관리 화면",
          "project": {
            "name": "신이 홈페이지",
            "description": "결제 및 예약 관리시스템 개발",
            "portfolioId": "shini",
            "url": "https://xn--zv4bu7f.com/"
          }
        },
        {
          "label": "자동화 실행·결과 화면",
          "project": {
            "name": "플리키",
            "description": "상품 자동업로드·워터마크"
          }
        }
      ]
    },
    {
      "id": "finance",
      "icon": "finance",
      "title": "금융·공공 시스템",
      "tagline": "복잡한 데이터와 시스템 연결",
      "description": "은행·금융 API와 기관 업무 시스템을 연결하고 거래·업무 데이터를 처리합니다.",
      "visible": true,
      "featured": false,
      "features": [
        "은행·금융 API 연동",
        "기관 업무 시스템·데이터 이관",
        "거래 데이터 수집·시스템 통합"
      ],
      "slides": [
        {
          "label": "업무·API 연동 화면",
          "project": {
            "name": "은행 API 연동",
            "description": "은행 연동 관련 업무 개발"
          }
        },
        {
          "label": "거래·데이터 조회 화면",
          "project": {
            "name": "코레일",
            "description": "소켓 통신 페이지 제작"
          }
        }
      ]
    }
  ],
  "projects": [
    {
      "id": "dswar",
      "name": "DSWAR Market",
      "description": "쇼핑몰·어드민 페이지 제작",
      "details": "USDT·럭키박스 토큰으로 게임 아이템을 구매하는 쇼핑몰.",
      "url": "https://dswstore.io/",
      "archive": false,
      "media": [
        {
          "id": "dswar-media-1",
          "type": "image",
          "src": "https://d2fgd6q9oovwa9.cloudfront.net/projects/dswar/dswar-ex.png",
          "alt": "DSWAR Market 전체 화면"
        },
        {
          "id": "dswar-media-2",
          "type": "image",
          "src": "https://d2fgd6q9oovwa9.cloudfront.net/projects/dswar/one-ex.png",
          "alt": "DSWAR Market 아이템 화면 1"
        },
        {
          "id": "dswar-media-3",
          "type": "image",
          "src": "https://d2fgd6q9oovwa9.cloudfront.net/projects/dswar/two-ex.png",
          "alt": "DSWAR Market 아이템 화면 2"
        },
        {
          "id": "dswar-media-4",
          "type": "image",
          "src": "https://d2fgd6q9oovwa9.cloudfront.net/projects/dswar/three-ex.png",
          "alt": "DSWAR Market 아이템 화면 3"
        },
        {
          "id": "dswar-media-5",
          "type": "image",
          "src": "https://d2fgd6q9oovwa9.cloudfront.net/projects/dswar/shini-ex.png",
          "alt": "웹사이트 제작 참고 화면"
        }
      ]
    },
    {
      "id": "shini",
      "name": "신이 홈페이지",
      "description": "결제 및 예약 관리시스템 개발",
      "details": "청소 서비스 예약·결제 및 예약 관리.",
      "url": "https://xn--zv4bu7f.com/",
      "archive": false,
      "media": [
        {
          "id": "shini-media-1",
          "type": "video",
          "src": "https://d2fgd6q9oovwa9.cloudfront.net/projects/shini/shini-ex4.mp4",
          "poster": "https://d2fgd6q9oovwa9.cloudfront.net/projects/shini/shini-ex1.jpg",
          "alt": "신이 홈페이지 시연 영상"
        },
        {
          "id": "shini-media-2",
          "type": "image",
          "src": "https://d2fgd6q9oovwa9.cloudfront.net/projects/shini/shini-ex2.jpg",
          "alt": "신이 홈페이지 소개 화면"
        },
        {
          "id": "shini-media-3",
          "type": "image",
          "src": "https://d2fgd6q9oovwa9.cloudfront.net/projects/shini/shini-ex3.jpg",
          "alt": "신이 홈페이지 상세 화면"
        }
      ]
    },
    {
      "id": "project-1",
      "name": "주다스 글로벌 쇼핑몰",
      "description": "페이버스 결제 취소 API 개발",
      "details": "페이버스 결제 취소 API 개발",
      "archive": true,
      "media": []
    },
    {
      "id": "project-2",
      "name": "스카이젯",
      "description": "비동기화 전환·통합결제 모듈 연동",
      "details": "비동기화 전환·통합결제 모듈 연동",
      "archive": true,
      "media": []
    },
    {
      "id": "project-3",
      "name": "크리에이티브코드",
      "description": "HTS 복구·차트 API 연동",
      "details": "HTS 복구·차트 API 연동",
      "archive": true,
      "media": []
    },
    {
      "id": "project-4",
      "name": "코레일",
      "description": "소켓 통신 페이지 제작",
      "details": "소켓 통신 페이지 제작",
      "archive": false,
      "media": []
    },
    {
      "id": "c9pro",
      "name": "C9Pro",
      "description": "카드·USDT·PayPal·멤버십 연동",
      "details": "카드·USDT·PayPal 결제와 멤버십 연동.",
      "url": "https://c9-pro.com/",
      "archive": false,
      "media": [
        {
          "id": "c9pro-media-1",
          "type": "video",
          "src": "https://d2fgd6q9oovwa9.cloudfront.net/projects/c9pro/c9pro-ex1.mp4",
          "poster": "https://d2fgd6q9oovwa9.cloudfront.net/projects/c9pro/c9pro-ex5.png",
          "alt": "C9Pro 시연 영상"
        },
        {
          "id": "c9pro-media-2",
          "type": "image",
          "src": "https://d2fgd6q9oovwa9.cloudfront.net/projects/c9pro/c9pro-ex2.png",
          "alt": "C9Pro 화면 1"
        },
        {
          "id": "c9pro-media-3",
          "type": "image",
          "src": "https://d2fgd6q9oovwa9.cloudfront.net/projects/c9pro/c9pro-ex3.png",
          "alt": "C9Pro 화면 2"
        },
        {
          "id": "c9pro-media-4",
          "type": "image",
          "src": "https://d2fgd6q9oovwa9.cloudfront.net/projects/c9pro/c9pro-ex4.png",
          "alt": "C9Pro 화면 3"
        }
      ]
    },
    {
      "id": "project-5",
      "name": "ForYouPay",
      "description": "우커머스 통합결제 플러그인",
      "details": "우커머스 통합결제 플러그인",
      "archive": false,
      "media": []
    },
    {
      "id": "project-6",
      "name": "업비트 데모",
      "description": "PC/앱 버전 통합",
      "details": "PC/앱 버전 통합",
      "archive": true,
      "media": []
    },
    {
      "id": "project-7",
      "name": "쿠키페이PG",
      "description": "WooCommerce PG 연동",
      "details": "WooCommerce PG 연동",
      "archive": true,
      "media": []
    },
    {
      "id": "project-8",
      "name": "이더메인넷",
      "description": "코인 전송·Blockscout 구축",
      "details": "코인 전송·Blockscout 구축",
      "archive": true,
      "media": []
    },
    {
      "id": "project-9",
      "name": "파이&솔라나",
      "description": "Solana SWAP·MEME API",
      "details": "Solana SWAP·MEME API",
      "archive": true,
      "media": []
    },
    {
      "id": "project-10",
      "name": "Digifinex",
      "description": "MM 시장조성 로직",
      "details": "MM 시장조성 로직",
      "archive": true,
      "media": []
    },
    {
      "id": "project-11",
      "name": "테더마스터",
      "description": "거래소 연동 페이지",
      "details": "거래소 연동 페이지",
      "archive": true,
      "media": []
    },
    {
      "id": "project-12",
      "name": "ASDS",
      "description": "판매 API 플랫폼 제작",
      "details": "판매 API 플랫폼 제작",
      "archive": true,
      "media": []
    },
    {
      "id": "project-13",
      "name": "Figwts",
      "description": "주문 API·차트 API",
      "details": "주문 API·차트 API",
      "archive": true,
      "media": []
    },
    {
      "id": "project-14",
      "name": "Cotafa",
      "description": "연말 정산 자동화",
      "details": "연말 정산 자동화",
      "archive": true,
      "media": []
    },
    {
      "id": "project-15",
      "name": "KIPVC",
      "description": "KICS 통합·테이블 설계",
      "details": "KICS 통합·테이블 설계",
      "archive": true,
      "media": []
    },
    {
      "id": "project-16",
      "name": "빗썸 김치프리미엄",
      "description": "거래 데이터 10만건",
      "details": "거래 데이터 10만건",
      "archive": true,
      "media": []
    },
    {
      "id": "project-17",
      "name": "investLog",
      "description": "이용약관·개인정보 방침 작성",
      "details": "이용약관·개인정보 방침 작성",
      "archive": true,
      "media": []
    },
    {
      "id": "project-18",
      "name": "금결원 파워볼",
      "description": "금융결제원 오픈 API 연구",
      "details": "금융결제원 오픈 API 연구",
      "archive": true,
      "media": []
    },
    {
      "id": "project-19",
      "name": "플리키",
      "description": "상품 자동업로드·워터마크",
      "details": "상품 자동업로드·워터마크",
      "archive": false,
      "media": []
    },
    {
      "id": "project-20",
      "name": "SayHello",
      "description": "FTP API + 콘솔 툴",
      "details": "FTP API + 콘솔 툴",
      "archive": true,
      "media": []
    },
    {
      "id": "project-21",
      "name": "MD AUTO",
      "description": "퍼블리싱 + 텔레그램 알림",
      "details": "퍼블리싱 + 텔레그램 알림",
      "archive": true,
      "media": []
    },
    {
      "id": "project-22",
      "name": "AI 챗봇 연동",
      "description": "AI를 활용한 챗봇 연동 개발",
      "details": "AI를 활용한 챗봇 연동 개발",
      "archive": false,
      "media": []
    },
    {
      "id": "project-23",
      "name": "메타·인스타그램 마케팅",
      "description": "SNS 마케팅 관련 기능 개발",
      "details": "SNS 마케팅 관련 기능 개발",
      "archive": false,
      "media": []
    },
    {
      "id": "project-24",
      "name": "골프 스코어·정산 도구",
      "description": "플레이어별 점수·정산 계산",
      "details": "플레이어별 점수·정산 계산",
      "archive": true,
      "media": []
    },
    {
      "id": "project-25",
      "name": "은행 API 연동",
      "description": "은행 연동 관련 업무 개발",
      "details": "은행 연동 관련 업무 개발",
      "archive": false,
      "media": []
    }
  ],
  "documents": [
    {
      "id": "nft-market",
      "title": "웹사이트 개발",
      "description": "쇼핑몰·어드민 페이지, 서버 이전, 시스템 연동 등 다양한 웹사이트 구축 경험",
      "details": "쇼핑몰과 어드민 페이지 제작부터 결제·예약 관리, 서버 이전과 시스템 연동까지 웹서비스 구축에 필요한 작업을 수행합니다. 아래에서 DSWAR Market과 신이 홈페이지의 화면을 확인할 수 있습니다.",
      "projectIds": [
        "dswar",
        "shini",
        "project-1",
        "project-2",
        "project-3",
        "project-4"
      ]
    },
    {
      "id": "payment-integration",
      "title": "결제 연동",
      "description": "신용카드, USDT, PayPal 등 다양한 결제 수단 통합 및 WooCommerce 연동",
      "details": "카드·USDT·PayPal 등 결제 수단과 멤버십 연동, WooCommerce 결제 플러그인 및 PG 연동을 수행합니다. C9Pro 시연 화면에서는 결제 연동 프로젝트의 화면 구성을 확인할 수 있습니다.",
      "projectIds": [
        "c9pro",
        "project-5",
        "project-6",
        "project-7"
      ]
    },
    {
      "id": "coin-development",
      "title": "코인 개발",
      "description": "메인넷 구축, 거래소 연동, 코인 전송 및 SWAP API 개발 등 블록체인 기반 시스템",
      "details": "메인넷과 블록 탐색기 구축, 코인 전송, Solana SWAP·MEME API, 거래소 연동 등 블록체인 기반 시스템을 개발합니다. 이더메인넷의 Blockscout 구축과 Digifinex 시장조성 로직 등 프로젝트별 수행 범위는 아래 이력에 정리했습니다.",
      "projectIds": [
        "project-8",
        "project-9",
        "project-10",
        "project-11"
      ]
    },
    {
      "id": "api-platform",
      "title": "API·플랫폼",
      "description": "ERP, 공공기관 API, 내부 플랫폼 등 다양한 B2B API 및 플랫폼 개발 경험",
      "details": "판매·주문·차트 API와 업무용 플랫폼, 연말 정산 자동화, 공공기관 시스템 통합 및 테이블 설계를 수행합니다. 서비스 간 데이터 연동과 내부 업무 처리를 위한 API·플랫폼 개발 이력을 소개합니다.",
      "projectIds": [
        "project-12",
        "project-13",
        "project-14",
        "project-15"
      ]
    },
    {
      "id": "data-analysis",
      "title": "데이터 분석",
      "description": "금융 데이터 수집, 오픈 API 연구, 데이터 기반 의사결정 지원 분석툴",
      "details": "금융·거래 데이터 수집과 오픈 API 연구를 수행합니다. 빗썸 김치프리미엄 거래 데이터 10만 건 수집, 금융결제원 오픈 API 연구, investLog의 이용약관·개인정보 방침 작성 등 관련 수행 이력을 정리했습니다.",
      "projectIds": [
        "project-16",
        "project-17",
        "project-18"
      ]
    },
    {
      "id": "automation-tools",
      "title": "툴·자동화",
      "description": "업로드 툴, FTP 자동화, 알림 시스템 등 운영을 위한 다양한 자동화 도구 개발",
      "details": "상품 자동 업로드와 워터마크 처리, FTP API와 콘솔 도구, 텔레그램 알림 등 반복적인 운영 작업을 위한 도구를 개발합니다. 프로젝트별 자동화 작업과 연동 범위는 아래에서 확인할 수 있습니다.",
      "projectIds": [
        "project-19",
        "project-20",
        "project-21"
      ]
    }
  ]
}' AS JSON);
SET @homepage_legacy = (SELECT value FROM settings WHERE setting_key = 'homepage_v1');
DROP TEMPORARY TABLE IF EXISTS homepage_import_guard;
CREATE TEMPORARY TABLE homepage_import_guard (
  valid INT NOT NULL,
  CONSTRAINT homepage_legacy_json_must_be_valid CHECK (valid = 1)
);
INSERT INTO homepage_import_guard (valid) VALUES (
  CASE WHEN @homepage_apply = 0 OR @homepage_legacy IS NULL THEN 1
    WHEN JSON_VALID(@homepage_legacy) THEN
      CASE WHEN JSON_TYPE(JSON_EXTRACT(@homepage_legacy, '$.content')) = 'NULL' OR
        JSON_TYPE(JSON_EXTRACT(@homepage_legacy, '$.content.categories')) = 'ARRAY' THEN 1 ELSE 0 END
    ELSE 0 END
);
DROP TEMPORARY TABLE homepage_import_guard;
SET @homepage_categories = IF(
  JSON_VALID(@homepage_legacy) AND JSON_TYPE(JSON_EXTRACT(@homepage_legacy, '$.content.categories')) = 'ARRAY',
  JSON_EXTRACT(@homepage_legacy, '$.content.categories'),
  JSON_EXTRACT(@homepage_seed, '$.categories')
);

INSERT INTO homepage_projects (id, name, description, details, url, archived, sort_order)
SELECT id, name, description, details, url, archived, ord
FROM JSON_TABLE(@homepage_seed, '$.projects[*]' COLUMNS (
  ord FOR ORDINALITY, id VARCHAR(64) PATH '$.id', name VARCHAR(100) PATH '$.name',
  description VARCHAR(250) PATH '$.description', details TEXT PATH '$.details',
  url VARCHAR(2048) PATH '$.url' NULL ON EMPTY, archived INT PATH '$.archive'
)) AS p WHERE @homepage_apply = 1;

INSERT INTO homepage_media (id, project_id, position, type, src, alt, poster)
SELECT media_id, project_id, ord, media_type, src, alt, poster
FROM JSON_TABLE(@homepage_seed, '$.projects[*]' COLUMNS (
  project_id VARCHAR(64) PATH '$.id',
  NESTED PATH '$.media[*]' COLUMNS (
    ord FOR ORDINALITY, media_id VARCHAR(64) PATH '$.id', media_type VARCHAR(8) PATH '$.type',
    src VARCHAR(2048) PATH '$.src', alt VARCHAR(300) PATH '$.alt',
    poster VARCHAR(2048) PATH '$.poster' NULL ON EMPTY
  )
)) AS m WHERE @homepage_apply = 1 AND media_id IS NOT NULL;

INSERT INTO homepage_categories (id, title, tagline, description, icon, visible, featured, sort_order)
SELECT id, title, tagline, COALESCE(description, tagline), icon, visible, featured, ord
FROM JSON_TABLE(@homepage_categories, '$[*]' COLUMNS (
  ord FOR ORDINALITY, id VARCHAR(64) PATH '$.id', title VARCHAR(40) PATH '$.title',
  tagline VARCHAR(150) PATH '$.tagline', description TEXT PATH '$.description' NULL ON EMPTY,
  icon VARCHAR(16) PATH '$.icon', visible INT PATH '$.visible', featured INT PATH '$.featured'
)) AS c WHERE @homepage_apply = 1;

INSERT INTO homepage_features (category_id, position, text)
SELECT category_id, ord, feature
FROM JSON_TABLE(@homepage_categories, '$[*]' COLUMNS (
  category_id VARCHAR(64) PATH '$.id',
  NESTED PATH '$.features[*]' COLUMNS (ord FOR ORDINALITY, feature VARCHAR(150) PATH '$')
)) AS f WHERE @homepage_apply = 1;

DROP TEMPORARY TABLE IF EXISTS homepage_import_slides;
CREATE TEMPORARY TABLE homepage_import_slides AS
SELECT s.*,
  COALESCE((
    SELECT p.id FROM homepage_projects p
    WHERE BINARY p.name = BINARY s.name AND BINARY p.description = BINARY s.description
      AND BINARY COALESCE(p.url, '') = BINARY COALESCE(s.url, (SELECT original.url FROM homepage_projects original WHERE original.id = s.portfolio_id), '')
    ORDER BY p.sort_order LIMIT 1
  ), CONCAT('import-', s.category_ord, '-', s.ord)) AS resolved_id
FROM JSON_TABLE(@homepage_categories, '$[*]' COLUMNS (
  category_ord FOR ORDINALITY, category_id VARCHAR(64) PATH '$.id',
  NESTED PATH '$.slides[*]' COLUMNS (
    ord FOR ORDINALITY, label VARCHAR(150) PATH '$.label',
    name VARCHAR(100) PATH '$.project.name', description VARCHAR(250) PATH '$.project.description',
    url VARCHAR(2048) PATH '$.project.url' NULL ON EMPTY,
    portfolio_id VARCHAR(64) PATH '$.project.portfolioId' NULL ON EMPTY,
    media_type VARCHAR(8) PATH '$.media.type' NULL ON EMPTY,
    src VARCHAR(2048) PATH '$.media.src' NULL ON EMPTY, alt VARCHAR(300) PATH '$.media.alt' NULL ON EMPTY,
    poster VARCHAR(2048) PATH '$.media.poster' NULL ON EMPTY
  )
)) AS s WHERE @homepage_apply = 1;

INSERT INTO homepage_projects (id, name, description, details, url, archived, sort_order)
SELECT s.resolved_id, s.name, s.description, s.description,
  COALESCE(s.url, (SELECT p.url FROM homepage_projects p WHERE p.id = s.portfolio_id)),
  0, 1000 + s.category_ord * 2 + s.ord
FROM homepage_import_slides s
WHERE NOT EXISTS (SELECT 1 FROM homepage_projects p WHERE p.id = s.resolved_id)
ON DUPLICATE KEY UPDATE id = homepage_projects.id;

INSERT INTO homepage_media (id, project_id, position, type, src, alt, poster)
SELECT CONCAT(s.resolved_id, '-gallery-', m.position), s.resolved_id, m.position, m.type, m.src, m.alt, m.poster
FROM homepage_import_slides s JOIN homepage_media m ON m.project_id = s.portfolio_id
WHERE s.resolved_id <> s.portfolio_id
  AND NOT EXISTS (SELECT 1 FROM homepage_media existing WHERE existing.project_id = s.resolved_id)
ON DUPLICATE KEY UPDATE id = homepage_media.id;

INSERT INTO homepage_media (id, project_id, position, type, src, alt, poster)
SELECT CONCAT('slide-media-', s.category_ord, '-', s.ord), s.resolved_id,
  1000 + s.category_ord * 2 + s.ord, s.media_type, s.src, s.alt, s.poster
FROM homepage_import_slides s WHERE s.src IS NOT NULL;

INSERT INTO homepage_slides (category_id, position, label, project_id, media_id)
SELECT category_id, ord, label, resolved_id,
  IF(src IS NULL, NULL, CONCAT('slide-media-', category_ord, '-', ord))
FROM homepage_import_slides;
DROP TEMPORARY TABLE homepage_import_slides;

INSERT INTO homepage_documents (id, title, description, details, sort_order)
SELECT id, title, description, details, ord
FROM JSON_TABLE(@homepage_seed, '$.documents[*]' COLUMNS (
  ord FOR ORDINALITY, id VARCHAR(64) PATH '$.id', title VARCHAR(100) PATH '$.title',
  description TEXT PATH '$.description', details TEXT PATH '$.details'
)) AS d WHERE @homepage_apply = 1;

INSERT INTO homepage_document_projects (document_id, project_id, position)
SELECT document_id, project_id, ord
FROM JSON_TABLE(@homepage_seed, '$.documents[*]' COLUMNS (
  document_id VARCHAR(64) PATH '$.id',
  NESTED PATH '$.projectIds[*]' COLUMNS (ord FOR ORDINALITY, project_id VARCHAR(64) PATH '$')
)) AS dp WHERE @homepage_apply = 1;

INSERT INTO settings (setting_key, value)
SELECT 'homepage_revision', COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(@homepage_legacy, '$.revision')), 'null'), UUID())
WHERE @homepage_apply = 1
ON DUPLICATE KEY UPDATE value = VALUES(value);
INSERT INTO settings (setting_key, value)
SELECT 'homepage_schema', 'relational-v1' WHERE @homepage_apply = 1
ON DUPLICATE KEY UPDATE value = VALUES(value);
COMMIT;
-- END HOMEPAGE SEED AND LEGACY IMPORT

SELECT 'homepage_categories' AS table_name, COUNT(*) AS row_count FROM homepage_categories
UNION ALL SELECT 'homepage_features', COUNT(*) FROM homepage_features
UNION ALL SELECT 'homepage_projects', COUNT(*) FROM homepage_projects
UNION ALL SELECT 'homepage_media', COUNT(*) FROM homepage_media
UNION ALL SELECT 'homepage_slides', COUNT(*) FROM homepage_slides
UNION ALL SELECT 'homepage_documents', COUNT(*) FROM homepage_documents
UNION ALL SELECT 'homepage_document_projects', COUNT(*) FROM homepage_document_projects;
SELECT setting_key, value FROM settings WHERE setting_key IN ('homepage_schema', 'homepage_revision');
