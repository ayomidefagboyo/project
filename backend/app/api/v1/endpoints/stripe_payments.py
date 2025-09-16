"""
Stripe payment integration endpoints
"""

import os
import stripe
from fastapi import APIRouter, HTTPException, status, Depends, Request
from typing import Optional, Dict, Any
from pydantic import BaseModel
from app.core.security import require_auth, get_user_outlet_id

# Initialize Stripe
stripe_key = os.getenv("STRIPE_SECRET_KEY")
print(f"🔑 Stripe key loaded: {'✅ Yes' if stripe_key else '❌ No'}")
if stripe_key:
    print(f"🔑 Stripe key starts with: {stripe_key[:7]}...")
stripe.api_key = stripe_key

router = APIRouter()

class PaymentIntentRequest(BaseModel):
    amount: int  # Amount in cents
    currency: str = "usd"
    metadata: Optional[Dict[str, str]] = None

class SubscriptionCheckoutRequest(BaseModel):
    priceId: str
    successUrl: str
    cancelUrl: str
    planId: str
    trialDays: Optional[int] = 7  # Default 7-day trial
    metadata: Optional[Dict[str, str]] = None

class SetupIntentRequest(BaseModel):
    customerId: Optional[str] = None

class SubscriptionUpdateRequest(BaseModel):
    priceId: str

class SubscriptionCreateRequest(BaseModel):
    priceId: str
    customerId: Optional[str] = None
    trialDays: Optional[int] = 7  # Default 7-day trial
    paymentMethodId: Optional[str] = None  # Required if no trial
    metadata: Optional[Dict[str, str]] = None

@router.post("/create-payment-intent")
async def create_payment_intent(
    request: PaymentIntentRequest,
    current_user: Dict[str, Any] = Depends(require_auth)
):
    """
    Create a Stripe payment intent for one-time payments
    """
    try:
        # Create or get customer
        customer_id = await get_or_create_stripe_customer(current_user)
        
        # Create payment intent
        intent = stripe.PaymentIntent.create(
            amount=request.amount,
            currency=request.currency,
            customer=customer_id,
            automatic_payment_methods={'enabled': True},
            metadata={
                'user_id': current_user['id'],
                'outlet_id': get_user_outlet_id(current_user),
                **(request.metadata or {})
            }
        )
        
        return {
            'id': intent.id,
            'client_secret': intent.client_secret,
            'amount': intent.amount,
            'currency': intent.currency,
            'status': intent.status
        }
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create payment intent"
        )

@router.post("/create-subscription-checkout")
async def create_subscription_checkout(
    request: SubscriptionCheckoutRequest,
    current_user: Dict[str, Any] = Depends(require_auth)
):
    """
    Create a Stripe checkout session for subscriptions
    """
    try:
        print(f"🚀 Creating subscription checkout for user: {current_user.get('id')}")
        print(f"🎯 Price ID: {request.priceId}")
        print(f"⏰ Trial days: {request.trialDays}")

        # Create or get customer
        customer_id = await get_or_create_stripe_customer(current_user)
        print(f"👤 Customer ID: {customer_id}")
        
        # Prepare subscription data with trial
        subscription_data = {
            'metadata': {
                'user_id': current_user['id'],
                'outlet_id': get_user_outlet_id(current_user),
                'plan_id': request.planId,
                **(request.metadata or {})
            }
        }
        
        # Add trial period if specified
        if request.trialDays and request.trialDays > 0:
            subscription_data.update({
                'trial_period_days': request.trialDays,
                'trial_settings': {
                    'end_behavior': {
                        'missing_payment_method': 'cancel'  # Cancel if no payment method after trial
                    }
                }
            })
        
        # Create checkout session with trial
        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=['card'],
            line_items=[{
                'price': request.priceId,
                'quantity': 1,
            }],
            mode='subscription',
            subscription_data=subscription_data,
            success_url=request.successUrl,
            cancel_url=request.cancelUrl,
            metadata={
                'user_id': current_user['id'],
                'outlet_id': get_user_outlet_id(current_user),
                'plan_id': request.planId,
                'trial_days': str(request.trialDays or 0),
                **(request.metadata or {})
            }
        )
        
        return {
            'sessionId': session.id,
            'url': session.url
        }
    except stripe.error.StripeError as e:
        print(f"❌ Stripe error: {str(e)}")
        print(f"❌ Stripe error type: {type(e).__name__}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}"
        )
    except Exception as e:
        print(f"💥 Unexpected error: {str(e)}")
        print(f"💥 Error type: {type(e).__name__}")
        import traceback
        print(f"💥 Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create checkout session: {str(e)}"
        )

