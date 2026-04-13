import { RootState } from '@/app/store/store';

export const selectVoiceRobotsIsModalOpen = (state: RootState) => state.voiceRobots.isModalOpen;
export const selectVoiceRobotsSelectedRobot = (state: RootState) => state.voiceRobots.selectedRobot;
export const selectVoiceRobotsIsLogModalOpen = (state: RootState) => state.voiceRobots.isLogModalOpen;
export const selectVoiceRobotsSelectedRobotIdForLogs = (state: RootState) => state.voiceRobots.selectedRobotIdForLogs;
