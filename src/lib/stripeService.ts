import { stripePromise, paymentPlans } from './stripe';
import { apiClient } from './apiClient';
import { logger } from './logger';


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
  cancel_at_period_end: boolean;
  trial_start?: number;
  trial_end?: number;
  is_trial: boolean;
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
      const response = await apiClient.post('/stripe/create-payment-intent', {
        amount: amount * 100, // Convert to cents
        currency,
      });
      return response.data;
    } catch (error) {
      logger.error('Error creating payment intent:', error);
      throw new Error('Failed to create payment intent');
    }
  }

  // Create a subscription checkout session with trial
  async createSubscriptionCheckout(planId: string, successUrl: string, cancelUrl: string, trialDays = 7) {
    try {
      const plan = paymentPlans[planId as keyof typeof paymentPlans];
      if (!plan) {
        throw new Error('Invalid plan ID');
      }

      const response = await apiClient.post('/stripe/create-subscription-checkout', {
        priceId: plan.priceId,
        successUrl,
        cancelUrl,
        planId,
        trialDays,
      });

      return response.data;
        } catch (error) {
          logger.error('Error creating subscription checkout:', error);
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
      logger.error('Error redirecting to checkout:', error);
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
      logger.error('Error confirming payment:', error);
      throw error;
    }
  }

  // Create a subscription directly with trial
  async createSubscription(planId: string, trialDays = 7, paymentMethodId?: string) {
    try {
      const plan = paymentPlans[planId as keyof typeof paymentPlans];
      if (!plan) {
        throw new Error('Invalid plan ID');
      }

      const response = await apiClient.post('/stripe/create-subscription', {
        priceId: plan.priceId,
        trialDays,
        paymentMethodId,
      });

      return response.data;
    } catch (error) {
      logger.error('Error creating subscription:', error);
      throw new Error('Failed to create subscription');
    }
  }

  // Get customer information
  async getCustomer(customerId: string): Promise<Customer> {
    try {
      const response = await apiClient.get(`/stripe/customer/${customerId}`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching customer:', error);
      throw new Error('Failed to fetch customer information');
    }
  }

  // Cancel a subscription
  async cancelSubscription(subscriptionId: string) {
    try {
      const response = await apiClient.post(`/stripe/subscription/${subscriptionId}/cancel`);
      return response.data;
    } catch (error) {
      logger.error('Error canceling subscription:', error);
      throw new Error('Failed to cancel subscription');
    }
  }

  // Update subscription
  async updateSubscription(subscriptionId: string, newPriceId: string) {
    try {
      const response = await apiClient.post(`/stripe/subscription/${subscriptionId}/update`, {
        priceId: newPriceId,
      });
      return response.data;
    } catch (error) {
      logger.error('Error updating subscription:', error);
      throw new Error('Failed to update subscription');
    }
  }

  // Get subscription details
  async getSubscription(subscriptionId: string): Promise<Subscription> {
    try {
      const response = await apiClient.get(`/stripe/subscription/${subscriptionId}`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching subscription:', error);
      throw new Error('Failed to fetch subscription details');
    }
  }

  // Create a setup intent for saving payment methods
  async createSetupIntent(customerId?: string) {
    try {
      const response = await apiClient.post('/stripe/create-setup-intent', {
        customerId,
      });
      return response.data;
    } catch (error) {
      logger.error('Error creating setup intent:', error);
      throw new Error('Failed to create setup intent');
    }
  }

  // Get payment methods for a customer
  async getPaymentMethods(customerId: string) {
    try {
      const response = await apiClient.get(`/stripe/customer/${customerId}/payment-methods`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching payment methods:', error);
      throw new Error('Failed to fetch payment methods');
    }
  }

  // Check if subscription is in trial
  isTrialActive(subscription: Subscription): boolean {
    return subscription.is_trial && subscription.status === 'trialing';
  }

  // Get days remaining in trial
  getTrialDaysRemaining(subscription: Subscription): number {
    if (!subscription.trial_end) return 0;
    
    const now = Math.floor(Date.now() / 1000);
    const daysRemaining = Math.ceil((subscription.trial_end - now) / (24 * 60 * 60));
    return Math.max(0, daysRemaining);
  }

  // Format trial status for display
  getTrialStatus(subscription: Subscription): string {
    if (!this.isTrialActive(subscription)) {
      return 'No active trial';
    }
    
    const daysRemaining = this.getTrialDaysRemaining(subscription);
    if (daysRemaining === 0) {
      return 'Trial ends today';
    } else if (daysRemaining === 1) {
      return '1 day remaining';
    } else {
      return `${daysRemaining} days remaining`;
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