@router.post("/create-subscription")
async def create_subscription(
    request: SubscriptionCreateRequest,
    current_user: Dict[str, Any] = Depends(require_auth)
):
    """
    Create a subscription directly with trial period
    """
    try:
        # Get or create customer
        customer_id = request.customerId or await get_or_create_stripe_customer(current_user)
        
        # Prepare subscription parameters
        subscription_params = {
            'customer': customer_id,
            'items': [{
                'price': request.priceId,
            }],
            'metadata': {
                'user_id': current_user['id'],
                'outlet_id': get_user_outlet_id(current_user),
                **(request.metadata or {})
            }
        }
        
        # Add trial period if specified
        if request.trialDays and request.trialDays > 0:
            subscription_params.update({
                'trial_period_days': request.trialDays,
                'trial_settings': {
                    'end_behavior': {
                        'missing_payment_method': 'cancel'
                    }
                }
            })
        else:
            # If no trial, payment method is required
            if not request.paymentMethodId:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Payment method required when no trial period is specified"
                )
            subscription_params['default_payment_method'] = request.paymentMethodId
        
        # Create subscription
        subscription = stripe.Subscription.create(**subscription_params)
        
        return {
            'subscription': format_subscription(subscription),
            'trial_end': subscription.trial_end if subscription.trial_end else None,
            'status': subscription.status
        }
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create subscription"
        )

@router.post("/create-setup-intent")
async def create_setup_intent(
    request: SetupIntentRequest,
    current_user: Dict[str, Any] = Depends(require_auth)
):
    """
    Create a setup intent for saving payment methods
    """
    try:
        customer_id = request.customerId or await get_or_create_stripe_customer(current_user)
        
        setup_intent = stripe.SetupIntent.create(
            customer=customer_id,
            payment_method_types=['card'],
            usage='off_session'
        )
        
        return {
            'id': setup_intent.id,
            'client_secret': setup_intent.client_secret,
            'status': setup_intent.status
        }
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create setup intent"
        )

@router.get("/customer/{customer_id}")
async def get_customer(
    customer_id: str,
    current_user: Dict[str, Any] = Depends(require_auth)
):
    """
    Get customer information with subscriptions
    """
    try:
        customer = stripe.Customer.retrieve(customer_id)
        subscriptions = stripe.Subscription.list(customer=customer_id)
        
        return {
            'id': customer.id,
            'email': customer.email,
            'name': customer.name,
            'subscriptions': [format_subscription(sub) for sub in subscriptions.data]
        }
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get customer"
        )

@router.get("/subscription/{subscription_id}")
async def get_subscription(
    subscription_id: str,
    current_user: Dict[str, Any] = Depends(require_auth)
):
    """
    Get subscription details
    """
    try:
        subscription = stripe.Subscription.retrieve(subscription_id)
        return format_subscription(subscription)
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get subscription"
        )

@router.post("/subscription/{subscription_id}/cancel")
async def cancel_subscription(
    subscription_id: str,
    current_user: Dict[str, Any] = Depends(require_auth)
):
    """
    Cancel a subscription
    """
    try:
        subscription = stripe.Subscription.modify(
            subscription_id,
            cancel_at_period_end=True
        )
        return format_subscription(subscription)
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel subscription"
        )

@router.post("/subscription/{subscription_id}/update")
async def update_subscription(
    subscription_id: str,
    request: SubscriptionUpdateRequest,
    current_user: Dict[str, Any] = Depends(require_auth)
):
    """
    Update subscription plan
    """
    try:
        subscription = stripe.Subscription.retrieve(subscription_id)
        
        updated_subscription = stripe.Subscription.modify(
            subscription_id,
            items=[{
                'id': subscription['items']['data'][0].id,
                'price': request.priceId,
            }],
            proration_behavior='immediate_with_remainder'
        )
        
        return format_subscription(updated_subscription)
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update subscription"
        )

