# Universal Dialplan Directories Design

**Date:** 2026-08-28  
**Status:** Approved  
**Scope:** Clean replacement of route phonebooks; no migration, dual-read, or legacy compatibility

## 1. Goal

Build one reliable directory mechanism for Asterisk dialplan that:

- looks up a record by an explicitly selected call value;
- returns any declared directory field;
- writes selected values into named channel variables;
- can feed CallerID, dial targets, queues, redirects, notifications, conditions, and later applications;
- keeps lookup semantics stable when mutable channel state changes;
- remains simple enough to configure without exposing raw dialplan.

The first concrete consumer is the trunk carousel. Every trunk may receive a different outgoing CallerID derived from the immutable original caller number.

## 2. Non-goals

- No migration of `route_phonebooks`, `route_phonebook_entries`, bindings, or stored route actions.
- No compatibility reader for `phonebookUid`, `varKey`, `phonebook_uid`, `cid_mode=phonebook`, or `PB_*`.
- No general SQL/query builder, joins, multi-table lookup, or arbitrary boolean expression engine.
- No ODBC/FUNC_ODBC runtime integration. Runtime access is HTTP through the backend.
- No retries that can extend call setup time.
- No dynamic physical SQL columns for user-created fields.

Development databases may be recreated with the new schema. The implementation must delete obsolete code instead of preserving fallback branches.

## 3. Core invariants

1. `CALLERID(num)` is mutable presentation state and is never an implicit lookup key.
2. The first generated route entered by a call captures `__KRSK_ORIG_CALLER_NUM` once, before directory policies and route actions, and sets inherited marker `__KRSK_ORIG_CALLER_CAPTURED=1`. The marker, not CallerID emptiness, prevents recapture in nested routes.
3. Every lookup explicitly identifies its key source.
4. Directory and field references use stable numeric UIDs, not display names.
5. An exact match always wins over a pattern match.
6. Pattern ranking follows Asterisk `ext_cmp`: left-to-right specificity. Identical lookup values and identical pattern text are rejected at write time.
7. Every output is explicitly mapped. Lookups do not populate a global `PB_*` namespace.
8. `FOUND`, `NOT_FOUND`, and technical `ERROR` are distinct outcomes.
9. Runtime lookup is tenant-scoped by both `directory_uid` and `user_uid`.
10. One request returns every field requested from the matched record.

## 4. Domain model

### 4.1 Directory

`Directory` owns:

- `uid`
- `user_uid`
- `name`
- `description`
- `lookup_field_uid`
- `key_normalization`: `none | digits | ru_8_to_7`
- `revision`
- timestamps

Each directory has exactly one lookup field. `lookup_field_uid` must reference one of its fields.

Persisted rows and API responses use `lookup_field_uid`. Management create/update payloads use `lookupFieldKey`, because newly submitted fields do not have numeric UIDs yet. The service creates fields, resolves that immutable key, and stores `lookup_field_uid` in the same transaction.

### 4.2 Directory field

`DirectoryField` owns:

- `uid`
- `directory_uid`
- `key`: immutable machine key unique inside the directory
- `label`: editable display name
- `type`: `string | phone | number | boolean`
- `required`
- `position`

References use `uid`. Renaming `label` is safe. Changing `key` after records or dialplan references exist is prohibited; the UI treats it as immutable after creation.

### 4.3 Directory record

`DirectoryRecord` owns:

- `uid`
- `directory_uid`
- `lookup_value`
- `normalized_lookup_value`
- `match_kind`: `exact | asterisk_pattern`
- `priority`
- `values`: JSON object keyed by decimal `field_uid`
- `comment`
- timestamps

Persisted `values` use decimal `field_uid` keys. Management API create/update payloads use immutable field `key` values so a directory, its new fields, and its records can be created atomically before numeric field UIDs exist. The service maps keys to UIDs transactionally. API responses include both the resolved field schema and record values keyed by field `key`. `lookup_value` is represented under the lookup field key in management payloads, while the dedicated indexed columns remain the persisted lookup source of truth.

Records have a unique index on `(directory_uid, normalized_lookup_value, match_kind)`; duplicate exact keys and duplicate pattern text are both invalid at create, update, and CSV import. The UI and management payloads do not ask the user for `match_kind` or `priority`. `match_kind` is derived from a leading `_` on the lookup value (`_` → `asterisk_pattern`, otherwise `exact`). Stored `priority` is unused for matching and is always persisted as `1`. Exact values use the directory normalization strategy. Pattern text is trimmed and syntax-validated but is not passed through `digits`; it is evaluated against the normalized incoming key. Pattern rows are considered only after exact lookup misses. Among matching patterns the more specific one wins, using Asterisk `pbx.c` `ext_cmp` / `ext_cmp_pattern_pos`: compare tokens left to right; a literal beats `N`/`Z`/`X`, a smaller character class beats a larger one, and `.` / `!` are least specific. `_7900123XXXX` therefore beats `_7900XXXXXXX`, and `_1XXXXX` beats `_X11111`. There is no uid fallback for identical patterns because identical pattern text cannot be stored.

