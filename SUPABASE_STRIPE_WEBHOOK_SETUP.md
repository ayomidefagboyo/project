# Supabase + Stripe Webhook Integration Setup

This guide shows you how to set up Stripe webhook handling using Supabase Edge Functions to keep your subscriptions table in sync with Stripe.

## 🚀 Why Use Supabase Edge Functions?

- **Automatic scaling** - No server maintenance needed
- **Built-in security** - Webhook signature verification
- **Direct database access** - Updates your subscriptions table immediately
- **Global edge deployment** - Fast webhook processing worldwide

## 📋 Prerequisites

1. ✅ Subscriptions table created in Supabase (already done)
2. ✅ Stripe account with API keys
3. ✅ Supabase project with Edge Functions enabled

## 🛠️ Setup Steps

### 1. Deploy the Edge Function

```bash
# Use npx to run Supabase CLI (no global installation needed)
# Login to Supabase
npx supabase login

# Link your project (using your actual project reference)
npx supabase link --project-ref swxxvbmjccbzqvywgapo

# Deploy the stripe-webhook function
npx supabase functions deploy stripe-webhook
```

### 2. Set Environment Variables in Supabase

Go to your **Supabase Dashboard** → **Edge Functions** → **stripe-webhook** → **Settings**

Add these environment variables:

```bash
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_from_stripe
SUPABASE_URL=https://swxxvbmjccbzqvywgapo.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Configure Stripe Webhook Endpoint

1. Go to **Stripe Dashboard** → **Developers** → **Webhooks**
2. Click **"Add endpoint"**
3. Set the endpoint URL to:
   ```
   https://swxxvbmjccbzqvywgapo.supabase.co/functions/v1/stripe-webhook
   ```
4. Select these events to listen for:
   - `customer.subscription.created`
   - `customer.subscription.updated` 
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

5. Copy the **Webhook signing secret** and add it to your Supabase environment variables

### 4. Update Your Stripe Price IDs

In the Edge Function, update the `planMapping` object with your actual Stripe price IDs:

```typescript
const planMapping: Record<string, string> = {
  'price_your_actual_startup_price_id': 'startup',
  'price_your_actual_business_price_id': 'business', 
  'price_your_actual_enterprise_price_id': 'enterprise'
}
```

## 🔄 How It Works

### When a User Subscribes:

1. **User clicks "Subscribe"** on your frontend
2. **Stripe Checkout** processes the payment
3. **Stripe sends webhook** to your Supabase Edge Function
4. **Edge Function updates** your subscriptions table
5. **User gets access** to paid features immediately

### Webhook Events Handled:

- **`subscription.created/updated`** → Updates local subscription record
- **`subscription.deleted`** → Reverts user to free plan
- **`payment.succeeded`** → Can trigger success actions
- **`payment.failed`** → Can trigger retry logic

## 🧪 Testing

### Test the webhook locally:
```bash
# Start local development
supabase functions serve stripe-webhook

# Use Stripe CLI to forward webhooks to local function
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```

### Test with Stripe's webhook testing tool:
1. Go to **Stripe Dashboard** → **Webhooks** → **Your endpoint**
2. Click **"Send test webhook"**
3. Choose an event type and send it
4. Check your Supabase logs to see if it processed correctly

## 🔒 Security Features

- ✅ **Webhook signature verification** - Ensures requests are from Stripe
- ✅ **Service role key** - Direct database access with proper permissions
- ✅ **CORS headers** - Properly configured for web requests
- ✅ **Error handling** - Comprehensive error logging and responses

## 🎯 Benefits Over Custom Webhooks

| Feature | Custom Webhook | Supabase Edge Function |
|---------|----------------|------------------------|
| Server maintenance | ❌ Required | ✅ None |
| Scaling | ❌ Manual | ✅ Automatic |
| Database access | ❌ Complex setup | ✅ Built-in |
| Security | ❌ Custom implementation | ✅ Built-in |
| Global deployment | ❌ Expensive | ✅ Included |
| Monitoring | ❌ Custom setup | ✅ Built-in dashboard |

## 🚨 Important Notes

1. **Replace placeholder values** with your actual Stripe price IDs
2. **Test thoroughly** before going to production
3. **Monitor webhook deliveries** in Stripe dashboard
4. **Check Supabase logs** for any processing errors
5. **Keep webhook secrets secure** - never commit them to code

## 🎉 What's Next?

Once this is set up, your subscription system will be fully automated:

- ✅ Users can subscribe through your frontend
- ✅ Stripe handles all payment processing
- ✅ Webhooks keep your database in sync
- ✅ Users get immediate access to features
- ✅ Cancellations and upgrades work automatically

Your Stripe + Supabase integration is now production-ready! 🚀
