import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Stripe with secret key
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the webhook signature and payload
    const signature = req.headers.get('stripe-signature')
    const body = await req.text()
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

    if (!signature || !webhookSecret) {
      console.error('Missing stripe signature or webhook secret')
      return new Response('Webhook signature verification failed', { 
        status: 400,
        headers: corsHeaders 
      })
    }

    // Verify the webhook signature
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error(`Webhook signature verification failed: ${err.message}`)
      return new Response(`Webhook signature verification failed: ${err.message}`, { 
        status: 400,
        headers: corsHeaders 
      })
    }

    console.log(`Processing webhook event: ${event.type}`)

    // Handle different webhook events
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChange(event.data.object as Stripe.Subscription, supabaseClient)
        break
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, supabaseClient)
        break
        
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice, supabaseClient)
        break
        
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice, supabaseClient)
        break
        
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error processing webhook:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

// Handle subscription creation/updates
async function handleSubscriptionChange(subscription: Stripe.Subscription, supabaseClient: any) {
  console.log(`Handling subscription change: ${subscription.id}`)
  
  // Get customer to find user_id from metadata
  const customer = await supabaseClient
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', subscription.customer)
    .single()

  if (!customer.data) {
    console.error(`No user found for customer: ${subscription.customer}`)
    return
  }

  // Map Stripe plan to your local plan
  const planMapping: Record<string, string> = {
    'price_1S6vsm17pn15PHGvl4WyWKyo': 'startup',
    'price_1S6vue17pn15PHGvRwvVme0u': 'business',
    'price_1S6vwy17pn15PHGvWhJAdoIa': 'enterprise'
  }

  const priceId = subscription.items.data[0]?.price?.id
  const planId = planMapping[priceId] || 'free'

  // Determine max outlets and users based on plan
  const planLimits = {
    free: { max_outlets: 1, max_users: 3 },
    startup: { max_outlets: 1, max_users: 5 },
    business: { max_outlets: 5, max_users: 15 },
    enterprise: { max_outlets: -1, max_users: -1 } // unlimited
  }

  const limits = planLimits[planId] || planLimits.free

  // Upsert subscription record
  const { error } = await supabaseClient
    .from('subscriptions')
    .upsert({
      user_id: customer.data.user_id,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      stripe_price_id: priceId,
      plan_id: planId,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
      max_outlets: limits.max_outlets,
      max_users: limits.max_users,
      features: {
        basic_reporting: true,
        advanced_analytics: planId !== 'free',
        priority_support: ['business', 'enterprise'].includes(planId),
        custom_integrations: planId === 'enterprise',
        white_label: planId === 'enterprise'
      },
      metadata: subscription.metadata || {},
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    })

  if (error) {
    console.error('Error upserting subscription:', error)
    throw error
  }

  console.log(`Successfully updated subscription for user: ${customer.data.user_id}`)
}

// Handle subscription deletion (cancellation)
async function handleSubscriptionDeleted(subscription: Stripe.Subscription, supabaseClient: any) {
  console.log(`Handling subscription deletion: ${subscription.id}`)
  
  // Update subscription to canceled status and revert to free plan
  const { error } = await supabaseClient
    .from('subscriptions')
    .update({
      plan_id: 'free',
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      max_outlets: 1,
      max_users: 3,
      features: {
        basic_reporting: true,
        advanced_analytics: false,
        priority_support: false,
        custom_integrations: false,
        white_label: false
      },
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    console.error('Error updating canceled subscription:', error)
    throw error
  }

  console.log(`Successfully canceled subscription: ${subscription.id}`)
}

// Handle successful payment
async function handlePaymentSucceeded(invoice: Stripe.Invoice, supabaseClient: any) {
  console.log(`Payment succeeded for invoice: ${invoice.id}`)
  
  // You can add logic here to:
  // - Send payment confirmation emails
  // - Update payment history
  // - Trigger any post-payment actions
  
  // For now, just log the success
  console.log(`Payment of ${invoice.amount_paid} succeeded for customer: ${invoice.customer}`)
}

// Handle failed payment
async function handlePaymentFailed(invoice: Stripe.Invoice, supabaseClient: any) {
  console.log(`Payment failed for invoice: ${invoice.id}`)
  
  // You can add logic here to:
  // - Send payment failure notifications
  // - Update subscription status if needed
  // - Trigger retry logic
  
  console.log(`Payment failed for customer: ${invoice.customer}`)
}
