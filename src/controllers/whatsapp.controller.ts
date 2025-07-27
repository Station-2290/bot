import { Request, Response } from 'express';
import { config } from '../config';
import logger from '../utils/logger';
import whatsappService, { IncomingMessage } from '../services/whatsapp.service';
import messageHandler from '../services/messageHandler.service';

export class WhatsAppController {
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { entry } = req.body;

      if (!entry || !entry[0] || !entry[0].changes || !entry[0].changes[0]) {
        res.sendStatus(200);
        return;
      }

      const change = entry[0].changes[0];
      const value = change.value;

      if (value.messages && value.messages[0]) {
        const message = value.messages[0];
        const from = message.from;

        // Mark message as read
        await whatsappService.markAsRead(message.id);

        // Process the message
        const incomingMessage: IncomingMessage = {
          from,
          id: message.id,
          timestamp: message.timestamp,
          type: message.type,
          text: message.text,
          audio: message.audio,
          interactive: message.interactive,
        };

        await messageHandler.handleMessage(incomingMessage);
      }

      res.sendStatus(200);
    } catch (error) {
      logger.error('Error in handling WhatsApp webhook:', error);
      res.sendStatus(500);
    }
  }

  async verifyWebhook(req: Request, res: Response): Promise<void> {
    try {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      if (mode === 'subscribe' && token === config.whatsapp.webhookVerifyToken) {
        logger.info('WhatsApp webhook verified successfully');
        res.status(200).send(challenge);
      } else {
        logger.warn('WhatsApp webhook verification failed');
        res.sendStatus(403);
      }
    } catch (error) {
      logger.error('Error verifying WhatsApp webhook:', error);
      res.sendStatus(500);
    }
  }
}

export default new WhatsAppController();