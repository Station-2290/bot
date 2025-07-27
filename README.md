# ☕ Station2290 WhatsApp Bot

A comprehensive WhatsApp Business chatbot for Station2290 coffee shop that enables customers to browse the menu, place orders, and receive assistance through natural language processing and voice message support. Part of the Station2290 microservices ecosystem.

## 🌟 Features

### 🤖 AI-Powered Conversation
- **Natural Language Processing**: Powered by OpenAI GPT for understanding customer intents
- **Voice Message Support**: Audio transcription using Google Cloud Speech-to-Text
- **Text-to-Speech**: Kokoro.js integration for voice responses (configurable)
- **Smart Order Processing**: Parse orders from natural language messages
- **Contextual Responses**: AI-generated responses based on conversation context
- **Audio Mode**: Optional voice responses for accessibility and enhanced UX

### 📱 WhatsApp Integration
- **WhatsApp Business API**: Full integration with webhook support
- **Interactive Messages**: Buttons and lists for easy navigation
- **Rich Media Support**: Text, voice messages, and interactive elements
- **Message Status Tracking**: Read receipts and delivery status

### 🛒 Order Management
- **Complete Order Flow**: From menu browsing to order confirmation
- **Shopping Cart**: Add, remove, and modify items
- **Customer Profiles**: Automatic customer creation and management
- **Order Tracking**: Real-time order status updates

### 🔄 State Management
- **XState Integration**: Robust state machine for conversation flow
- **Session Management**: Automatic cleanup of expired sessions
- **Error Recovery**: Graceful handling of errors and fallbacks

### 🎯 Menu & Product Management
- **Dynamic Menu Loading**: Real-time data from Coffee Shop API
- **Category Browsing**: Organized product categories
- **Product Search**: Find products by name or description
- **Promotions**: Special offers and featured products

## 🏗️ Architecture

### Technology Stack
- **Node.js** with TypeScript
- **Express.js** for webhook handling
- **OpenAI API** for natural language processing
- **Google Cloud Speech-to-Text** for voice transcription
- **Kokoro.js** for text-to-speech synthesis
- **XState** for state management
- **WhatsApp Business API** for messaging
- **OpenAPI-Fetch** for type-safe API calls

### Project Structure
```
bot/
├── src/
│   ├── config/           # Configuration management
│   ├── controllers/      # Webhook controllers
│   ├── models/          # Data models and state machines
│   ├── services/        # Business logic services
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Utility functions
├── __generated__/       # Auto-generated files
└── dist/               # Compiled JavaScript
```

## 🏗️ Station2290 Architecture

### Microservices Ecosystem

This WhatsApp bot is part of the Station2290 coffee shop management system:

