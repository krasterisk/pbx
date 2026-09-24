-- Model cost moves to a future billing module. Provider rows keep no price tail.
ALTER TABLE cc_ai_providers DROP COLUMN IF EXISTS pricing;
