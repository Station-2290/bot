import { createMachine, assign, createActor } from 'xstate';
import { Product, Customer, Order } from '../services/coffeeShopApi.service';

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface ConversationContext {
  userId: string;
  cart: CartItem[];
  customer?: Customer;
  pendingOrder?: Order;
  selectedCategory?: number;
  customerInfo: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  error?: string;
}

export type ConversationEvent =
  | { type: 'START' }
  | { type: 'VIEW_MENU' }
  | { type: 'SELECT_CATEGORY'; categoryId: number }
  | { type: 'ADD_TO_CART'; product: Product; quantity: number }
  | { type: 'VIEW_CART' }
  | { type: 'CHECKOUT' }
  | { type: 'PROVIDE_NAME'; firstName: string; lastName: string }
  | { type: 'PROVIDE_EMAIL'; email: string }
  | { type: 'CONFIRM_ORDER' }
  | { type: 'CANCEL_ORDER' }
  | { type: 'ORDER_PLACED'; order: Order }
  | { type: 'CLEAR_CART' }
  | { type: 'BACK' }
  | { type: 'ERROR'; error: string }
  | { type: 'RESET' };

export const conversationMachine = createMachine({
  id: 'conversation',
  initial: 'idle',
  context: ({ input }: { input: { userId: string } }): ConversationContext => ({
    userId: input.userId,
    cart: [],
    customerInfo: {},
  }),
  types: {
    context: {} as ConversationContext,
    events: {} as ConversationEvent,
  },
  states: {
    idle: {
      on: {
        START: {
          target: 'greeting',
        },
        VIEW_MENU: {
          target: 'viewingMenu',
        },
      },
    },
    greeting: {
      on: {
        VIEW_MENU: {
          target: 'viewingMenu',
        },
        ADD_TO_CART: {
          target: 'selectingProducts',
          actions: assign({
            cart: ({ context, event }) => [
              ...context.cart,
              { product: event.product, quantity: event.quantity },
            ],
          }),
        },
      },
    },
    viewingMenu: {
      on: {
        SELECT_CATEGORY: {
          target: 'selectingProducts',
          actions: assign({
            selectedCategory: ({ event }) => event.categoryId,
          }),
        },
        VIEW_CART: {
          target: 'reviewingCart',
        },
        BACK: {
          target: 'greeting',
        },
      },
    },
    selectingProducts: {
      on: {
        ADD_TO_CART: {
          actions: assign({
            cart: ({ context, event }) => {
              const existingItem = context.cart.find(
                item => item.product.id === event.product.id
              );
              
              if (existingItem) {
                return context.cart.map(item =>
                  item.product.id === event.product.id
                    ? { ...item, quantity: item.quantity + event.quantity }
                    : item
                );
              }
              
              return [...context.cart, { product: event.product, quantity: event.quantity }];
            },
          }),
        },
        VIEW_CART: {
          target: 'reviewingCart',
        },
        VIEW_MENU: {
          target: 'viewingMenu',
        },
        CHECKOUT: {
          target: 'checkout',
        },
      },
    },
    reviewingCart: {
      on: {
        CHECKOUT: {
          target: 'checkout',
          guard: ({ context }) => context.cart.length > 0,
        },
        VIEW_MENU: {
          target: 'viewingMenu',
        },
        CLEAR_CART: {
          target: 'viewingMenu',
          actions: assign({
            cart: () => [],
          }),
        },
        ADD_TO_CART: {
          target: 'selectingProducts',
          actions: assign({
            cart: ({ context, event }) => [
              ...context.cart,
              { product: event.product, quantity: event.quantity },
            ],
          }),
        },
      },
    },
    checkout: {
      initial: 'checkingCustomer',
      states: {
        checkingCustomer: {
          always: [
            {
              target: 'confirmingOrder',
              guard: ({ context }) => !!context.customer,
            },
            {
              target: 'collectingName',
            },
          ],
        },
        collectingName: {
          on: {
            PROVIDE_NAME: {
              target: 'collectingEmail',
              actions: assign({
                customerInfo: ({ context, event }) => ({
                  ...context.customerInfo,
                  firstName: event.firstName,
                  lastName: event.lastName,
                }),
              }),
            },
            CANCEL_ORDER: {
              target: '#conversation.reviewingCart',
            },
          },
        },
        collectingEmail: {
          on: {
            PROVIDE_EMAIL: {
              target: 'creatingCustomer',
              actions: assign({
                customerInfo: ({ context, event }) => ({
                  ...context.customerInfo,
                  email: event.email,
                }),
              }),
            },
            CANCEL_ORDER: {
              target: '#conversation.reviewingCart',
            },
          },
        },
        creatingCustomer: {
          invoke: {
            id: 'createCustomer',
            src: 'createCustomer',
            input: ({ context }) => ({
              userId: context.userId,
              customerInfo: context.customerInfo,
            }),
            onDone: {
              target: 'confirmingOrder',
              actions: assign({
                customer: ({ event }) => event.output,
              }),
            },
            onError: {
              target: 'collectingEmail',
              actions: assign({
                error: ({ event }) => (event.error as Error).message,
              }),
            },
          },
        },
        confirmingOrder: {
          on: {
            CONFIRM_ORDER: {
              target: 'placingOrder',
            },
            CANCEL_ORDER: {
              target: '#conversation.reviewingCart',
            },
          },
        },
        placingOrder: {
          invoke: {
            id: 'placeOrder',
            src: 'placeOrder',
            input: ({ context }) => ({
              customer: context.customer,
              cart: context.cart,
            }),
            onDone: {
              target: '#conversation.orderCompleted',
              actions: assign({
                pendingOrder: ({ event }) => event.output,
                cart: () => [],
              }),
            },
            onError: {
              target: 'confirmingOrder',
              actions: assign({
                error: ({ event }) => (event.error as Error).message,
              }),
            },
          },
        },
      },
    },
    orderCompleted: {
      on: {
        START: {
          target: 'greeting',
        },
        VIEW_MENU: {
          target: 'viewingMenu',
        },
        RESET: {
          target: 'idle',
          actions: assign({
            cart: () => [],
            customer: () => undefined,
            pendingOrder: () => undefined,
            selectedCategory: () => undefined,
            customerInfo: () => ({}),
            error: () => undefined,
          }),
        },
      },
    },
  },
  on: {
    ERROR: {
      actions: assign({
        error: ({ event }) => event.error,
      }),
    },
    RESET: {
      target: '.idle',
      actions: assign({
        cart: () => [],
        customer: () => undefined,
        pendingOrder: () => undefined,
        selectedCategory: () => undefined,
        customerInfo: () => ({}),
        error: () => undefined,
      }),
    },
  },
});

export class ConversationStateMachine {
  private actors: Map<string, any> = new Map();

  getOrCreateActor(userId: string, services: any) {
    let actor = this.actors.get(userId);
    
    if (!actor) {
      actor = createActor(conversationMachine, {
        input: { userId },
        systemId: `conversation-${userId}`,
        inspect: (inspectionEvent) => {
          if ('type' in inspectionEvent) {
            console.log('State machine event:', inspectionEvent);
          }
        },
      });

      // Provide service implementations
      actor.provide(services);
      
      actor.start();
      this.actors.set(userId, actor);
    }

    return actor;
  }

  removeActor(userId: string) {
    const actor = this.actors.get(userId);
    if (actor) {
      actor.stop();
      this.actors.delete(userId);
    }
  }

  getActorSnapshot(userId: string) {
    const actor = this.actors.get(userId);
    return actor?.getSnapshot();
  }
}

export default new ConversationStateMachine();