import { IncomingMessage } from './whatsapp.service';
import whatsappService from './whatsapp.service';
import aiService from './ai.service';
import audioService from './audio.service';
import coffeeShopApi from './coffeeShopApi.service';
import conversationStateMachine from '../models/conversationMachine';
import logger from '../utils/logger';

export class MessageHandlerService {
  private services = {
    createCustomer: async ({ input }: { input: any }) => {
      const { userId, customerInfo } = input;
      try {
        const customer = await coffeeShopApi.createCustomer({
          email: customerInfo.email,
          first_name: customerInfo.firstName,
          last_name: customerInfo.lastName,
          phone: userId,
        });
        return customer;
      } catch (error) {
        throw error;
      }
    },
    placeOrder: async ({ input }: { input: any }) => {
      const { customer, cart } = input;
      try {
        const orderData = {
          customer_id: customer?.id,
          items: cart.map((item: any) => ({
            product_id: item.product.id,
            quantity: item.quantity,
          })),
        };
        const order = await coffeeShopApi.createOrder(orderData);
        return order;
      } catch (error) {
        throw error;
      }
    },
  };

  async handleMessage(message: IncomingMessage): Promise<void> {
    try {
      const userId = message.from;
      let messageText = '';

      // Handle different message types
      if (message.type === 'text' && message.text) {
        messageText = message.text.body;
      } else if (message.type === 'audio' && message.audio) {
        await whatsappService.sendTextMessage(userId, '🎵 Processing your voice message...');
        messageText = await audioService.transcribeWhatsAppAudio(
          message.audio.id,
          message.audio.mime_type
        );
      } else if (message.type === 'interactive') {
        messageText = await this.handleInteractiveMessage(message);
      } else {
        await whatsappService.sendTextMessage(
          userId,
          'Sorry, I can only process text and voice messages at the moment. 😊'
        );
        return;
      }

      // Process the message with state machine
      await this.processMessageWithStateMachine(userId, messageText);
    } catch (error) {
      logger.error('Error handling message:', error);
      const userId = message.from;
      await whatsappService.sendTextMessage(
        userId,
        'I apologize, but I encountered an error processing your message. Please try again later. 🙏'
      );
    }
  }

  private async handleInteractiveMessage(message: IncomingMessage): Promise<string> {
    if (message.interactive?.button_reply) {
      return message.interactive.button_reply.id;
    } else if (message.interactive?.list_reply) {
      return message.interactive.list_reply.id;
    }
    return '';
  }

  private async processMessageWithStateMachine(userId: string, messageText: string): Promise<void> {
    const actor = conversationStateMachine.getOrCreateActor(userId, this.services);
    const snapshot = actor.getSnapshot();
    const { value: currentState, context } = snapshot;

    // Detect intent
    const intent = await aiService.detectIntent(messageText, { state: currentState, context });

    // Handle special commands
    if (messageText.toLowerCase() === 'reset' || messageText.toLowerCase() === 'start over') {
      actor.send({ type: 'RESET' });
      await whatsappService.sendTextMessage(userId, '🔄 Starting over! How can I help you today?');
      await this.showMainMenu(userId);
      return;
    }

    // Handle audio response requests
    if (messageText.toLowerCase().includes('speak') || messageText.toLowerCase().includes('audio response')) {
      const response = await aiService.generateResponse(intent, {});
      await audioService.sendSynthesizedSpeech(userId, response);
      return;
    }

    // Route based on current state
    switch (true) {
      case currentState === 'idle':
        await this.handleIdleState(actor, userId, messageText, intent);
        break;

      case currentState === 'greeting':
        await this.handleGreetingState(actor, userId, messageText, intent);
        break;

      case currentState === 'viewingMenu':
        await this.handleViewingMenuState(actor, userId, messageText, intent);
        break;

      case currentState === 'selectingProducts':
        await this.handleSelectingProductsState(actor, userId, messageText, intent);
        break;

      case currentState === 'reviewingCart':
        await this.handleReviewingCartState(actor, userId, messageText);
        break;

      case currentState === 'checkout.collectingName':
        await this.handleCollectingNameState(actor, userId, messageText);
        break;

      case currentState === 'checkout.collectingEmail':
        await this.handleCollectingEmailState(actor, userId, messageText);
        break;

      case currentState === 'checkout.confirmingOrder':
        await this.handleConfirmingOrderState(actor, userId, messageText);
        break;

      case currentState === 'orderCompleted':
        await this.handleOrderCompletedState(actor, userId, messageText, intent);
        break;

      default:
        await this.handleDefaultState(userId, intent);
    }
  }

