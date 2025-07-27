import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import logger from '../utils/logger';
import * as fs from 'fs/promises';
import FormData from 'form-data';

export interface WhatsAppMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'interactive';
  text?: {
    body: string;
    preview_url?: boolean;
  };
  audio?: {
    id: string;
  };
  interactive?: {
    type: 'button' | 'list';
    header?: {
      type: 'text' | 'image' | 'video' | 'document';
      text?: string;
    };
    body: {
      text: string;
    };
    footer?: {
      text: string;
    };
    action: any;
  };
}

export interface IncomingMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'audio' | 'image' | 'document' | 'video' | 'location' | 'interactive';
  text?: {
    body: string;
  };
  audio?: {
    id: string;
    mime_type: string;
  };
  interactive?: {
    type: string;
    button_reply?: {
      id: string;
      title: string;
    };
    list_reply?: {
      id: string;
      title: string;
    };
  };
}

export class WhatsAppService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: config.whatsapp.businessApiUrl,
      headers: {
        'Authorization': `Bearer ${config.whatsapp.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async sendMessage(to: string, message: Partial<WhatsAppMessage>): Promise<void> {
    try {
      const payload: WhatsAppMessage = {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        ...message,
      };

      await this.api.post(`/${config.whatsapp.phoneNumberId}/messages`, payload);
      logger.info(`Message sent to ${to}`);
    } catch (error) {
      logger.error('Failed to send WhatsApp message:', error);
      throw error;
    }
  }

  async sendTextMessage(to: string, text: string): Promise<void> {
    await this.sendMessage(to, {
      type: 'text',
      text: { body: text },
    });
  }

  async sendInteractiveButtons(
    to: string,
    body: string,
    buttons: Array<{ id: string; title: string }>,
    header?: string,
    footer?: string
  ): Promise<void> {
    await this.sendMessage(to, {
      type: 'interactive',
      interactive: {
        type: 'button',
        header: header ? { type: 'text', text: header } : undefined,
        body: { text: body },
        footer: footer ? { text: footer } : undefined,
        action: {
          buttons: buttons.map(btn => ({
            type: 'reply',
            reply: btn,
          })),
        },
      },
    });
  }

  async sendInteractiveList(
    to: string,
    body: string,
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>,
    buttonText: string,
    header?: string,
    footer?: string
  ): Promise<void> {
    await this.sendMessage(to, {
      type: 'interactive',
      interactive: {
        type: 'list',
        header: header ? { type: 'text', text: header } : undefined,
        body: { text: body },
        footer: footer ? { text: footer } : undefined,
        action: {
          button: buttonText,
          sections,
        },
      },
    });
  }

  async markAsRead(messageId: string): Promise<void> {
    try {
      await this.api.post(`/${config.whatsapp.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      });
    } catch (error) {
      logger.error('Failed to mark message as read:', error);
    }
  }

  async downloadMedia(mediaId: string): Promise<Buffer> {
    try {
      const response = await this.api.get(`/${mediaId}`, {
        responseType: 'arraybuffer',
      });
      return Buffer.from(response.data);
    } catch (error) {
      logger.error('Failed to download media:', error);
      throw error;
    }
  }

  async sendAudioMessage(to: string, audioFilePath: string): Promise<void> {
    try {
      // First, upload the audio file to WhatsApp
      const mediaId = await this.uploadMedia(audioFilePath, 'audio/wav');
      
      // Then send the audio message
      await this.sendMessage(to, {
        type: 'audio',
        audio: { id: mediaId }
      });
      
      logger.info(`Audio message sent to ${to}`);
    } catch (error) {
      logger.error('Failed to send audio message:', error);
      throw error;
    }
  }

  private async uploadMedia(filePath: string, mimeType: string): Promise<string> {
    try {
      const formData = new FormData();
      const fileBuffer = await fs.readFile(filePath);
      
      formData.append('file', fileBuffer, {
        filename: 'audio.wav',
        contentType: mimeType,
      });
      formData.append('type', mimeType);
      formData.append('messaging_product', 'whatsapp');

      const response = await axios.post(
        `${config.whatsapp.businessApiUrl}/${config.whatsapp.phoneNumberId}/media`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${config.whatsapp.accessToken}`,
            ...formData.getHeaders(),
          },
        }
      );

      return response.data.id;
    } catch (error) {
      logger.error('Failed to upload media:', error);
      throw error;
    }
  }
}

export default new WhatsAppService();