### 4.4 Route directory policy

The existing useful separation of data and behavior remains, renamed around directories:

- `route_uid`
- `directory_uid`
- `position`
- `key_source`
- `match_mode`: `on_match | on_no_match`
- `behavior_type`: `set_name | set_number | drop | redirect | map_fields | custom`
- `behavior_params`
- `actions`
- `user_uid`

`map_fields` contains explicit `{ fieldUid, targetVariable }` mappings. Presets that consume a field store `fieldUid`; no preset assumes a field name.

## 5. Shared contracts

### 5.1 Call value source

```ts
export type CallValueSource =
  | { source: 'fixed'; value: string }
  | { source: 'route_pattern' }
  | { source: 'variable'; name: string }
  | { source: 'original_caller' }
  | { source: 'current_caller' };
```

`original_caller` compiles to `${KRSK_ORIG_CALLER_NUM}`. `current_caller` is explicit and compiles to `${CALLERID(num)}`.

### 5.2 Directory value source

```ts
export interface DirectoryValueSource {
  source: 'directory';
  directoryUid: number;
  keySource: CallValueSource;
  valueFieldUid: number;
  onMissing: 'keep' | 'empty' | 'skip';
}

export type ValueSource = CallValueSource | DirectoryValueSource;
```

Direct value consumers use one `valueFieldUid`. A standalone lookup action can request multiple outputs.

### 5.3 Standalone lookup action

```ts
export interface DirectoryLookupOutput {
  fieldUid: number;
  targetVariable: string;
}

export interface IDirectoryLookupParams {
  directoryUid: number;
  keySource: CallValueSource;
  outputs: DirectoryLookupOutput[];
  onMissing: 'keep' | 'empty';
}
```

`targetVariable` must match `^[A-Z][A-Z0-9_]{1,63}$`. Reserved Asterisk and Krasterisk internal names are rejected.

### 5.4 Trunk CallerID

```ts
export type TrunkCallerIdSource =
  | { mode: 'static'; value?: string }
  | {
      mode: 'directory';
      directoryUid: number;
      valueFieldUid: number;
      keySource: { source: 'original_caller' };
      onMissing: 'keep_original';
    };

export interface ITrunkCarouselItem {
  trunkId: string;
  callerId: TrunkCallerIdSource;
  timeout?: number;
}
```

The first version intentionally fixes the carousel directory key to `original_caller`. General key selection remains available through the standalone lookup and general `DirectoryValueSource`, but is not exposed in the simple carousel row.

## 6. Runtime lookup contract

`digits` removes every non-ASCII digit. `ru_8_to_7` does the same and then rewrites an 11-digit national `8XXXXXXXXXX` to `7XXXXXXXXXX`. Full E.164 conversion is deliberately excluded because it requires an explicit numbering plan and country configuration.

### 6.1 Endpoint

`GET /api/internal/dialplan/directory-lookup`

Required query parameters:

- `directory_uid`
- `user_uid`
- `key`
- `field_uids`: comma-separated ordered UIDs
- `api_key`

The service first loads the directory with `where: { uid: directoryUid, user_uid: userUid }`. A foreign or missing directory returns `NOT_FOUND` without revealing whether another tenant owns it.

Runtime authentication is fail-closed. The server must have a non-empty `DIALPLAN_API_KEY`, the request must provide a key, and comparison uses the existing timing-safe helper. Missing server configuration, missing request key, and mismatch all return HTTP 401 before lookup.

### 6.2 Response

The response is versioned and positionally aligned with `field_uids`:

```text
KDL1|FOUND|<base64-value-1>|<base64-value-2>
KDL1|NOT_FOUND
KDL1|ERROR
```

Base64 prevents pipes, Unicode, line breaks, commas, and dialplan metacharacters from corrupting field boundaries. The compiler decodes each selected field before assigning it.

The endpoint returns HTTP 200 for domain outcomes. Authentication failure remains HTTP 401. Unexpected exceptions are logged server-side and converted to `KDL1|ERROR` without response details.

### 6.3 Timeout and retry

Before every directory request, generated dialplan sets `CURLOPT(conntimeout)=1` and `CURLOPT(httptimeout)=2`. There is no automatic retry. Consumers apply their configured missing/error policy immediately.

### 6.4 Observability

Record:

- lookup duration;
- outcome (`found`, `not_found`, `error`);
- tenant UID and directory UID;
- exact versus pattern match.

Never log the lookup key or returned field values.

