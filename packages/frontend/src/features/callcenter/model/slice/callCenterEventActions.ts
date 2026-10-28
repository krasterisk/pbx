import { createAction, prepareAutoBatched, type ActionCreatorWithPayload } from '@reduxjs/toolkit';
import { callCenterSlice } from './callCenterSlice';

/** Only stream notifications are batched; state/order and manual controls stay immediate. */
function streamAction<Payload>(action: ActionCreatorWithPayload<Payload>) {
  return createAction(action.type, prepareAutoBatched<Payload>());
}

export const updateAgent = streamAction(callCenterSlice.actions.updateAgent);
export const updateQueue = streamAction(callCenterSlice.actions.updateQueue);
export const addCall = streamAction(callCenterSlice.actions.addCall);
export const updateCall = streamAction(callCenterSlice.actions.updateCall);
export const removeCall = streamAction(callCenterSlice.actions.removeCall);
