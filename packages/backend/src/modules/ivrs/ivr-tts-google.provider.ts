import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class IvrTtsGoogleProvider {
  private readonly logger = new Logger(IvrTtsGoogleProvider.name);

  async synthesize(
    token: string,
    text: string,
    settings: Record<string, any>,
  ): Promise<Buffer> {
    const languageCode = settings.language_code || 'ru-RU';
    const voiceName = settings.voice_name || 'ru-RU-Wavenet-A';
    const speakingRate = parseFloat(String(settings.speaking_rate ?? '1.0')) || 1.0;

    const response = await axios.post(
      'https://texttospeech.googleapis.com/v1/text:synthesize',
      {
        input: { text },
        voice: { languageCode, name: voiceName },
        audioConfig: {
          audioEncoding: 'LINEAR16',
          sampleRateHertz: 8000,
          speakingRate,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      },
    );

    const audioContent = response.data?.audioContent;
    if (!audioContent) {
      throw new Error('Google TTS returned empty audioContent');
    }

    return Buffer.from(audioContent, 'base64');
  }
}