  private async handleIdleState(actor: any, userId: string, messageText: string, intent: any): Promise<void> {
    if (intent.type === 'greeting' || messageText === 'start') {
      actor.send({ type: 'START' });
      await whatsappService.sendTextMessage(
        userId,
        '☕ Welcome to Coffee Shop! I\'m here to help you place your order.\n\nHow can I assist you today?'
      );
      await this.showMainMenu(userId);
    } else if (intent.type === 'menu' || messageText === 'view_menu') {
      actor.send({ type: 'VIEW_MENU' });
      await this.showCategories(userId);
    } else {
      await this.handleDefaultState(userId, intent);
    }
  }

  private async handleGreetingState(actor: any, userId: string, messageText: string, intent: any): Promise<void> {
    if (messageText === 'view_menu' || intent.type === 'menu') {
      actor.send({ type: 'VIEW_MENU' });
      await this.showCategories(userId);
    } else if (messageText === 'view_promotions') {
      await this.showPromotedProducts(userId);
    } else if (messageText === 'audio_mode') {
      await this.handleAudioModeToggle(userId);
    } else if (intent.type === 'order' && intent.entities?.products) {
      await this.processNaturalOrderRequest(actor, userId, messageText);
    } else {
      await this.showMainMenu(userId);
    }
  }

  private async handleViewingMenuState(actor: any, userId: string, messageText: string, _intent: any): Promise<void> {
    if (messageText.startsWith('category_')) {
      const categoryId = parseInt(messageText.replace('category_', ''));
      actor.send({ type: 'SELECT_CATEGORY', categoryId });
      await this.showProducts(userId, categoryId);
    } else if (messageText === 'view_cart') {
      actor.send({ type: 'VIEW_CART' });
      await this.showCart(actor, userId);
    } else if (messageText === 'back' || messageText === 'main_menu') {
      actor.send({ type: 'BACK' });
      await this.showMainMenu(userId);
    } else {
      await this.showCategories(userId);
    }
  }

  private async handleSelectingProductsState(actor: any, userId: string, messageText: string, intent: any): Promise<void> {
    if (messageText.startsWith('product_')) {
      const productId = parseInt(messageText.replace('product_', ''));
      const product = await coffeeShopApi.getProduct(productId);
      actor.send({ type: 'ADD_TO_CART', product, quantity: 1 });
      
      await whatsappService.sendTextMessage(
        userId,
        `✅ Added ${product.name} to your cart!\n\nWould you like to add more items?`
      );
      
      await whatsappService.sendInteractiveButtons(
        userId,
        'What would you like to do next?',
        [
          { id: 'back_to_menu', title: '📱 Continue Shopping' },
          { id: 'view_cart', title: '🛒 View Cart' },
          { id: 'checkout', title: '💳 Checkout' },
        ]
      );
    } else if (messageText === 'view_cart') {
      actor.send({ type: 'VIEW_CART' });
      await this.showCart(actor, userId);
    } else if (messageText === 'back_to_menu') {
      actor.send({ type: 'VIEW_MENU' });
      await this.showCategories(userId);
    } else if (messageText === 'checkout') {
      actor.send({ type: 'CHECKOUT' });
      await this.handleCheckoutState(actor, userId);
    } else if (intent.type === 'order' && intent.entities?.products) {
      await this.processNaturalOrderRequest(actor, userId, messageText);
    } else {
      const snapshot = actor.getSnapshot();
      if (snapshot.context.selectedCategory) {
        await this.showProducts(userId, snapshot.context.selectedCategory);
      } else {
        await this.showCategories(userId);
      }
    }
  }

