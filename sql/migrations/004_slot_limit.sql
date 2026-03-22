-- ============================================================
-- Migration 004 — Per-slot capacity enforcement inside atomic lock
-- MAX_PER_SLOT = 2 enforced at DB level, inside the advisory lock.
-- Safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION book_token_atomic(
  p_patient_id  UUID,
  p_doctor_id   UUID,
  p_date        DATE,
  p_notes       TEXT    DEFAULT NULL,
  p_slot_time   TEXT    DEFAULT NULL,
  p_max_per_slot INT    DEFAULT 2
)
RETURNS tokens AS $$
DECLARE
  next_num   INTEGER;
  slot_count INTEGER;
  new_token  tokens;
BEGIN
  -- Serialise all bookings for this doctor+date under one advisory lock.
  -- This eliminates the TOCTOU race: count → check → insert is now atomic.
  PERFORM pg_advisory_xact_lock(hashtext(p_doctor_id::text || p_date::text));

  -- Per-slot capacity check (inside the lock — no race possible)
  IF p_slot_time IS NOT NULL THEN
    SELECT COUNT(*) INTO slot_count
      FROM tokens
     WHERE doctor_id   = p_doctor_id
       AND booking_date = p_date
       AND slot_time    = p_slot_time
       AND status      <> 'cancelled';

    IF slot_count >= p_max_per_slot THEN
      RAISE EXCEPTION 'SLOT_FULL: slot % has reached maximum capacity of % bookings',
        p_slot_time, p_max_per_slot
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Sequential token number (global per doctor+date, not per slot)
  SELECT COALESCE(MAX(token_number), 0) + 1
    INTO next_num
    FROM tokens
   WHERE doctor_id    = p_doctor_id
     AND booking_date = p_date;

  INSERT INTO tokens (patient_id, doctor_id, token_number, booking_date, status, notes, slot_time)
  VALUES (p_patient_id, p_doctor_id, next_num, p_date, 'waiting', p_notes, p_slot_time)
  RETURNING * INTO new_token;

  RETURN new_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
