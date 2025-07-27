import express, { Router } from 'express';

const router: Router = express.Router();

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    whatsapp: 'connected' | 'disconnected' | 'initializing';
    api: 'connected' | 'disconnected';
    openai: 'connected' | 'disconnected';
  };
  version: string;
}

// Basic health check
router.get('/health', (req, res) => {
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      whatsapp: 'connected', // This should be checked from actual WhatsApp client status
      api: 'connected', // This should be checked from actual API connectivity
      openai: 'connected' // This should be checked from actual OpenAI connectivity
    },
    version: process.env.npm_package_version || '1.0.0'
  };

  res.status(200).json(health);
});

// Detailed health check
router.get('/health/detailed', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    services: {
      whatsapp: {
        status: 'connected',
        lastActivity: new Date().toISOString(),
      },
      api: {
        status: 'connected',
        lastRequest: new Date().toISOString(),
      },
      openai: {
        status: 'connected',
        lastRequest: new Date().toISOString(),
      }
    },
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  };

  res.status(200).json(health);
});

export default router;