-- Phonebook entries: add `comment` and `vars` JSON, migrate old fields
-- Step 1: Add new columns
ALTER TABLE route_phonebook_entries
  ADD COLUMN comment VARCHAR(255) DEFAULT '' AFTER number,
  ADD COLUMN vars JSON DEFAULT NULL AFTER comment;

-- Step 2: Migrate data from old fields into vars
UPDATE route_phonebook_entries
SET
  comment = COALESCE(label, ''),
  vars = CASE
    WHEN (label IS NOT NULL AND label != '') OR dialto_exten IS NOT NULL OR dialto_context IS NOT NULL
    THEN JSON_OBJECT(
      'name', COALESCE(label, ''),
      'dialto_exten', COALESCE(dialto_exten, ''),
      'dialto_context', COALESCE(dialto_context, '')
    )
    ELSE NULL
  END;

-- Step 3: Clean up empty values from vars JSON
-- Remove keys with empty string values to keep vars clean
UPDATE route_phonebook_entries
SET vars = JSON_REMOVE(vars, '$.name')
WHERE JSON_UNQUOTE(JSON_EXTRACT(vars, '$.name')) = '';

UPDATE route_phonebook_entries
SET vars = JSON_REMOVE(vars, '$.dialto_exten')
WHERE JSON_UNQUOTE(JSON_EXTRACT(vars, '$.dialto_exten')) = '';

UPDATE route_phonebook_entries
SET vars = JSON_REMOVE(vars, '$.dialto_context')
WHERE JSON_UNQUOTE(JSON_EXTRACT(vars, '$.dialto_context')) = '';

-- Set vars to NULL if all keys were removed (empty object)
UPDATE route_phonebook_entries
SET vars = NULL
WHERE vars = JSON_OBJECT();

-- Step 4: Drop old columns
ALTER TABLE route_phonebook_entries
  DROP COLUMN label,
  DROP COLUMN dialto_context,
  DROP COLUMN dialto_exten;
