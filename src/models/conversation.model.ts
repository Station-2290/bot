import { Product, Customer, Order } from '../services/coffeeShopApi.service';

export interface ConversationState {
  userId: string;
  currentStep: ConversationStep;
  cart: CartItem[];
  customer?: Customer;
  pendingOrder?: Order;
  lastActivity: Date;
  context: {
    selectedCategory?: number;
    awaitingConfirmation?: boolean;
    awaitingCustomerInfo?: 'name' | 'email' | 'phone';
  };
}

export enum ConversationStep {
  IDLE = 'IDLE',
  GREETING = 'GREETING',
  VIEWING_MENU = 'VIEWING_MENU',
  SELECTING_PRODUCTS = 'SELECTING_PRODUCTS',
  REVIEWING_CART = 'REVIEWING_CART',
  COLLECTING_CUSTOMER_INFO = 'COLLECTING_CUSTOMER_INFO',
  CONFIRMING_ORDER = 'CONFIRMING_ORDER',
  ORDER_COMPLETED = 'ORDER_COMPLETED',
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export class ConversationManager {
  private conversations: Map<string, ConversationState> = new Map();
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  getConversation(userId: string): ConversationState {
    const existing = this.conversations.get(userId);
    
    if (existing && this.isSessionValid(existing)) {
      existing.lastActivity = new Date();
      return existing;
    }

    const newConversation: ConversationState = {
      userId,
      currentStep: ConversationStep.IDLE,
      cart: [],
      lastActivity: new Date(),
      context: {},
    };

    this.conversations.set(userId, newConversation);
    return newConversation;
  }

  updateConversation(userId: string, updates: Partial<ConversationState>): void {
    const conversation = this.getConversation(userId);
    Object.assign(conversation, updates);
    conversation.lastActivity = new Date();
  }

  addToCart(userId: string, product: Product, quantity: number): void {
    const conversation = this.getConversation(userId);
    const existingItem = conversation.cart.find(item => item.product.id === product.id);

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      conversation.cart.push({ product, quantity });
    }

    conversation.lastActivity = new Date();
  }

  removeFromCart(userId: string, productId: number): void {
    const conversation = this.getConversation(userId);
    conversation.cart = conversation.cart.filter(item => item.product.id !== productId);
    conversation.lastActivity = new Date();
  }

  clearCart(userId: string): void {
    const conversation = this.getConversation(userId);
    conversation.cart = [];
    conversation.lastActivity = new Date();
  }

  getCartTotal(userId: string): number {
    const conversation = this.getConversation(userId);
    return conversation.cart.reduce((total, item) => {
      return total + (item.product.price * item.quantity);
    }, 0);
  }

  resetConversation(userId: string): void {
    this.conversations.delete(userId);
  }

  private isSessionValid(conversation: ConversationState): boolean {
    const now = new Date().getTime();
    const lastActivity = conversation.lastActivity.getTime();
    return (now - lastActivity) < this.SESSION_TIMEOUT;
  }

  cleanupExpiredSessions(): void {
    const now = new Date().getTime();
    
    for (const [userId, conversation] of this.conversations.entries()) {
      if ((now - conversation.lastActivity.getTime()) > this.SESSION_TIMEOUT) {
        this.conversations.delete(userId);
      }
    }
  }
}

export default new ConversationManager();