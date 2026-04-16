import { RootState } from '@/app/store/store';

export const selectVoiceRobotsIsLogModalOpen = (state: RootState) => state.voiceRobots.isLogModalOpen;
export const selectVoiceRobotsSelectedRobotIdForLogs = (state: RootState) => state.voiceRobots.selectedRobotIdForLogs;
