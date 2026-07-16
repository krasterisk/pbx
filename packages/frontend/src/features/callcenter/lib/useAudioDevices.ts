import { useCallback, useEffect, useState } from 'react';

export interface UseAudioDevicesResult {
  microphones: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
  selectedMic: string;
  setSelectedMic: (deviceId: string) => void;
  selectedSpeaker: string;
  setSelectedSpeaker: (deviceId: string) => void;
  refresh: () => Promise<void>;
}

/**
 * Enumerate mic/speaker devices and keep selection in sync with devicechange.
 * Labels are often empty until getUserMedia has been granted.
 */
export function useAudioDevices(): UseAudioDevicesResult {
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState('default');
  const [selectedSpeaker, setSelectedSpeaker] = useState('default');

  const refresh = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setMicrophones([]);
      setSpeakers([]);
      return;
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    const mics = devices.filter((d) => d.kind === 'audioinput');
    const outs = devices.filter((d) => d.kind === 'audiooutput');
    setMicrophones(mics);
    setSpeakers(outs);
  }, []);

  useEffect(() => {
    void refresh();
    const onChange = () => {
      void refresh();
    };
    navigator.mediaDevices?.addEventListener?.('devicechange', onChange);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', onChange);
    };
  }, [refresh]);

  return {
    microphones,
    speakers,
    selectedMic,
    setSelectedMic,
    selectedSpeaker,
    setSelectedSpeaker,
    refresh,
  };
}

/** Fallback label when enumerateDevices returns empty label (pre-permission). */
export function audioDeviceLabel(device: MediaDeviceInfo, index: number, kind: 'mic' | 'speaker'): string {
  if (device.label?.trim()) return device.label;
  return kind === 'mic' ? `Microphone ${index + 1}` : `Speaker ${index + 1}`;
}
