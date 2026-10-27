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
