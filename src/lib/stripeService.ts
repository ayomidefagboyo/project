import { stripePromise, paymentPlans } from './stripe';
import { apiClient } from './apiClient';

export interface PaymentIntent {
  id: string;
  client_secret: string;
  amount: number;
  currency: string;
  status: string;
}

export interface Subscription {
  id: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  plan: {
    id: string;
    amount: number;
    currency: string;
    interval: string;
  };
}

export interface Customer {
  id: string;
  email: string;
  name?: string;
  subscriptions: Subscription[];
}

class StripeService {
  private stripe: any = null;

  async getStripe() {
    if (!this.stripe) {
      this.stripe = await stripePromise;
    }
    return this.stripe;
  }

  // Create a payment intent for one-time payments
  async createPaymentIntent(amount: number, currency = 'usd'): Promise<PaymentIntent> {
    try {
      const response = await apiClient.post('/payments/create-payment-intent', {
        amount: amount * 100, // Convert to cents
        currency,
      });
      return response.data;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw new Error('Failed to create payment intent');
    }
  }

  // Create a subscription checkout session
  async createSubscriptionCheckout(planId: string, successUrl: string, cancelUrl: string) {
    try {
      const plan = paymentPlans[planId as keyof typeof paymentPlans];
      if (!plan) {
        throw new Error('Invalid plan ID');
      }

      const response = await apiClient.post('/payments/create-subscription-checkout', {
        priceId: plan.priceId,
        successUrl,
        cancelUrl,
        planId,
      });

      return response.data;
    } catch (error) {
      console.error('Error creating subscription checkout:', error);
      throw new Error('Failed to create subscription checkout');
    }
  }

  // Redirect to Stripe Checkout
  async redirectToCheckout(sessionId: string) {
    try {
      const stripe = await this.getStripe();
      const { error } = await stripe.redirectToCheckout({ sessionId });
      
      if (error) {
        throw new Error(error.message);
      }
    } catch (error) {
      console.error('Error redirecting to checkout:', error);
      throw error;
    }
  }

  // Confirm a payment intent
  async confirmPayment(clientSecret: string, paymentMethod: any) {
    try {
      const stripe = await this.getStripe();
      const { error, paymentIntent } = await stripe.confirmPayment({
        clientSecret,
        confirmParams: {
          payment_method: paymentMethod,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      return paymentIntent;
    } catch (error) {
      console.error('Error confirming payment:', error);
      throw error;
    }
  }

  // Get customer information
  async getCustomer(customerId: string): Promise<Customer> {
    try {
      const response = await apiClient.get(`/payments/customer/${customerId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching customer:', error);
      throw new Error('Failed to fetch customer information');
    }
  }

  // Cancel a subscription
  async cancelSubscription(subscriptionId: string) {
    try {
      const response = await apiClient.post(`/payments/subscription/${subscriptionId}/cancel`);
      return response.data;
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw new Error('Failed to cancel subscription');
    }
  }

  // Update subscription
  async updateSubscription(subscriptionId: string, newPriceId: string) {
    try {
      const response = await apiClient.post(`/payments/subscription/${subscriptionId}/update`, {
        priceId: newPriceId,
      });
      return response.data;
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw new Error('Failed to update subscription');
    }
  }

  // Get subscription details
  async getSubscription(subscriptionId: string): Promise<Subscription> {
    try {
      const response = await apiClient.get(`/payments/subscription/${subscriptionId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching subscription:', error);
      throw new Error('Failed to fetch subscription details');
    }
  }

  // Create a setup intent for saving payment methods
  async createSetupIntent(customerId?: string) {
    try {
      const response = await apiClient.post('/payments/create-setup-intent', {
        customerId,
      });
      return response.data;
    } catch (error) {
      console.error('Error creating setup intent:', error);
      throw new Error('Failed to create setup intent');
    }
  }

  // Get payment methods for a customer
  async getPaymentMethods(customerId: string) {
    try {
      const response = await apiClient.get(`/payments/customer/${customerId}/payment-methods`);
      return response.data;
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      throw new Error('Failed to fetch payment methods');
    }
  }

  // Format currency for display
  formatCurrency(amount: number, currency = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  }

  // Get plan by ID
  getPlan(planId: string) {
    return paymentPlans[planId as keyof typeof paymentPlans] || null;
  }

  // Get all available plans
  getAllPlans() {
    return Object.values(paymentPlans);
  }
}

export const stripeService = new StripeService();
export default stripeService;
