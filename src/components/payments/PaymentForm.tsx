import React, { useState } from 'react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripePromise } from '@/lib/stripe';
import stripeService from '@/lib/stripeService';
import { Loader2, CreditCard, Lock } from 'lucide-react';

interface PaymentFormProps {
  amount: number;
  onSuccess: (paymentIntent: any) => void;
  onError: (error: string) => void;
  buttonText?: string;
  description?: string;
}

const PaymentFormContent: React.FC<PaymentFormProps> = ({
  amount,
  onSuccess,
  onError,
  buttonText = 'Pay Now',
  description
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [paymentIntent, setPaymentIntent] = useState<any>(null);

  // Create payment intent when component mounts
  React.useEffect(() => {
    const createPaymentIntent = async () => {
      try {
        const intent = await stripeService.createPaymentIntent(amount);
        setPaymentIntent(intent);
      } catch (error) {
        onError('Failed to initialize payment');
      }
    };

    if (amount > 0) {
      createPaymentIntent();
    }
  }, [amount, onError]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !paymentIntent) {
      return;
    }

    setLoading(true);

    const cardElement = elements.getElement(CardElement);

    if (!cardElement) {
      setLoading(false);
      onError('Card element not found');
      return;
    }

    try {
      const { error, paymentIntent: confirmedPaymentIntent } = await stripe.confirmCardPayment(
        paymentIntent.client_secret,
        {
          payment_method: {
            card: cardElement,
          },
        }
      );

      if (error) {
        onError(error.message || 'Payment failed');
      } else if (confirmedPaymentIntent?.status === 'succeeded') {
        onSuccess(confirmedPaymentIntent);
      }
    } catch (error) {
      onError('Payment processing failed');
    } finally {
      setLoading(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#9e2146',
      },
    },
    hidePostalCode: false,
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {description && (
        <div className="text-center">
          <p className="text-gray-600 font-light">{description}</p>
          <p className="text-2xl font-light text-gray-900 mt-2">
            {stripeService.formatCurrency(amount)}
          </p>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center mb-3">
          <CreditCard className="w-5 h-5 text-gray-400 mr-2" />
          <span className="text-sm font-medium text-gray-900">Card Information</span>
        </div>
        <CardElement options={cardElementOptions} />
      </div>

      <button
        type="submit"
        disabled={!stripe || loading || !paymentIntent}
        className="w-full bg-gray-900 text-white py-4 px-6 rounded-xl font-medium text-sm hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Lock className="w-4 h-4 mr-2" />
            {buttonText}
          </>
        )}
      </button>

      <div className="text-center">
        <p className="text-xs text-gray-500 font-light">
          Your payment information is secure and encrypted
        </p>
      </div>
    </form>
  );
};

const PaymentForm: React.FC<PaymentFormProps> = (props) => {
  return (
    <Elements stripe={stripePromise}>
      <PaymentFormContent {...props} />
    </Elements>
  );
};

export default PaymentForm;
