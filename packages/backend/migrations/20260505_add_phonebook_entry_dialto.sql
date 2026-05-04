-- Add per-entry optional redirect fields to phonebook entries
-- dialto_context: context uid for redirecting the call
-- dialto_exten: extension number within that context

ALTER TABLE route_phonebook_entries
  ADD COLUMN dialto_context VARCHAR(100) DEFAULT NULL COMMENT 'Optional: context uid for redirect',
  ADD COLUMN dialto_exten   VARCHAR(32)  DEFAULT NULL COMMENT 'Optional: extension to dial in the context';

-- Also add a PHONEBOOK_LABEL lookup: func_odbc will return label + dialto fields
-- Update the ODBC function to return label,dialto_context,dialto_exten
