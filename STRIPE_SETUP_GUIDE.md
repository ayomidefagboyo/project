# Stripe Integration Setup Guide

This guide will help you complete the Stripe integration for your Compazz platform.

## 🎯 What's Already Implemented

✅ **Frontend Components**
- Complete pricing page with subscription plans
- Payment form with Stripe Elements
- Subscription management dashboard
- Stripe service for API calls

✅ **Backend API Endpoints**
- Payment intent creation
- Subscription checkout sessions
- Customer management
- Webhook handling
- Subscription updates and cancellations

✅ **Configuration Files**
- Environment variable templates
- Stripe configuration
- Payment plans setup

## 🚀 Setup Steps

### 1. Create Stripe Account & Get API Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Create an account or sign in
3. Get your API keys from **Developers > API keys**
4. Copy the **Publishable key** and **Secret key**

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Frontend Environment Variables
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_APP_URL=http://localhost:5173

# Backend Environment Variables (for backend/.env)
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### 3. Create Stripe Products & Prices

In your Stripe Dashboard:

1. Go to **Products** > **Add Product**
2. Create three products matching our plans:

**Starter Plan**
- Name: "Compazz Starter"
- Price: $29/month
- Copy the Price ID → Update `priceId` in `/src/lib/stripe.ts`

**Professional Plan**
- Name: "Compazz Professional" 
- Price: $79/month
- Copy the Price ID → Update `priceId` in `/src/lib/stripe.ts`

**Enterprise Plan**
- Name: "Compazz Enterprise"
- Price: $199/month
- Copy the Price ID → Update `priceId` in `/src/lib/stripe.ts`

### 4. Update Price IDs

Edit `/src/lib/stripe.ts` and replace the placeholder price IDs:

```typescript
export const paymentPlans = {
  starter: {
    // ... other properties
    priceId: 'price_1234567890abcdef', // Replace with actual Stripe Price ID
  },
  professional: {
    // ... other properties  
    priceId: 'price_1234567890abcdef', // Replace with actual Stripe Price ID
  },
  enterprise: {
    // ... other properties
    priceId: 'price_1234567890abcdef', // Replace with actual Stripe Price ID
  }
};
```

### 5. Set Up Webhooks

1. In Stripe Dashboard, go to **Developers > Webhooks**
2. Click **Add endpoint**
3. Set endpoint URL: `https://your-domain.com/api/v1/stripe/webhook`
4. Select events to listen for:
   - `payment_intent.succeeded`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Copy the **Signing secret** → Add to `STRIPE_WEBHOOK_SECRET`

### 6. Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 7. Test the Integration

1. Start the development server: `npm run dev`
2. Navigate to `/pricing`
3. Click "Start Free Trial" on any plan
4. Use Stripe test card: `4242 4242 4242 4242`
5. Verify the checkout flow works

## 🧪 Test Cards

Use these test cards for development:

- **Success**: `4242 4242 4242 4242`
- **Declined**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0027 6000 3184`

Any future expiry date and CVC will work.

## 🔧 API Endpoints

The following Stripe endpoints are available:

```
POST /api/v1/stripe/create-payment-intent
POST /api/v1/stripe/create-subscription-checkout
POST /api/v1/stripe/create-setup-intent
GET  /api/v1/stripe/customer/{customer_id}
GET  /api/v1/stripe/subscription/{subscription_id}
POST /api/v1/stripe/subscription/{subscription_id}/cancel
POST /api/v1/stripe/subscription/{subscription_id}/update
GET  /api/v1/stripe/customer/{customer_id}/payment-methods
POST /api/v1/stripe/webhook
```

## 🎨 UI Components

### Pricing Page
- Located at `/pricing`
- Shows all subscription plans
- Handles checkout flow
- Responsive design

### Payment Form
- Component: `PaymentForm.tsx`
- Handles one-time payments
- Stripe Elements integration
- Error handling

### Subscription Manager
- Component: `SubscriptionManager.tsx`
- View current subscription
- Cancel/upgrade options
- Payment method management

## 🔐 Security Features

✅ **Client-Side Security**
- Stripe Elements (no card data touches your servers)
- HTTPS required for production
- Client-side validation

✅ **Server-Side Security**
- Webhook signature verification
- API key protection
- User authentication required

## 🚨 Production Checklist

Before going live:

- [ ] Replace test API keys with live keys
- [ ] Update webhook endpoint to production URL
- [ ] Test with real payment methods
- [ ] Set up monitoring for failed payments
- [ ] Configure email notifications
- [ ] Update terms of service and privacy policy

## 🐛 Troubleshooting

**"Invalid API key"**
- Check that your API keys are correct
- Ensure you're using the right environment (test vs live)

**"No such price"**
- Verify Price IDs match your Stripe products
- Check that products are active in Stripe

**Webhook errors**
- Verify webhook endpoint is accessible
- Check webhook secret matches
- Review webhook event logs in Stripe

## 📚 Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe React Elements](https://stripe.com/docs/stripe-js/react)
- [Webhook Testing](https://stripe.com/docs/webhooks/test)
- [Stripe CLI](https://stripe.com/docs/stripe-cli) for local testing

---

## 🎉 You're All Set!

Your Stripe integration is now complete with:
- ✅ Full subscription management
- ✅ One-time payment processing  
- ✅ Webhook handling
- ✅ Customer management
- ✅ Professional UI components

Users can now subscribe to your plans and manage their subscriptions directly from your platform!
