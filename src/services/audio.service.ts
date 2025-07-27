import { SpeechClient } from '@google-cloud/speech';
import { config } from '../config';
import logger from '../utils/logger';
import whatsappService from './whatsapp.service';
import * as fs from 'fs/promises';
import * as path from 'path';

export class AudioService {
  private speechClient: SpeechClient;
  private ttsAvailable: boolean = false;
  private kokoroTTS: any | null = null;
  private isInitializing: boolean = false;

  constructor() {
    // Initialize Google Cloud Speech client for speech-to-text
    if (config.google.credentialsPath) {
      this.speechClient = new SpeechClient({
        keyFilename: config.google.credentialsPath,
      });
    } else {
      this.speechClient = new SpeechClient();
    }

    // Initialize TTS when enabled
    if (config.tts.enabled) {
      this.initializeTTS();
    }
  }

  private async initializeTTS(): Promise<void> {
    if (this.isInitializing || this.kokoroTTS) {
      return;
    }

    this.isInitializing = true;
    
    try {
      logger.info('Initializing Kokoro TTS...');
      
      // @ts-ignore
      const { KokoroTTS } = await import('kokoro-js');
      
      this.kokoroTTS = await KokoroTTS.from_pretrained(config.tts.modelId, {
        dtype: config.tts.dtype as 'fp32' | 'fp16' | 'q8' | 'q4' | 'q4f16',
        device: config.tts.device as 'cpu' | 'wasm' | 'webgpu',
        progress_callback: (progress: any) => {
          if (progress.status === 'progress') {
            logger.info(`Model loading progress: ${Math.round(progress.loaded! / progress.total! * 100)}%`);
          }
        }
      });
      
      this.ttsAvailable = true;
      logger.info('Kokoro TTS initialized successfully');
      
      // Log available voices
      const voices = Object.keys(this.kokoroTTS.voices);
      logger.info(`Available voices: ${voices.slice(0, 5).join(', ')}${voices.length > 5 ? ' and more...' : ''}`);
      
    } catch (error) {
      logger.error('Failed to initialize Kokoro TTS:', error);
      this.ttsAvailable = false;
      this.kokoroTTS = null;
    } finally {
      this.isInitializing = false;
    }
  }

  // Speech-to-Text functionality
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

      const [response] = await this.speechClient.recognize(request as any);
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

  async synthesizeSpeech(text: string, voice: string = 'af_heart'): Promise<string> {
    if (!this.ttsAvailable || !this.kokoroTTS) {
      throw new Error('TTS not available - initialization failed or pending');
    }

    try {
      logger.info(`Generating speech for text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" using voice: ${voice}`);
      
      // Validate voice exists
      const availableVoices = Object.keys(this.kokoroTTS.voices);
      if (!availableVoices.includes(voice)) {
        logger.warn(`Voice '${voice}' not available, using default 'af_heart'`);
        voice = 'af_heart';
      }
      
      const audio = await this.kokoroTTS.generate(text, {
        voice: voice as keyof typeof this.kokoroTTS.voices,
        speed: 1.0
      });
      
      // Save to temporary file and return the path
      const tempDir = path.join(process.cwd(), 'temp');
      await fs.mkdir(tempDir, { recursive: true });
      
      const audioFileName = `tts_${Date.now()}_${Math.random().toString(36).substring(7)}.wav`;
      const audioFilePath = path.join(tempDir, audioFileName);
      
      await audio.save(audioFilePath);
      logger.info(`Generated audio saved to: ${audioFilePath}`);
      
      return audioFilePath;
    } catch (error) {
      logger.error('Failed to synthesize speech:', error);
      throw error;
    }
  }

  async sendSynthesizedSpeech(userId: string, text: string, voice?: string): Promise<void> {
    try {
      if (!this.ttsAvailable) {
        logger.info('TTS not available, sending text message instead');
        await whatsappService.sendTextMessage(
          userId,
          `🔊 [Audio would be generated]: ${text}`
        );
        return;
      }

      // Generate audio and get file path
      const audioFilePath = await this.synthesizeSpeech(text, voice);
      
      try {
        // Send audio via WhatsApp
        await whatsappService.sendAudioMessage(userId, audioFilePath);
        logger.info(`Sent TTS audio to user ${userId}`);
      } finally {
        // Clean up temporary file
        try {
          await fs.unlink(audioFilePath);
        } catch (cleanupError) {
          logger.warn('Failed to cleanup temporary audio file:', cleanupError);
        }
      }
      
    } catch (error) {
      logger.error('Failed to send synthesized speech:', error);
      await whatsappService.sendTextMessage(
        userId,
        `Sorry, audio generation failed. Here's the message: ${text}`
      );
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

  async isTTSAvailable(): Promise<boolean> {
    return this.ttsAvailable;
  }

  getTTSModelInfo(): { modelId: string; loaded: boolean; enabled: boolean; availableVoices?: string[] } {
    return {
      modelId: config.tts.modelId,
      loaded: this.ttsAvailable,
      enabled: config.tts.enabled,
      availableVoices: this.kokoroTTS ? Object.keys(this.kokoroTTS.voices) : undefined,
    };
  }

  getAvailableVoices(): string[] {
    if (!this.kokoroTTS) {
      return [];
    }
    return Object.keys(this.kokoroTTS.voices);
  }

  getVoiceInfo(voiceName: string) {
    if (!this.kokoroTTS) {
      return null;
    }
    return this.kokoroTTS.voices[voiceName as keyof typeof this.kokoroTTS.voices] || null;
  }

  async ensureTTSInitialized(): Promise<boolean> {
    if (!config.tts.enabled) {
      return false;
    }
    
    if (!this.kokoroTTS && !this.isInitializing) {
      await this.initializeTTS();
    }
    
    return this.ttsAvailable;
  }
}

export default new AudioService();