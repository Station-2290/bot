import express from 'express';
import { config } from './config';
import logger from './utils/logger';
import whatsappController from './controllers/whatsapp.controller';
import conversationManager from './models/conversation.model';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'coffee-shop-bot',
    timestamp: new Date().toISOString(),
  });
});

// WhatsApp webhook endpoints
app.post('/webhook/whatsapp', whatsappController.handleWebhook.bind(whatsappController));
app.get('/webhook/whatsapp', whatsappController.verifyWebhook.bind(whatsappController));

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = config.server.port;
app.listen(PORT, () => {
  logger.info(`Coffee Shop Bot server running on port ${PORT}`);
  logger.info(`Environment: ${config.server.nodeEnv}`);
  
  // Setup periodic cleanup of expired conversations
  setInterval(() => {
    conversationManager.cleanupExpiredSessions();
  }, 5 * 60 * 1000); // Every 5 minutes
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});