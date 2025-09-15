import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { api } from '../utils/api';

// Initialize Stripe
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 'pk_test_your_stripe_publishable_key');

type BookingDetails = {
  _id: string;
  bookingNumber: string;
  totalAmount: number;
  tickets: Array<{
    seat: {
      row: string;
      number: number;
      type: string;
      price: number;
    };
    ticketId: string;
  }>;
  movie: {
    title: string;
    poster: string;
  };
  theater: {
    name: string;
    address: string;
  };
  showDate: string;
  showTime: string;
  status: string;
};

type PaymentMethod = {
  id: string;
  name: string;
  description: string;
  icon: string;
};

const PaymentForm: React.FC<{ 
  bookingDetails: BookingDetails; 
  onPaymentSuccess: (bookingId: string) => void;
  onPaymentError: (error: string) => void;
}> = ({ bookingDetails, onPaymentSuccess, onPaymentError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [selectedMethod, setSelectedMethod] = useState<string>('card');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Fetch available payment methods
    const fetchPaymentMethods = async () => {
      try {
        const response = await api.get('/payments/payment-methods');
        setPaymentMethods(response.data.paymentMethods);
      } catch (err) {
        console.error('Error fetching payment methods:', err);
      }
    };
    fetchPaymentMethods();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError('');

    try {
      // Create payment intent
      const response = await api.post('/payments/create-payment-intent', {
        bookingId: bookingDetails._id,
        amount: bookingDetails.totalAmount
      });

      const { clientSecret } = response.data;

      if (selectedMethod === 'card') {
        const cardElement = elements.getElement(CardElement);
        
        if (!cardElement) {
          throw new Error('Card element not found');
        }

        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: 'Customer Name', // You can get this from user profile
            },
          },
        });

        if (error) {
          throw new Error(error.message);
        }

        if (paymentIntent.status === 'succeeded') {
          // Confirm payment on backend
          await api.post('/payments/confirm-payment', {
            paymentIntentId: paymentIntent.id,
            bookingId: bookingDetails._id
          });

          onPaymentSuccess(bookingDetails._id);
        }
      } else {
        // Handle other payment methods (UPI, Net Banking, etc.)
        // For now, we'll simulate success for non-card payments
        setTimeout(() => {
          onPaymentSuccess(bookingDetails._id);
        }, 2000);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Payment failed';
      setError(errorMessage);
      onPaymentError(errorMessage);
    } finally {
      setProcessing(false);
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
  };

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto' }}>
      <div className="card" style={{ padding: '30px' }}>
        <h2 style={{ 
          textAlign: 'center', 
          marginBottom: '30px',
          color: '#333',
          fontSize: '24px',
          fontWeight: 'bold'
        }}>
          💳 Payment Details
        </h2>

        {/* Payment Methods */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ marginBottom: '15px', fontSize: '16px', fontWeight: '600' }}>
            Select Payment Method
          </h3>
          <div style={{ display: 'grid', gap: '10px' }}>
            {paymentMethods.map((method) => (
              <label
                key={method.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '15px',
                  border: selectedMethod === method.id ? '2px solid #e50914' : '1px solid #ddd',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  backgroundColor: selectedMethod === method.id ? '#fff5f5' : 'white',
                  transition: 'all 0.2s ease'
                }}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={method.id}
                  checked={selectedMethod === method.id}
                  onChange={(e) => setSelectedMethod(e.target.value)}
                  style={{ marginRight: '12px' }}
                />
                <div>
                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                    {method.name}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    {method.description}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Card Payment Form */}
        {selectedMethod === 'card' && (
          <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '600',
                fontSize: '14px'
              }}>
                Card Details
              </label>
              <div style={{
                padding: '15px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                backgroundColor: 'white'
              }}>
                <CardElement options={cardElementOptions} />
              </div>
            </div>

            {error && (
              <div style={{
                padding: '12px',
                backgroundColor: '#fee',
                border: '1px solid #fcc',
                borderRadius: '6px',
                color: '#c33',
                marginBottom: '20px',
                fontSize: '14px'
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!stripe || processing}
              style={{
                width: '100%',
                padding: '15px',
                backgroundColor: processing ? '#ccc' : '#e50914',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: processing ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s ease'
              }}
            >
              {processing ? 'Processing...' : `Pay ₹${bookingDetails.totalAmount}`}
            </button>
          </form>
        )}

        {/* Other Payment Methods */}
        {selectedMethod !== 'card' && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '15px' }}>
              {selectedMethod === 'upi' ? '📱' : selectedMethod === 'wallet' ? '💳' : '🏦'}
            </div>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              {selectedMethod === 'upi' && 'Redirecting to UPI payment...'}
              {selectedMethod === 'wallet' && 'Redirecting to digital wallet...'}
              {selectedMethod === 'netbanking' && 'Redirecting to net banking...'}
            </p>
            <button
              onClick={handleSubmit}
              disabled={processing}
              style={{
                padding: '15px 30px',
                backgroundColor: processing ? '#ccc' : '#e50914',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: processing ? 'not-allowed' : 'pointer'
              }}
            >
              {processing ? 'Processing...' : `Pay ₹${bookingDetails.totalAmount}`}
            </button>
          </div>
        )}

        {/* Security Notice */}
        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#666',
          textAlign: 'center'
        }}>
          🔒 Your payment information is secure and encrypted
        </div>
      </div>
    </div>
  );
};