  private async handleReviewingCartState(actor: any, userId: string, action: string): Promise<void> {
    switch (action) {
      case 'checkout':
        actor.send({ type: 'CHECKOUT' });
        await this.handleCheckoutState(actor, userId);
        break;
      case 'back_to_menu':
        actor.send({ type: 'VIEW_MENU' });
        await this.showCategories(userId);
        break;
      case 'clear_cart':
        actor.send({ type: 'CLEAR_CART' });
        await whatsappService.sendTextMessage(userId, '🗑️ Cart cleared!');
        await this.showCategories(userId);
        break;
      default:
        await this.showCart(actor, userId);
    }
  }

  private async handleCheckoutState(actor: any, userId: string): Promise<void> {

    // Check if we already have customer
    const customer = await coffeeShopApi.getCustomerByPhone(userId);
    
    if (customer) {
      actor.send({ type: 'CUSTOMER_FOUND', customer });
      await this.confirmOrder(actor, userId);
    } else {
      await whatsappService.sendTextMessage(
        userId,
        'I need a few details to complete your order.\n\nWhat\'s your first name?'
      );
    }
  }

  private async handleCollectingNameState(actor: any, userId: string, input: string): Promise<void> {
    const names = input.trim().split(' ');
    const firstName = names[0];
    const lastName = names.slice(1).join(' ') || names[0];
    
    actor.send({ type: 'PROVIDE_NAME', firstName, lastName });
    
    await whatsappService.sendTextMessage(
      userId,
      `Thanks ${firstName}! What\'s your email address?`
    );
  }

  private async handleCollectingEmailState(actor: any, userId: string, input: string): Promise<void> {
    const email = input.trim();
    
    // Basic email validation
    if (!email.includes('@') || !email.includes('.')) {
      await whatsappService.sendTextMessage(
        userId,
        'Please provide a valid email address.'
      );
      return;
    }
    
    actor.send({ type: 'PROVIDE_EMAIL', email });
    
    // The state machine will handle customer creation
    await whatsappService.sendTextMessage(
      userId,
      'Creating your customer profile...'
    );
  }

  private async handleConfirmingOrderState(actor: any, userId: string, action: string): Promise<void> {
    if (action === 'confirm_order') {
      actor.send({ type: 'CONFIRM_ORDER' });
      await whatsappService.sendTextMessage(userId, '⏳ Placing your order...');
    } else if (action === 'cancel_order') {
      actor.send({ type: 'CANCEL_ORDER' });
      await whatsappService.sendTextMessage(
        userId,
        'Order cancelled. Your cart has been saved.'
      );
      await this.showCart(actor, userId);
    } else {
      await this.confirmOrder(actor, userId);
    }
  }

  private async handleOrderCompletedState(actor: any, userId: string, messageText: string, _intent: any): Promise<void> {
    const snapshot = actor.getSnapshot();
    const { pendingOrder } = snapshot.context;

    if (messageText === 'new_order') {
      actor.send({ type: 'START' });
      await this.showMainMenu(userId);
    } else if (messageText === 'order_status' && pendingOrder) {
      await whatsappService.sendTextMessage(
        userId,
        `📊 Order ${pendingOrder.order_number}\nStatus: ${pendingOrder.status}\nTotal: $${pendingOrder.total_amount.toFixed(2)}`
      );
    } else {
      await whatsappService.sendInteractiveButtons(
        userId,
        'What would you like to do next?',
        [
          { id: 'new_order', title: '🛒 New Order' },
          { id: 'order_status', title: '📊 Order Status' },
          { id: 'help', title: '❓ Help' },
        ]
      );
    }
  }

