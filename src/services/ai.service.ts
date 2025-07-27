import OpenAI from 'openai';
import { config } from '../config';
import logger from '../utils/logger';
import { Product, Category } from './coffeeShopApi.service';

export interface Intent {
  type: 'greeting' | 'menu' | 'order' | 'product_info' | 'help' | 'cancel_order' | 'order_status' | 'unknown';
  confidence: number;
  entities?: {
    products?: string[];
    quantities?: number[];
    category?: string;
    orderId?: string;
  };
}

export interface OrderItem {
  productName: string;
  quantity: number;
}

export class AIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  async detectIntent(message: string, _context?: any): Promise<Intent> {
    try {
      const systemPrompt = `You are an AI assistant for a coffee shop. Analyze the customer's message and determine their intent. 
      Possible intents are:
      - greeting: Customer is greeting or saying hello
      - menu: Customer wants to see the menu or categories
      - order: Customer wants to place an order
      - product_info: Customer wants information about a specific product
      - help: Customer needs assistance or has questions
      - cancel_order: Customer wants to cancel an order
      - order_status: Customer wants to check order status
      - unknown: Cannot determine intent

      Also extract entities like product names, quantities, categories, or order IDs if mentioned.
      
      Respond in JSON format with the structure:
      {
        "type": "intent_type",
        "confidence": 0.0-1.0,
        "entities": {
          "products": ["product names"],
          "quantities": [numbers],
          "category": "category name",
          "orderId": "order id"
        }
      }`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result as Intent;
    } catch (error) {
      logger.error('Failed to detect intent:', error);
      return { type: 'unknown', confidence: 0 };
    }
  }

  async generateResponse(
    intent: Intent,
    context: {
      products?: Product[];
      categories?: Category[];
      orderStatus?: string;
      error?: string;
    }
  ): Promise<string> {
    try {
      const systemPrompt = `You are a friendly coffee shop assistant. Generate a natural, conversational response based on the intent and context provided. Keep responses concise and helpful. Use emojis appropriately.`;

      let userPrompt = `Intent: ${intent.type}\n`;

      switch (intent.type) {
        case 'greeting':
          userPrompt += 'Generate a friendly greeting and ask how you can help.';
          break;
        case 'menu':
          if (context.categories) {
            userPrompt += `List the available categories: ${context.categories.map(c => c.name).join(', ')}`;
          }
          break;
        case 'product_info':
          if (context.products && context.products.length > 0) {
            userPrompt += `Provide information about these products: ${JSON.stringify(context.products)}`;
          }
          break;
        case 'help':
          userPrompt += 'Provide helpful information about how to use the bot and place orders.';
          break;
        case 'order_status':
          userPrompt += `Order status: ${context.orderStatus || 'Unknown'}`;
          break;
        case 'unknown':
          userPrompt += 'Customer message was not understood. Ask for clarification politely.';
          break;
      }

      if (context.error) {
        userPrompt += `\nError occurred: ${context.error}`;
      }

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 150,
      });

      return response.choices[0].message.content || 'I apologize, but I couldn\'t generate a response. Please try again.';
    } catch (error) {
      logger.error('Failed to generate response:', error);
      return 'I apologize, but I\'m having trouble processing your request. Please try again later.';
    }
  }

  async parseOrderFromMessage(
    message: string,
    availableProducts: Product[]
  ): Promise<OrderItem[]> {
    try {
      const productList = availableProducts.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
      }));

      const systemPrompt = `You are parsing a coffee shop order. Extract the products and quantities from the customer's message.
      
      Available products:
      ${JSON.stringify(productList, null, 2)}
      
      Return a JSON array of ordered items with the structure:
      [
        {
          "productName": "exact product name from the list",
          "quantity": number
        }
      ]
      
      If no valid products are found, return an empty array.
      Match products flexibly (e.g., "latte" should match "Caffe Latte").`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0].message.content || '{"items":[]}');
      return result.items || [];
    } catch (error) {
      logger.error('Failed to parse order:', error);
      return [];
    }
  }

  async improveErrorMessage(error: string, context?: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Convert technical error messages into friendly, helpful messages for coffee shop customers. Use emojis and keep it conversational.',
          },
          {
            role: 'user',
            content: `Error: ${error}\nContext: ${context || 'General error'}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 100,
      });

      return response.choices[0].message.content || 'Oops! Something went wrong. Please try again.';
    } catch (err) {
      logger.error('Failed to improve error message:', err);
      return 'I apologize, but something went wrong. Please try again later.';
    }
  }
}

export default new AIService();