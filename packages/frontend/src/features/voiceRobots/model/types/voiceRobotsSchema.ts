import { IVoiceRobot } from '@/entities/voiceRobot';

export interface VoiceRobotsSchema {
  isModalOpen: boolean;
  selectedRobot: IVoiceRobot | null;
  isLogModalOpen: boolean;
  selectedRobotIdForLogs: number | null;
}
