-- ============================================================
-- Migration 003 — Add slot_time column + update book_token_atomic
-- Safe to re-run.
-- ============================================================

ALTER TABLE tokens ADD COLUMN IF NOT EXISTS slot_time TEXT;

CREATE OR REPLACE FUNCTION book_token_atomic(
  p_patient_id UUID,
  p_doctor_id  UUID,
  p_date       DATE,
  p_notes      TEXT DEFAULT NULL,
  p_slot_time  TEXT DEFAULT NULL
)
RETURNS tokens AS $$
DECLARE
  next_num  INTEGER;
  new_token tokens;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_doctor_id::text || p_date::text));

  SELECT COALESCE(MAX(token_number), 0) + 1
    INTO next_num
    FROM tokens
   WHERE doctor_id = p_doctor_id
     AND booking_date = p_date;

  INSERT INTO tokens (patient_id, doctor_id, token_number, booking_date, status, notes, slot_time)
  VALUES (p_patient_id, p_doctor_id, next_num, p_date, 'waiting', p_notes, p_slot_time)
  RETURNING * INTO new_token;

  RETURN new_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