- **Infrastructure**: [Station2290-Infrastructure](https://github.com/Station-2290/infrastructure)
- **API Backend**: [Station2290-API](https://github.com/Station-2290/api)
- **Customer Website**: [Station2290-Web](https://github.com/Station-2290/web)
- **WhatsApp Bot**: [Station2290-Bot](https://github.com/Station-2290/bot) (this repository)
- **Admin Panel**: [Station2290-Adminka](https://github.com/Station-2290/adminka)
- **Order Panel**: [Station2290-Order-Panel](https://github.com/Station-2290/order-panel)

### 🔄 Automatic Deployment

This bot **deploys automatically** when you push to the `main` branch:

1. **GitHub Actions** builds the Node.js application
2. **Creates** optimized Docker image with dependencies
3. **Deploys** to production VPS via SSH
4. **Health checks** ensure bot webhook is responding
5. **Session persistence** maintains customer conversations

**Production Webhook**: https://bot.station2290.ru

## 🚀 Quick Start

### Prerequisites

**For Local Development:**
- Node.js 18+
- pnpm package manager
- WhatsApp Business Account and API access
- OpenAI API Key
- Google Cloud account with Speech-to-Text API
- Access to Station2290 API (local or remote)

**For Production Deployment:**
- Infrastructure repository deployed on VPS
- GitHub Secrets configured for automated deployment
- WhatsApp Business API webhook configured

### Local Development Setup

1. **Clone the repository:**
```bash
git clone https://github.com/Station-2290/bot.git
cd bot
```

2. **Install dependencies:**
```bash
pnpm install
```

3. **Environment Setup:**
```bash
cp .env.example .env
# Edit .env with your local configuration
```

4. **Configure environment variables:**

**Local Development:**
```bash
# WhatsApp Business API
WHATSAPP_BUSINESS_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token

# Station2290 API
API_URL=http://localhost:3000/api/v1
COFFEE_SHOP_API_KEY=your_api_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Google Cloud
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json

# Kokoro TTS
TTS_ENABLED=true
TTS_MODEL_ID=onnx-community/Kokoro-82M-v1.0-ONNX
TTS_DTYPE=q8
TTS_DEVICE=cpu

# Server
PORT=3001
NODE_ENV=development
```

4. **Generate TypeScript types from OpenAPI**
```bash
pnpm run generate:types
```

5. **Start development server**
```bash
pnpm run dev
```

## 📡 Webhook Configuration

### WhatsApp Business API Setup

1. **Webhook URL**: `https://your-domain.com/webhook/whatsapp`
2. **Verify Token**: Set in your environment variables
3. **Webhook Events**: Subscribe to `messages` events

### Ngrok for Local Development
```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 3001

# Use the HTTPS URL for webhook configuration
```

## 🔧 Development

### Available Scripts
```bash
# Development
pnpm run dev              # Start with hot reload
pnpm run build            # Build TypeScript
pnpm run start            # Start production server

# Code Quality
pnpm run lint             # Run ESLint
pnpm run test             # Run tests

# Type Generation
pnpm run generate:types   # Generate types from OpenAPI
```

### API Integration

The bot automatically generates TypeScript types from the Coffee Shop API's OpenAPI specification:

```bash
# Fetch latest OpenAPI spec and generate types
curl http://localhost:3000/docs/api-json -o __schemas__/openapi.json
pnpm run generate:types
```

## 🤖 Conversation Flow

### State Machine States

1. **Idle**: Initial state, waiting for user interaction
2. **Greeting**: Welcome message and main menu
3. **Viewing Menu**: Category selection
4. **Selecting Products**: Product browsing and cart management
5. **Reviewing Cart**: Cart overview and checkout initiation
6. **Checkout**: Customer info collection and order confirmation
7. **Order Completed**: Order confirmation and next actions

### Supported Commands

- **"start"** or **"hello"**: Begin conversation
- **"menu"**: View categories
- **"cart"**: View shopping cart
- **"reset"**: Reset conversation state
- **"speak"** or **"audio response"**: Request voice response
- **"audio mode"**: Enable audio responses
- **Natural language orders**: "I want 2 lattes and 1 cappuccino"
- **Voice messages**: Send voice messages for transcription

## 🎯 Features Deep Dive

### AI-Powered Intent Recognition

The bot uses OpenAI's GPT models to understand customer messages:

```typescript
// Example intent detection
const intent = await aiService.detectIntent(message, context);
// Returns: { type: 'order', entities: { products: ['latte'], quantities: [2] } }
```

### Voice Message Processing

Customers can send voice messages that are automatically transcribed:

```typescript
// Audio transcription flow
const audioBuffer = await whatsappService.downloadMedia(mediaId);
const transcription = await transcriptionService.transcribeAudio(audioBuffer, mimeType);
```

### State Management with XState

Robust conversation state management using XState:

```typescript
// State machine handles complex conversation flows
const actor = conversationStateMachine.getOrCreateActor(userId, services);
actor.send({ type: 'ADD_TO_CART', product, quantity });
```

## 🐳 Docker Deployment

### Build and Run
```bash
# Build Docker image
docker build -t coffee-shop-bot .

# Run container
docker run -d \
  --name coffee-shop-bot \
  -p 3001:3001 \
  --env-file .env \
  coffee-shop-bot
```

### Docker Compose Integration
```yaml
# Add to your docker-compose.yml
coffee-shop-bot:
  build: ./bot
  container_name: coffee-shop-bot
  ports:
    - "3001:3001"
  environment:
    - COFFEE_SHOP_API_URL=http://api:3000/api/v1
  env_file:
    - ./bot/.env
  depends_on:
    - api
```

## 🔒 Security Features

- **Input Validation**: All user inputs are validated and sanitized
- **Rate Limiting**: Protection against spam and abuse
- **Webhook Verification**: Validates WhatsApp webhook signatures
- **API Key Management**: Secure API communication
- **Error Handling**: Graceful error recovery without exposing internals

## 📊 Monitoring & Logging

### Structured Logging
```bash
# View logs
tail -f combined.log

# Error logs only
tail -f error.log
```

### Health Check Endpoint
```bash
# Check bot health
curl http://localhost:3001/health
```

## 🔧 Troubleshooting

### Common Issues

1. **Webhook not receiving messages**
   - Verify webhook URL is publicly accessible
   - Check webhook verification token
   - Ensure SSL certificate is valid

2. **OpenAI API errors**
   - Verify API key is correct
   - Check API quota and billing
   - Review rate limits

3. **Google Cloud Speech errors**
   - Verify service account credentials
   - Check API enablement
   - Review audio format compatibility

4. **Coffee Shop API connection**
   - Ensure API is running and accessible
   - Verify API key is valid
   - Check network connectivity

### Debug Mode
```bash
# Enable debug logging
LOG_LEVEL=debug pnpm run dev
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting and tests
6. Submit a pull request

## 📝 License

This project is private and proprietary.

---

**Need Help?** Check the logs or contact the development team for support.

## 🔮 Future Enhancements

- [ ] Multi-language support
- [ ] Payment integration
- [ ] Order tracking with real-time updates
- [ ] Customer loyalty program
- [ ] Analytics and reporting
- [ ] Telegram bot integration
- [ ] Rich media product catalogs
- [ ] Location-based services