@router.get("/customer/{customer_id}/payment-methods")
async def get_payment_methods(
    customer_id: str,
    current_user: Dict[str, Any] = Depends(require_auth)
):
    """
    Get customer's saved payment methods
    """
    try:
        payment_methods = stripe.PaymentMethod.list(
            customer=customer_id,
            type="card"
        )
        
        return {
            'payment_methods': [
                {
                    'id': pm.id,
                    'type': pm.type,
                    'card': {
                        'brand': pm.card.brand,
                        'last4': pm.card.last4,
                        'exp_month': pm.card.exp_month,
                        'exp_year': pm.card.exp_year
                    } if pm.card else None
                } for pm in payment_methods.data
            ]
        }
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get payment methods"
        )

@router.post("/webhook")
async def stripe_webhook(request: Request):
    """
    Handle Stripe webhook events
    """
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    endpoint_secret = os.getenv('STRIPE_WEBHOOK_SECRET')

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, endpoint_secret
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle the event
    if event['type'] == 'payment_intent.succeeded':
        payment_intent = event['data']['object']
        # Handle successful payment
        await handle_payment_success(payment_intent)
    elif event['type'] == 'customer.subscription.created':
        subscription = event['data']['object']
        # Handle new subscription
        await handle_subscription_created(subscription)
    elif event['type'] == 'customer.subscription.updated':
        subscription = event['data']['object']
        # Handle subscription update
        await handle_subscription_updated(subscription)
    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        # Handle subscription cancellation
        await handle_subscription_deleted(subscription)
    elif event['type'] == 'invoice.payment_failed':
        invoice = event['data']['object']
        # Handle failed payment
        await handle_payment_failed(invoice)

    return {'status': 'success'}

# Helper functions

async def get_or_create_stripe_customer(user: Dict[str, Any]) -> str:
    """
    Get or create a Stripe customer for the user
    """
    # Try to get existing customer ID from user metadata
    # This would typically be stored in your user database
    stripe_customer_id = user.get('stripe_customer_id')
    
    if stripe_customer_id:
        try:
            # Verify customer exists
            stripe.Customer.retrieve(stripe_customer_id)
            return stripe_customer_id
        except stripe.error.InvalidRequestError:
            # Customer doesn't exist, create new one
            pass
    
    # Create new customer
    customer = stripe.Customer.create(
        email=user.get('email'),
        name=user.get('name', ''),
        metadata={
            'user_id': user['id'],
            'outlet_id': get_user_outlet_id(user)
        }
    )
    
    # TODO: Save customer ID to user record in database
    # await update_user_stripe_customer_id(user['id'], customer.id)
    
    return customer.id

def format_subscription(subscription) -> Dict[str, Any]:
    """
    Format subscription data for API response
    """
    return {
        'id': subscription.id,
        'status': subscription.status,
        'current_period_start': subscription.current_period_start,
        'current_period_end': subscription.current_period_end,
        'cancel_at_period_end': subscription.cancel_at_period_end,
        'trial_start': subscription.trial_start if hasattr(subscription, 'trial_start') else None,
        'trial_end': subscription.trial_end if hasattr(subscription, 'trial_end') else None,
        'is_trial': subscription.status == 'trialing',
        'plan': {
            'id': subscription.items.data[0].price.id,
            'amount': subscription.items.data[0].price.unit_amount,
            'currency': subscription.items.data[0].price.currency,
            'interval': subscription.items.data[0].price.recurring.interval
        }
    }

async def handle_payment_success(payment_intent):
    """
    Handle successful payment webhook
    """
    # TODO: Update database with successful payment
    # This could include updating subscription status, sending confirmation emails, etc.
    pass

async def handle_subscription_created(subscription):
    """
    Handle new subscription webhook
    """
    # TODO: Update user's subscription status in database
    # Send welcome email, activate features, etc.
    pass

async def handle_subscription_updated(subscription):
    """
    Handle subscription update webhook
    """
    # TODO: Update subscription details in database
    pass

async def handle_subscription_deleted(subscription):
    """
    Handle subscription cancellation webhook
    """
    # TODO: Deactivate features, send cancellation email, etc.
    pass

async def handle_payment_failed(invoice):
    """
    Handle failed payment webhook
    """
    # TODO: Send payment failure notification, retry logic, etc.
    pass
