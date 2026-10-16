-- Clinic AI Receptionist — relational data model
--
-- The production system logs conversations to Google Sheets. PERFORMANCE.md names a database as
-- the next step once volume outgrows Sheets; this is that schema.
--
-- Portable SQL: runs on PostgreSQL 13+ and on SQLite 3.35+ (which the tests use).
-- Timestamps are stored as ISO 8601 in UTC.

CREATE TABLE IF NOT EXISTS patients (
    channel        VARCHAR(16)  NOT NULL CHECK (channel IN ('whatsapp', 'instagram', 'messenger', 'telegram')),
    user_id        VARCHAR(64)  NOT NULL,             -- id assigned by the messaging platform
    display_name   VARCHAR(120),
    first_seen_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (channel, user_id)
);

-- One conversation = one inquiry (a 24-hour window, matching WhatsApp's customer-service window)
CREATE TABLE IF NOT EXISTS conversations (
    conversation_id  VARCHAR(40) PRIMARY KEY,
    channel          VARCHAR(16) NOT NULL CHECK (channel IN ('whatsapp', 'instagram', 'messenger', 'telegram')),
    user_id          VARCHAR(64) NOT NULL,
    started_at       TIMESTAMP WITH TIME ZONE NOT NULL,
    FOREIGN KEY (channel, user_id) REFERENCES patients (channel, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
    channel             VARCHAR(16) NOT NULL CHECK (channel IN ('whatsapp', 'instagram', 'messenger', 'telegram')),
    channel_message_id  VARCHAR(80) NOT NULL,         -- id assigned by WhatsApp / Meta / Telegram
    conversation_id     VARCHAR(40) NOT NULL REFERENCES conversations (conversation_id),
    sent_at             TIMESTAMP WITH TIME ZONE NOT NULL,
    direction           VARCHAR(8)  NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    sender              VARCHAR(8)  NOT NULL CHECK (sender IN ('patient', 'ai', 'staff')),
    intent              VARCHAR(20) CHECK (intent IN ('BOOKING_REQUEST', 'FAQ', 'CANCELLATION', 'GREETING',
                                                      'COMPLAINT', 'CONFIRMATION', 'OTHER')),
    body                TEXT,                         -- personal data: purged after 90 days (see SECURITY.md)
    -- Idempotency: a webhook retry carries the same platform message id, so it can never be stored twice
    PRIMARY KEY (channel, channel_message_id),
    CHECK ((direction = 'inbound' AND sender = 'patient') OR (direction = 'outbound' AND sender IN ('ai', 'staff')))
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id, sent_at);

CREATE TABLE IF NOT EXISTS appointments (
    appointment_id   VARCHAR(40) PRIMARY KEY,
    conversation_id  VARCHAR(40) NOT NULL REFERENCES conversations (conversation_id),
    service          VARCHAR(80) NOT NULL,
    start_at         TIMESTAMP WITH TIME ZONE NOT NULL,
    status           VARCHAR(12) NOT NULL CHECK (status IN ('booked', 'attended', 'no_show', 'cancelled')),
    reminder_sent    BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_appointments_start ON appointments (start_at);
