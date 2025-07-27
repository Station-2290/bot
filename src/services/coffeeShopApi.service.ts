import createClient from 'openapi-fetch';
import { config } from '../config';
import logger from '../utils/logger';
import type { paths, components } from '../types/api.types';

// Type aliases for easier use
export type Category = components['schemas']['Category'];
export type Product = components['schemas']['Product'];
export type Customer = components['schemas']['Customer'];
export type Order = components['schemas']['Order'];
export type CreateOrderDto = components['schemas']['CreateOrderDto'];
export type UpdateOrderDto = components['schemas']['UpdateOrderDto'];
export type CreateCustomerDto = components['schemas']['CreateCustomerDto'];

export interface OrderItem {
  product_id: number;
  quantity: number;
  unit_price?: number;
  subtotal?: number;
}

export class CoffeeShopApiService {
  private client: ReturnType<typeof createClient<paths>>;

  constructor() {
    this.client = createClient<paths>({
      baseUrl: config.coffeeShopApi.url,
      headers: {
        'X-API-Key': config.coffeeShopApi.apiKey,
      },
    });
  }

  async getCategories(): Promise<Category[]> {
    try {
      const { data, error } = await this.client.GET('/api/v1/categories');
      
      if (error) {
        throw new Error(`Failed to fetch categories: ${error.message || 'Unknown error'}`);
      }

      return (data as any).items || data || [];
    } catch (error) {
      logger.error('Failed to fetch categories:', error);
      throw error;
    }
  }

  async getProducts(categoryId?: number): Promise<Product[]> {
    try {
      const { data, error } = await this.client.GET('/api/v1/products', {
        params: {
          query: categoryId ? { category_id: categoryId } as any : {},
        },
      });
      
      if (error) {
        throw new Error(`Failed to fetch products: ${error.message || 'Unknown error'}`);
      }

      return (data as any).items || data || [];
    } catch (error) {
      logger.error('Failed to fetch products:', error);
      throw error;
    }
  }

  async getProduct(id: number): Promise<Product> {
    try {
      const { data, error } = await this.client.GET('/api/v1/products/{id}', {
        params: {
          path: { id },
        },
      });
      
      if (error) {
        throw new Error(`Failed to fetch product ${id}: ${error.message || 'Unknown error'}`);
      }

      return data as Product;
    } catch (error) {
      logger.error(`Failed to fetch product ${id}:`, error);
      throw error;
    }
  }

  async searchProducts(query: string): Promise<Product[]> {
    try {
      const { data, error } = await this.client.GET('/api/v1/products', {
        params: {
          query: { search: query } as any,
        },
      });
      
      if (error) {
        throw new Error(`Failed to search products: ${error.message || 'Unknown error'}`);
      }

      return (data as any).items || data || [];
    } catch (error) {
      logger.error('Failed to search products:', error);
      throw error;
    }
  }

  async createCustomer(customerData: CreateCustomerDto): Promise<Customer> {
    try {
      const { data, error } = await this.client.POST('/api/v1/customers', {
        body: customerData,
      });
      
      if (error) {
        throw new Error(`Failed to create customer: ${error.message || 'Unknown error'}`);
      }

      return data as Customer;
    } catch (error) {
      logger.error('Failed to create customer:', error);
      throw error;
    }
  }

  async getCustomerByPhone(phone: string): Promise<Customer | null> {
    try {
      const { data, error } = await this.client.GET('/api/v1/customers', {
        params: {
          query: { phone } as any,
        },
      });
      
      if (error) {
        logger.error('Failed to fetch customer by phone:', error);
        return null;
      }

      const customers = (data as any).items || data || [];
      return customers.length > 0 ? customers[0] : null;
    } catch (error) {
      logger.error('Failed to fetch customer by phone:', error);
      return null;
    }
  }

  async createOrder(orderData: CreateOrderDto): Promise<Order> {
    try {
      const { data, error } = await this.client.POST('/api/v1/orders', {
        body: orderData,
      });
      
      if (error) {
        throw new Error(`Failed to create order: ${error.message || 'Unknown error'}`);
      }

      return data as Order;
    } catch (error) {
      logger.error('Failed to create order:', error);
      throw error;
    }
  }

  async getOrder(id: number): Promise<Order> {
    try {
      const { data, error } = await this.client.GET('/api/v1/orders/{id}', {
        params: {
          path: { id },
        },
      });
      
      if (error) {
        throw new Error(`Failed to fetch order ${id}: ${error.message || 'Unknown error'}`);
      }

      return data as Order;
    } catch (error) {
      logger.error(`Failed to fetch order ${id}:`, error);
      throw error;
    }
  }

  async updateOrderStatus(
    id: number,
    status: Order['status']
  ): Promise<Order> {
    try {
      const { data, error } = await this.client.PATCH('/api/v1/orders/{id}', {
        params: {
          path: { id },
        },
        body: { status } as UpdateOrderDto,
      });
      
      if (error) {
        throw new Error(`Failed to update order ${id} status: ${error.message || 'Unknown error'}`);
      }

      return data as Order;
    } catch (error) {
      logger.error(`Failed to update order ${id} status:`, error);
      throw error;
    }
  }

  async cancelOrder(id: number): Promise<Order> {
    try {
      const { data, error } = await this.client.POST('/api/v1/orders/{id}/cancel', {
        params: {
          path: { id },
        },
      });
      
      if (error) {
        throw new Error(`Failed to cancel order ${id}: ${error.message || 'Unknown error'}`);
      }

      return data as Order;
    } catch (error) {
      logger.error(`Failed to cancel order ${id}:`, error);
      throw error;
    }
  }

  async getPromotedProducts(): Promise<Product[]> {
    try {
      const { data, error } = await this.client.GET('/api/v1/products', {
        params: {
          query: { is_promoted: true } as any,
        },
      });
      
      if (error) {
        throw new Error(`Failed to fetch promoted products: ${error.message || 'Unknown error'}`);
      }

      return (data as any).items || data || [];
    } catch (error) {
      logger.error('Failed to fetch promoted products:', error);
      throw error;
    }
  }
}

export default new CoffeeShopApiService();