-- ============================================================
-- Migration 002: Recall System
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE recalls (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  doctor_id         UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  original_token_id UUID NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  recall_date       DATE NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'sent', 'booked', 'expired')),
  email_sent_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recalls_patient    ON recalls (patient_id);
CREATE INDEX idx_recalls_doctor     ON recalls (doctor_id);
CREATE INDEX idx_recalls_date       ON recalls (recall_date);
CREATE INDEX idx_recalls_status     ON recalls (status);

-- Also add slot_time column to tokens if not present
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS slot_time TEXT;
