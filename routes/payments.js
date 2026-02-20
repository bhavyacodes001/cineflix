const express = require('express');
const { body, validationResult } = require('express-validator');
const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  console.warn('WARNING: STRIPE_SECRET_KEY not set. Payment endpoints will return errors.');
}
const stripe = stripeKey ? require('stripe')(stripeKey) : null;
const Booking = require('../models/Booking');
const Showtime = require('../models/Showtime');
const { auth } = require('../middleware/auth');

const router = express.Router();

const requireStripe = (req, res, next) => {
  if (!stripe) {
    return res.status(503).json({ message: 'Payment service unavailable. Stripe is not configured.' });
  }
  next();
};

// @route   POST /api/payments/create-payment-intent
// @desc    Create Stripe payment intent
// @access  Private
router.post('/create-payment-intent', auth, requireStripe, [
  body('bookingId').isMongoId().withMessage('Valid booking ID is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { bookingId, amount } = req.body;

    // Get booking
    const booking = await Booking.findById(bookingId)
      .populate('user', 'firstName lastName email')
      .populate('movie', 'title')
      .populate('theater', 'name');

    if (!booking) {
      return res.status(404).json({ 
        message: 'Booking not found' 
      });
    }

    // Check if user owns the booking
    if (booking.user._id.toString() !== req.user.userId) {
      return res.status(403).json({ 
        message: 'Access denied' 
      });
    }

    // Check if booking is still pending
    if (booking.status !== 'pending') {
      return res.status(400).json({ 
        message: 'Booking is not in pending status' 
      });
    }

    // Verify amount matches booking total
    if (Math.abs(amount - booking.totalAmount) > 0.01) {
      return res.status(400).json({ 
        message: 'Amount does not match booking total' 
      });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        bookingId: bookingId,
        userId: req.user.userId,
        movieTitle: booking.movie.title,
        theaterName: booking.theater.name
      },
      description: `Movie ticket booking for ${booking.movie.title} at ${booking.theater.name}`,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Update booking with payment intent ID
    booking.payment.stripePaymentIntentId = paymentIntent.id;
    await booking.save();

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ 
      message: 'Server error while creating payment intent' 
    });
  }
});

// @route   POST /api/payments/confirm-payment
// @desc    Confirm payment and update booking status
// @access  Private
router.post('/confirm-payment', auth, requireStripe, [
  body('paymentIntentId').isString().withMessage('Payment intent ID is required'),
  body('bookingId').isMongoId().withMessage('Valid booking ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { paymentIntentId, bookingId } = req.body;

    // Get booking
    const booking = await Booking.findById(bookingId)
      .populate('showtime')
      .populate('user', 'firstName lastName email');

    if (!booking) {
      return res.status(404).json({ 
        message: 'Booking not found' 
      });
    }

    // Check if user owns the booking
    if (booking.user._id.toString() !== req.user.userId) {
      return res.status(403).json({ 
        message: 'Access denied' 
      });
    }

    // Verify payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ 
        message: 'Payment not completed' 
      });
    }

    // Update booking status (seats are already reserved at booking creation time)
    booking.status = 'confirmed';
    booking.payment.status = 'completed';
    booking.payment.transactionId = paymentIntent.id;
    booking.payment.paidAt = new Date();

    await booking.save();

    // TODO: Send confirmation email
    // await sendBookingConfirmationEmail(booking);

    res.json({
      message: 'Payment confirmed and booking completed successfully',
      booking
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ 
      message: 'Server error while confirming payment' 
    });
  }
});

