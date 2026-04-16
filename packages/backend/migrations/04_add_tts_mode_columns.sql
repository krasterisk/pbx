-- Migration: Add TTS mode, cache settings, and STT mode to voice_robots
-- tts_mode: 'batch' (cached) or 'streaming' (real-time gRPC)
-- tts_cache_max_age_days: 0 = unlimited (never expire), >0 = days to keep
-- stt_mode: 'hybrid' (VAD+stream, recommended) or 'full_stream' (always-on gRPC)

ALTER TABLE voice_robots
  ADD COLUMN tts_mode VARCHAR(20) NOT NULL DEFAULT 'batch',
  ADD COLUMN tts_cache_max_age_days INT NOT NULL DEFAULT 0,
  ADD COLUMN stt_mode VARCHAR(20) NOT NULL DEFAULT 'hybrid';
