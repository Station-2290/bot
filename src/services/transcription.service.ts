import { SpeechClient } from '@google-cloud/speech';
import { config } from '../config';
import logger from '../utils/logger';
import whatsappService from './whatsapp.service';

export class TranscriptionService {
  private client: SpeechClient;

  constructor() {
    if (config.google.credentialsPath) {
      this.client = new SpeechClient({
        keyFilename: config.google.credentialsPath,
      });
    } else {
      this.client = new SpeechClient();
    }
  }

  async transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
    try {
      const audio = {
        content: audioBuffer.toString('base64'),
      };

      const config = {
        encoding: this.getAudioEncoding(mimeType),
        sampleRateHertz: 16000,
        languageCode: 'en-US',
        alternativeLanguageCodes: ['es-ES', 'pt-BR'],
        enableAutomaticPunctuation: true,
        model: 'latest_long',
      };

      const request = {
        audio,
        config,
      };

      const [response] = await this.client.recognize(request as any);
      const transcription = response.results
        ?.map((result: any) => result.alternatives?.[0]?.transcript)
        .join(' ');

      return transcription || '';
    } catch (error) {
      logger.error('Failed to transcribe audio:', error);
      throw error;
    }
  }

  async transcribeWhatsAppAudio(mediaId: string, mimeType: string): Promise<string> {
    try {
      const audioBuffer = await whatsappService.downloadMedia(mediaId);
      return await this.transcribeAudio(audioBuffer, mimeType);
    } catch (error) {
      logger.error('Failed to transcribe WhatsApp audio:', error);
      throw error;
    }
  }

  private getAudioEncoding(mimeType: string): any {
    const encodingMap: Record<string, any> = {
      'audio/amr': 'AMR',
      'audio/amr-wb': 'AMR_WB',
      'audio/mpeg': 'MP3',
      'audio/ogg': 'OGG_OPUS',
      'audio/opus': 'OGG_OPUS',
      'audio/wav': 'LINEAR16',
    };

    return encodingMap[mimeType.toLowerCase()] || 'ENCODING_UNSPECIFIED';
  }
}

export default new TranscriptionService();