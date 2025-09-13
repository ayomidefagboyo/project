import { loadStripe } from '@stripe/stripe-js';

// Get the publishable key from environment variables
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

if (!stripePublishableKey) {
  throw new Error('Missing Stripe publishable key. Please add VITE_STRIPE_PUBLISHABLE_KEY to your .env file.');
}

// Initialize Stripe
export const stripePromise = loadStripe(stripePublishableKey);

// Stripe configuration
export const stripeConfig = {
  publishableKey: stripePublishableKey,
  apiVersion: '2023-10-16' as const,
};

// Payment plans configuration - matching existing pricing structure
export const paymentPlans = {
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for small businesses with up to 2 outlets',
    price: 29,
    priceId: 'price_starter_monthly', // Replace with actual Stripe price ID
    features: [
      'Up to 2 outlets',
      'Basic reporting',
      'Mobile app access',
      'Email support',
      'Basic analytics'
    ],
    popular: false
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'Ideal for growing businesses with multiple outlets',
    price: 79,
    priceId: 'price_pro_monthly', // Replace with actual Stripe price ID
    features: [
      'Everything in Starter plus:',
      'Up to 10 outlets',
      'Advanced analytics',
      'Priority support',
      'Custom reports'
    ],
    popular: true
  },
  advanced: {
    id: 'advanced',
    name: 'Advanced',
    description: 'For established businesses with complex needs',
    price: 149,
    priceId: 'price_advanced_monthly', // Replace with actual Stripe price ID
    features: [
      'Everything in Pro plus:',
      'Unlimited outlets',
      'White-label solution',
      'Dedicated support',
      'API access',
      'Custom integrations'
    ],
    popular: false
  }
};

// Stripe payment intents configuration
export const createPaymentIntentConfig = (amount: number, currency = 'usd') => ({
  amount: amount * 100, // Convert to cents
  currency,
  automatic_payment_methods: {
    enabled: true,
  },
  metadata: {
    integration_check: 'accept_a_payment',
  },
});

// Subscription configuration
export const createSubscriptionConfig = (priceId: string, customerId?: string) => ({
  price_data: {
    currency: 'usd',
    product_data: {
      name: 'Compazz Subscription',
    },
    unit_amount: 0, // Will be set based on plan
    recurring: {
      interval: 'month',
    },
  },
  quantity: 1,
  ...(customerId && { customer: customerId }),
});

export default stripePromise;
