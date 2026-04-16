import { IVoiceRobot } from '@/entities/voiceRobot';

export interface VoiceRobotsSchema {
  isLogModalOpen: boolean;
  selectedRobotIdForLogs: number | null;
}
