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

// Payment plans configuration - Stripe prices in GBP, frontend shows converted prices
export const paymentPlans = {
  startup: {
    id: 'startup',
    name: 'Startup',
    description: 'Perfect for small businesses with up to 2 outlets',
    priceGBP: 25, // Actual Stripe price in GBP
    priceId: 'price_1S6vsm17pn15PHGvl4WyWKyo', // Startup monthly price ID
    features: [
      'Up to 2 outlets',
      'Basic reporting',
      'Mobile app access',
      'Email support',
      'Basic analytics'
    ],
    popular: false
  },
  business: {
    id: 'business',
    name: 'Business',
    description: 'Ideal for growing businesses with multiple outlets',
    priceGBP: 69, // Actual Stripe price in GBP
    priceId: 'price_1S6vue17pn15PHGvRwvVme0u', // Business monthly price ID
    features: [
      'Everything in Startup plus:',
      'Up to 10 outlets',
      'Advanced analytics',
      'Priority support',
      'Custom reports'
    ],
    popular: true
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For established businesses with complex needs',
    priceGBP: 159, // Actual Stripe price in GBP
    priceId: 'price_1S6vwy17pn15PHGvWhJAdoIa', // Enterprise monthly price ID
    features: [
      'Everything in Business plus:',
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
export const createSubscriptionConfig = (customerId?: string) => ({
  line_items: [{
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
  }],
  mode: 'subscription',
  ...(customerId && { customer: customerId }),
});

export default stripePromise;
