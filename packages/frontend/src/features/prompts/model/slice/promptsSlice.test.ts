import { describe, it, expect } from 'vitest';
import { promptsReducer, promptsActions } from './promptsSlice';
import type { PromptsSchema } from '../types/promptsSchema';
import type { IPrompt } from '@/entities/prompt';

const mockPrompt = {
  uid: 1,
  name: 'welcome',
  description: 'Welcome message',
  filepath: '/var/lib/asterisk/sounds/welcome.wav',
  format: 'wav',
} as IPrompt;

describe('promptsSlice', () => {
  const initialState: PromptsSchema = {
    isModalOpen: false,
    selectedPrompt: null,
    modalMode: 'upload',
  };

  it('should return initial state', () => {
    expect(promptsReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  it('should handle openUploadModal', () => {
    const state = promptsReducer(initialState, promptsActions.openUploadModal());
    expect(state.isModalOpen).toBe(true);
    expect(state.selectedPrompt).toBeNull();
    expect(state.modalMode).toBe('upload');
  });

  it('should handle openRecordModal', () => {
    const state = promptsReducer(initialState, promptsActions.openRecordModal());
    expect(state.isModalOpen).toBe(true);
    expect(state.selectedPrompt).toBeNull();
    expect(state.modalMode).toBe('record');
  });

  it('should handle closeModal', () => {
    const openState: PromptsSchema = {
      isModalOpen: true,
      selectedPrompt: mockPrompt,
      modalMode: 'upload',
    };
    const state = promptsReducer(openState, promptsActions.closeModal());
    expect(state.isModalOpen).toBe(false);
    expect(state.selectedPrompt).toBeNull();
  });
});