## 7. Dialplan compiler

`DirectoryLookupCompiler` is the only generator allowed to emit directory HTTP lookup lines.

It:

1. compiles and sanitizes `CallValueSource`;
2. clears private result/status variables;
3. builds one URL for all requested fields;
4. validates the `KDL1` marker and outcome;
5. decodes values into unique private variables;
6. applies output mappings or returns expressions to a direct consumer;
7. implements `keep`, `empty`, and `skip` without leaking prior values.

Private variable names derive from a stable action/consumer token and field UID, for example `KRSK_DL_A3_F17`. User output variables are assigned only after a successful decode.

Existing lookup generation in `dialplan.util.ts`, `dialplan-target.util.ts`, `dialplan-trunk-carousel.util.ts`, and phonebook binding generation is removed.

## 8. Trunk carousel behavior

Before policies or actions, guarded only by the inherited capture marker:

```ini
ExecIf($["${KRSK_ORIG_CALLER_CAPTURED}" != "1"]?Set(__KRSK_ORIG_CALLER_NUM=${CALLERID(num)}))
ExecIf($["${KRSK_ORIG_CALLER_CAPTURED}" != "1"]?Set(__KRSK_ORIG_CALLER_CAPTURED=1))
```

For every attempt:

1. restore `CALLERID(num)` from `${KRSK_ORIG_CALLER_NUM}`;
2. resolve the row's static or directory CallerID;
3. for directory mode, lookup by `${KRSK_ORIG_CALLER_NUM}`;
4. on `FOUND`, set the returned value as `CALLERID(num)`;
5. on `NOT_FOUND` or `ERROR`, retain original CallerID;
6. execute `Dial`;
7. continue according to the existing sequential or random-then-failover traversal.

When several rows use the same directory and original caller key, the compiler requests the union of their field UIDs once before entering the attempt loop. There is at most one HTTP request per distinct directory for a carousel invocation.

Trunks are stored by the existing stable PJSIP endpoint `trunkId` (`ITrunkListItem.id`), not by the derived display name currently saved by the carousel UI. The generator dials that technical ID directly. Editing trunk settings therefore does not invalidate saved carousel actions.

## 9. Route policies

Route policies execute in ascending `position` before route actions.

Each policy performs one directory lookup using its explicit `key_source`. It then:

- executes the selected behavior on match;
- executes `on_no_match` behavior only for `NOT_FOUND`;
- treats technical `ERROR` as fail-open and continues the route;
- sets mapped output variables only on `FOUND`;
- never interprets backend unavailability as a whitelist miss.

This distinction is safety-critical: an unavailable backend must not trigger `on_no_match + drop`.

## 10. Frontend design

### 10.1 Directory editor

The current phonebook form becomes a schema-and-record editor:

- metadata section;
- field schema editor;
- exactly one field marked as lookup field;
- normalization selector for `phone`;
- table editor for records;
- lookup values; a leading `_` on a phone lookup field is an Asterisk pattern;
- CSV import/export based on immutable field keys;
- lookup test showing matched record, match kind, and returned fields.

Schema changes are validated before save. A field referenced by a route or action cannot be deleted; the API returns reference locations and the UI displays them.

The editor is organized as four tabs inside one scrollable body with a fixed footer: general, fields, records, lookup test. A field carries a technical `key` used for storage, integrations, and CSV columns, and a human display name shown in the UI; CSV is named only inside the import section. The lookup field is picked by a single selector rather than one switch per field. When save is unavailable the UI states the reason, and API errors are shown instead of being swallowed.

### 10.1.1 CSV workflow

- The records tab exposes import, export, and template download.
- Import replaces every record in the directory. It runs only after an explicit confirmation that names the number of records to be replaced.
- Before confirmation the UI previews file name, detected delimiter, row count, mapped columns, and unknown columns.
- Import is unavailable while the directory has never been saved or the draft has unsaved changes; the UI asks the user to save first. After a successful import the records are re-read without discarding the rest of the draft.
- Export is fetched through the authenticated API as a blob, never through a plain anchor href.
- The template is derived from the declared schema: one column per field key plus `comment`, and a single example row. Legacy `match_kind` / `priority` columns are accepted and ignored.

### 10.1.2 CSV data contract

- Import is atomic: the whole file is parsed and validated first, then one transaction deletes the previous records, writes the new ones, and increments `revision`. Any error leaves the previous records intact.
- Cell values are read as raw text. Leading zeros, a leading plus, date-like strings, and long numeric strings are stored exactly as written.
- Import accepts an optional UTF-8 BOM and both `;` and `,` as delimiter, detected from the header line. Quoted fields may contain the delimiter, quotes, and newlines.
- Export is deterministic: `;` delimiter, UTF-8 BOM, header from schema keys plus `comment`, records ordered by Asterisk pattern specificity then lookup value.
- An empty cell in a required column is an error, never a coerced `0`, `false`, or empty string.
- Errors are returned as a structured list of `{ row, column?, code, message }`, where `row` is the physical line in the file.