// @route   POST /api/payments/refund
// @desc    Process refund for cancelled booking
// @access  Private
router.post('/refund', auth, requireStripe, [
  body('bookingId').isMongoId().withMessage('Valid booking ID is required'),
  body('amount').optional().isFloat({ min: 0 }).withMessage('Amount must be non-negative')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { bookingId, amount } = req.body;

    // Get booking
    const booking = await Booking.findById(bookingId)
      .populate('user', 'firstName lastName email');

    if (!booking) {
      return res.status(404).json({ 
        message: 'Booking not found' 
      });
    }

    // Check if user owns the booking or is admin
    if (booking.user._id.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Access denied' 
      });
    }

    // Check if booking is cancelled
    if (!booking.cancellation.isCancelled) {
      return res.status(400).json({ 
        message: 'Booking is not cancelled' 
      });
    }

    // Check if already refunded
    if (booking.cancellation.refundStatus === 'processed') {
      return res.status(400).json({ 
        message: 'Refund already processed' 
      });
    }

    const refundAmount = amount || booking.cancellation.refundAmount;

    if (refundAmount <= 0) {
      return res.status(400).json({ 
        message: 'No refund amount available' 
      });
    }

    // Process refund with Stripe
    const refund = await stripe.refunds.create({
      payment_intent: booking.payment.stripePaymentIntentId,
      amount: Math.round(refundAmount * 100), // Convert to cents
      reason: 'requested_by_customer',
      metadata: {
        bookingId: bookingId,
        reason: 'booking_cancellation'
      }
    });

    // Update booking refund status
    booking.cancellation.refundStatus = 'processed';
    booking.cancellation.refundTransactionId = refund.id;
    await booking.save();

    res.json({
      message: 'Refund processed successfully',
      refund: {
        id: refund.id,
        amount: refundAmount,
        status: refund.status
      }
    });
  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({ 
      message: 'Server error while processing refund' 
    });
  }
});

// @route   GET /api/payments/payment-methods
// @desc    Get available payment methods
// @access  Public
router.get('/payment-methods', (req, res) => {
  const paymentMethods = [
    {
      id: 'card',
      name: 'Credit/Debit Card',
      description: 'Visa, Mastercard, American Express',
      icon: 'credit-card'
    },
    {
      id: 'wallet',
      name: 'Digital Wallet',
      description: 'Apple Pay, Google Pay, Samsung Pay',
      icon: 'smartphone'
    },
    {
      id: 'upi',
      name: 'UPI',
      description: 'PhonePe, Google Pay, Paytm',
      icon: 'qr-code'
    },
    {
      id: 'netbanking',
      name: 'Net Banking',
      description: 'Direct bank transfer',
      icon: 'bank'
    }
  ];

  res.json({ paymentMethods });
});

// @route   POST /api/payments/webhook
// @desc    Stripe webhook handler
// @access  Public (Stripe webhook)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('Payment succeeded:', paymentIntent.id);
      
      // Update booking status if needed
      try {
        const booking = await Booking.findOne({
          'payment.stripePaymentIntentId': paymentIntent.id
        });
        
        if (booking && booking.status === 'pending') {
          booking.status = 'confirmed';
          booking.payment.status = 'completed';
          booking.payment.paidAt = new Date();
          await booking.save();
        }
      } catch (error) {
        console.error('Error updating booking from webhook:', error);
      }
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log('Payment failed:', failedPayment.id);
      
      // Update booking status if needed
      try {
        const booking = await Booking.findOne({
          'payment.stripePaymentIntentId': failedPayment.id
        });
        
        if (booking && booking.status === 'pending') {
          booking.payment.status = 'failed';
          await booking.save();
        }
      } catch (error) {
        console.error('Error updating booking from webhook:', error);
      }
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

// @route   GET /api/payments/booking/:bookingId/status
// @desc    Get payment status for a booking
// @access  Private
router.get('/booking/:bookingId/status', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId)
      .select('payment status bookingNumber user');

    if (!booking) {
      return res.status(404).json({ 
        message: 'Booking not found' 
      });
    }

    // Check if user owns the booking
    if (booking.user.toString() !== req.user.userId) {
      return res.status(403).json({ 
        message: 'Access denied' 
      });
    }

    res.json({
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      paymentStatus: booking.payment.status,
      paidAt: booking.payment.paidAt
    });
  } catch (error) {
    console.error('Get payment status error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: 'Invalid booking ID' 
      });
    }
    res.status(500).json({ 
      message: 'Server error while fetching payment status' 
    });
  }
});

module.exports = router;