  private async showMainMenu(userId: string, enableAudio: boolean = false): Promise<void> {
    const menuText = 'Would you like to view our menu, see promotions, or check your cart?';
    
    if (enableAudio) {
      // Send both interactive buttons and audio
      await audioService.sendSynthesizedSpeech(userId, `Welcome to Coffee Shop! ${menuText}`);
    }
    
    await whatsappService.sendInteractiveButtons(
      userId,
      'Would you like to:',
      [
        { id: 'view_menu', title: '📱 View Menu' },
        { id: 'view_promotions', title: '🎉 See Promotions' },
        { id: 'view_cart', title: '🛒 View Cart' },
        { id: 'audio_mode', title: '🔊 Enable Audio Responses' },
      ],
      'Get Started'
    );
  }

  private async showCategories(userId: string): Promise<void> {
    try {
      const categories = await coffeeShopApi.getCategories();
      
      if (categories.length === 0) {
        await whatsappService.sendTextMessage(userId, 'Sorry, no categories available at the moment.');
        return;
      }

      const sections = [{
        title: 'Categories',
        rows: categories.map(cat => ({
          id: `category_${cat.id}`,
          title: cat.name,
          description: cat.description ? String(cat.description) : undefined,
        })),
      }];

      await whatsappService.sendInteractiveList(
        userId,
        'Please select a category to view our products:',
        sections,
        'View Categories',
        '☕ Our Menu'
      );
    } catch (error) {
      logger.error('Error showing categories:', error);
      await whatsappService.sendTextMessage(
        userId,
        'Sorry, I couldn\'t load the menu categories. Please try again later.'
      );
    }
  }

  private async showProducts(userId: string, categoryId: number): Promise<void> {
    try {
      const products = await coffeeShopApi.getProducts(categoryId);
      
      if (products.length === 0) {
        await whatsappService.sendTextMessage(userId, 'Sorry, no products available in this category.');
        return;
      }

      const sections = [{
        title: 'Products',
        rows: products.map(product => ({
          id: `product_${product.id}`,
          title: product.name,
          description: `$${product.price.toFixed(2)} - ${product.description || 'No description'}`,
        })),
      }];

      await whatsappService.sendInteractiveList(
        userId,
        'Select a product to add to your cart:',
        sections,
        'View Products',
        '📋 Products'
      );

      await whatsappService.sendInteractiveButtons(
        userId,
        'Navigation:',
        [
          { id: 'back_to_menu', title: '⬅️ Back to Menu' },
          { id: 'view_cart', title: '🛒 View Cart' },
        ]
      );
    } catch (error) {
      logger.error('Error showing products:', error);
      await whatsappService.sendTextMessage(
        userId,
        'Sorry, I couldn\'t load the products. Please try again later.'
      );
    }
  }

  private async showPromotedProducts(userId: string): Promise<void> {
    try {
      const products = await coffeeShopApi.getPromotedProducts();
      
      if (products.length === 0) {
        await whatsappService.sendTextMessage(userId, 'No special promotions available at the moment.');
        return;
      }

      const sections = [{
        title: '🎉 Special Offers',
        rows: products.map(product => ({
          id: `product_${product.id}`,
          title: `⭐ ${product.name}`,
          description: `$${product.price.toFixed(2)} - ${product.description || 'Special offer!'}`,
        })),
      }];

      await whatsappService.sendInteractiveList(
        userId,
        'Check out our special promotions:',
        sections,
        'View Promotions',
        '🎉 Promotions'
      );
    } catch (error) {
      logger.error('Error showing promoted products:', error);
      await whatsappService.sendTextMessage(
        userId,
        'Sorry, I couldn\'t load the promotions. Please try again later.'
      );
    }
  }

