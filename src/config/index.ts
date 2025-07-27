import dotenv from 'dotenv';

dotenv.config();

export const config = {
  whatsapp: {
    businessApiUrl: process.env.WHATSAPP_BUSINESS_API_URL || 'https://graph.facebook.com/v18.0',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
  },
  coffeeShopApi: {
    url: process.env.COFFEE_SHOP_API_URL || 'http://localhost:3000/api/v1',
    apiKey: process.env.COFFEE_SHOP_API_KEY || '',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  google: {
    credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
  },
  tts: {
    enabled: process.env.TTS_ENABLED === 'true',
    modelId: process.env.TTS_MODEL_ID || 'onnx-community/Kokoro-82M-v1.0-ONNX',
    dtype: process.env.TTS_DTYPE || 'q8',
    device: process.env.TTS_DEVICE || 'cpu',
  },
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};