const Payment: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('bookingId');
  
  const [bookingDetails, setBookingDetails] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!bookingId) {
      setError('No booking ID provided');
      setLoading(false);
      return;
    }

    const fetchBookingDetails = async () => {
      try {
        const response = await api.get(`/bookings/${bookingId}`);
        setBookingDetails(response.data.booking);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load booking details');
      } finally {
        setLoading(false);
      }
    };

    fetchBookingDetails();
  }, [bookingId]);

  const handlePaymentSuccess = (bookingId: string) => {
    // Redirect to success page
    navigate(`/booking-success?bookingId=${bookingId}`);
  };

  const handlePaymentError = (error: string) => {
    setError(error);
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px',
        flexDirection: 'column'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>💳</div>
        <div>Loading payment details...</div>
      </div>
    );
  }

  if (error || !bookingDetails) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px',
        flexDirection: 'column'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>❌</div>
        <div style={{ color: '#e50914', marginBottom: '20px' }}>{error}</div>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#e50914',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '30px' }}>
        <button 
          onClick={() => navigate(-1)}
          style={{ 
            background: 'transparent', 
            border: 'none', 
            fontSize: '20px', 
            cursor: 'pointer',
            marginBottom: '20px'
          }}
        >
          ← Back
        </button>
        <h1 style={{ 
          fontSize: '32px', 
          fontWeight: 'bold', 
          margin: '0 0 10px 0',
          color: '#333'
        }}>
          Complete Your Payment
        </h1>
        <p style={{ color: '#666', fontSize: '16px' }}>
          Booking #{bookingDetails.bookingNumber}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
        {/* Booking Summary */}
        <div>
          <div className="card" style={{ padding: '25px' }}>
            <h2 style={{ 
              marginBottom: '20px', 
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#333'
            }}>
              🎬 Booking Summary
            </h2>
            
            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
              <img 
                src={bookingDetails.movie.poster} 
                alt={bookingDetails.movie.title}
                style={{ 
                  width: '80px', 
                  height: '120px', 
                  objectFit: 'cover',
                  borderRadius: '8px'
                }}
              />
              <div style={{ flex: 1 }}>
                <h3 style={{ 
                  margin: '0 0 8px 0', 
                  fontSize: '18px',
                  fontWeight: 'bold'
                }}>
                  {bookingDetails.movie.title}
                </h3>
                <p style={{ color: '#666', margin: '0 0 5px 0' }}>
                  {bookingDetails.theater.name}
                </p>
                <p style={{ color: '#666', margin: '0 0 5px 0' }}>
                  {new Date(bookingDetails.showDate).toLocaleDateString()} at {bookingDetails.showTime}
                </p>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #eee', paddingTop: '20px' }}>
              <h4 style={{ marginBottom: '15px', fontSize: '16px', fontWeight: '600' }}>
                Selected Seats
              </h4>
              <div style={{ display: 'grid', gap: '8px', marginBottom: '20px' }}>
                {bookingDetails.tickets.map((ticket, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '6px'
                  }}>
                    <span style={{ fontWeight: '500' }}>
                      {ticket.seat.row}{ticket.seat.number} ({ticket.seat.type})
                    </span>
                    <span style={{ color: '#e50914', fontWeight: 'bold' }}>
                      ₹{ticket.seat.price}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '15px',
                backgroundColor: '#e50914',
                color: 'white',
                borderRadius: '8px',
                fontSize: '18px',
                fontWeight: 'bold'
              }}>
                <span>Total Amount</span>
                <span>₹{bookingDetails.totalAmount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Form */}
        <div>
          <Elements stripe={stripePromise}>
            <PaymentForm 
              bookingDetails={bookingDetails}
              onPaymentSuccess={handlePaymentSuccess}
              onPaymentError={handlePaymentError}
            />
          </Elements>
        </div>
      </div>
    </div>
  );
};

export default Payment;