  private async showCart(actor: any, userId: string): Promise<void> {
    const snapshot = actor.getSnapshot();
    const { cart } = snapshot.context;
    
    if (cart.length === 0) {
      await whatsappService.sendTextMessage(
        userId,
        '🛒 Your cart is empty. Would you like to browse our menu?'
      );
      await this.showCategories(userId);
      return;
    }

    let cartMessage = '🛒 *Your Cart:*\n\n';
    let total = 0;
    
    cart.forEach((item: any) => {
      const subtotal = item.product.price * item.quantity;
      total += subtotal;
      cartMessage += `${item.product.name} x${item.quantity} - $${subtotal.toFixed(2)}\n`;
    });

    cartMessage += `\n*Total: $${total.toFixed(2)}*`;

    await whatsappService.sendTextMessage(userId, cartMessage);

    await whatsappService.sendInteractiveButtons(
      userId,
      'Ready to order?',
      [
        { id: 'checkout', title: '💳 Checkout' },
        { id: 'back_to_menu', title: '📱 Add More Items' },
        { id: 'clear_cart', title: '🗑️ Clear Cart' },
      ]
    );
  }

  private async confirmOrder(actor: any, userId: string): Promise<void> {
    const snapshot = actor.getSnapshot();
    const { cart, customer } = snapshot.context;
    
    let total = 0;
    let confirmMessage = `📋 *Order Confirmation*\n\n`;
    confirmMessage += `Customer: ${customer?.first_name} ${customer?.last_name}\n`;
    confirmMessage += `Email: ${customer?.email}\n\n`;
    
    confirmMessage += '*Items:*\n';
    cart.forEach((item: any) => {
      const subtotal = item.product.price * item.quantity;
      total += subtotal;
      confirmMessage += `${item.product.name} x${item.quantity} - $${subtotal.toFixed(2)}\n`;
    });
    
    confirmMessage += `\n*Total: $${total.toFixed(2)}*\n\n`;
    confirmMessage += `Is this correct?`;

    await whatsappService.sendTextMessage(userId, confirmMessage);

    await whatsappService.sendInteractiveButtons(
      userId,
      'Confirm your order:',
      [
        { id: 'confirm_order', title: '✅ Confirm Order' },
        { id: 'cancel_order', title: '❌ Cancel' },
      ]
    );
  }

  private async processNaturalOrderRequest(actor: any, userId: string, message: string): Promise<void> {
    try {
      const products = await coffeeShopApi.getProducts();
      const orderItems = await aiService.parseOrderFromMessage(message, products);

      if (orderItems.length === 0) {
        await whatsappService.sendTextMessage(
          userId,
          'I couldn\'t understand your order. Could you please be more specific about what you\'d like to order?'
        );
        return;
      }

      // Add items to cart
      for (const item of orderItems) {
        const product = products.find(p => p.name === item.productName);
        if (product) {
          actor.send({ type: 'ADD_TO_CART', product, quantity: item.quantity });
        }
      }

      await this.showCart(actor, userId);
    } catch (error) {
      logger.error('Error processing natural order request:', error);
      await whatsappService.sendTextMessage(
        userId,
        'Sorry, I had trouble processing your order. Please try selecting items from the menu.'
      );
    }
  }

  private async handleDefaultState(userId: string, intent: any): Promise<void> {
    const response = await aiService.generateResponse(intent, {});
    await whatsappService.sendTextMessage(userId, response);
    await this.showMainMenu(userId);
  }

  private async handleAudioModeToggle(userId: string): Promise<void> {
    const isAvailable = await audioService.isTTSAvailable();
    
    if (isAvailable) {
      await whatsappService.sendTextMessage(
        userId,
        '🔊 Audio mode is now enabled! I\'ll provide voice responses along with text. Say "disable audio" to turn it off.'
      );
      
      // Test the audio functionality
      await audioService.sendSynthesizedSpeech(
        userId,
        'Audio mode is now active! I can now speak my responses to you.'
      );
    } else {
      await whatsappService.sendTextMessage(
        userId,
        '❌ Sorry, audio mode is currently unavailable. The text-to-speech service is not ready.'
      );
    }
  }

}

export default new MessageHandlerService();