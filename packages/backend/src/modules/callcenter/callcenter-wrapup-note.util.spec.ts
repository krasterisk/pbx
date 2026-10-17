import { wrapupNoteFieldKey } from './callcenter-wrapup-note.util';

describe('wrapupNoteFieldKey', () => {
  it('prefers a note-like key over the first text field', () => {
    expect(wrapupNoteFieldKey([
      { field_key: 'name', field_type: 'text' },
      { field_key: 'comment', field_type: 'textarea' },
    ])).toBe('comment');
  });

  it('falls back to the first text field, then to wrapup_note', () => {
    expect(wrapupNoteFieldKey([{ field_key: 'topic', field_type: 'text' }])).toBe('topic');
    expect(wrapupNoteFieldKey([])).toBe('wrapup_note');
  });
});
