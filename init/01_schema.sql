CREATE TABLE sessions (
  session_id     BIGSERIAL PRIMARY KEY,
  session_hash   CHAR(64) NOT NULL UNIQUE,
  created_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
  last_seen_at   TIMESTAMPTZ
);

CREATE TABLE classes (
  class_id    BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE
);

CREATE TABLE chats (
  chat_id            BIGSERIAL PRIMARY KEY,
  session_id         BIGINT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  class_id           BIGINT NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
  oracle_session_id  TEXT,
  created_at         TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (session_id, class_id)  -- ensures ONE chat per class per session
);

CREATE TABLE messages (
  message_id  BIGSERIAL PRIMARY KEY,
  chat_id     BIGINT NOT NULL REFERENCES chats(chat_id) ON DELETE CASCADE,
  sender      TEXT NOT NULL CHECK (sender IN ('user','agent')),
  text        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_messages_chat_time 
ON messages(chat_id, created_at);

-- Tracks which lecture recording timestamps students ask about
CREATE TABLE recording_hits (
  hit_id        BIGSERIAL PRIMARY KEY,
  message_id    BIGINT NOT NULL REFERENCES messages(message_id) ON DELETE CASCADE,
  class_id      BIGINT NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
  rec_date      DATE NOT NULL,        -- lecture date
  rec_time      TEXT NOT NULL,        -- timestamp within the recording (MM:SS offset)
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_recording_hits_class
ON recording_hits(class_id, rec_date, rec_time);

CREATE INDEX idx_recording_hits_popularity
ON recording_hits(class_id, rec_date);