### 10.1.3 Responsive behavior

- The editor is usable from 360 px to 2560 px with no horizontal page overflow.
- Records render as a table on desktop and as vertical cards below the mobile breakpoint, so no horizontal scroll is required to reach a record action.
- Records are paginated so importing hundreds of rows does not mount thousands of controls; the visible page and the total record count are shown in the records tab.
- At 360 px the CSV controls wrap or collapse, and the footer stays reachable.

### 10.2 Reusable lookup field

`DirectoryLookupField` renders:

- key-source selector;
- directory selector;
- returned-field selector filtered by expected value type;
- missing-value policy where the host exposes one.

Catalog loading remains centralized through the dialplan schema reference layer. Dialplan application schemas must not issue their own catalog queries.

### 10.3 Trunk carousel

Each row renders:

- trunk;
- timeout;
- CallerID source (`static | directory`);
- static value, or directory and result field.

The key source is displayed as read-only explanatory text: original caller number. Missing/error behavior is displayed as: keep original CallerID.

### 10.4 Standalone action

Add `directory_lookup` to the system action category. Its editor supports multiple `{ field, target variable }` mappings and validates duplicate or reserved targets.

## 11. Validation and deletion rules

- Directory names are unique per tenant.
- Field keys are unique per directory and immutable after creation.
- A directory must contain one lookup field before records can be saved.
- `phone` lookup values are normalized on write and lookup.
- Pattern matching is permitted only for a `phone` lookup field.
- Exact duplicate normalized keys are rejected.
- Pattern priorities are required positive integers.
- Record values must conform to field types.
- A referenced field or directory cannot be deleted. Deletion returns structured reference locations.
- Action save/apply validates that directory and field UIDs belong to the route tenant.
- Output variable names are upper-case, bounded, and checked against a reserved-name set.

## 12. Error behavior

- `NOT_FOUND`: apply the consumer's explicit missing policy.
- `ERROR` or empty/malformed CURL response: apply technical fail-open behavior and expose a private status for diagnostics.
- Route whitelist policy: technical error continues; only a valid `NOT_FOUND` may activate `on_no_match`.
- Carousel directory CallerID: both missing and error retain original CallerID.
- Standalone lookup `keep`: existing target variables remain unchanged.
- Standalone lookup `empty`: target variables are cleared before lookup and stay empty on missing/error.
- Direct dial target with `skip`: the consuming application is not executed.

## 13. Testing

### Unit

- normalization for every mode;
- schema and record validation;
- exact lookup precedence;
- Asterisk pattern specificity and rejection of duplicate pattern text;
- tenant isolation;
- encoded response round-trip with pipes, Unicode, line breaks, empty values;
- compiler output for every key source and missing policy;
- reserved variable rejection;
- trunk ID resolution.

### Integration

- directory CRUD including fields and records;
- blocked deletion with reference locations;
- route policy save/apply validation;
- standalone action DTO and registry exhaustiveness;
- frontend schema editor and reusable lookup field;
- carousel editing and serialization.

### Critical dialplan scenario

1. Incoming CallerID is `100`.
2. Trunk A resolves outgoing CID `700` and returns `NOANSWER`.
3. Trunk B must still query with `100`, resolve `800`, and dial with `800`.
4. Missing and backend timeout cases dial each trunk with `100`.
5. Exact record wins over a matching pattern.
6. A foreign-tenant directory produces no data.

### Project gate

```bash
npm run lint
npm run test:backend
npm run test:frontend
npm run build
```

The Asterisk harness adds a scenario asserting the generated URL key and per-attempt CallerID sequence.

## 14. Acceptance criteria

- No generated lookup URL uses `${CALLERID(num)}` unless the saved key source explicitly equals `current_caller`.
- No new or remaining runtime directory path emits `PB_*`.
- No runtime result depends on sorted JSON keys or positional union-of-vars generation.
- Carousel attempt N cannot change the lookup key of attempt N+1.
- One carousel request is emitted per distinct directory.
- Backend failure cannot turn a route whitelist into a call rejection.
- Directory and field renames do not break saved actions.
- A failed CSV import leaves the stored records and `revision` unchanged.
- A CSV round trip preserves every stored value as written, including leading zeros and a leading plus.
- No CSV import can run without an explicit replace confirmation.
- No unsaved draft field is lost by importing records.
- The directory editor renders without horizontal page overflow at 360, 768, and 1440 px.
- All user-facing directory strings exist in both `ru` and `en` locales.
- All tenant ownership checks and project verification commands pass.

