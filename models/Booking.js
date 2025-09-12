const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  seat: {
    row: {
      type: String,
      required: true
    },
    number: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      enum: ['regular', 'premium', 'vip', 'wheelchair'],
      required: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    }
  },
  ticketId: {
    type: String,
    unique: true,
    required: true
  }
});

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  showtime: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Showtime',
    required: [true, 'Showtime is required']
  },
  movie: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie',
    required: [true, 'Movie is required']
  },
  theater: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Theater',
    required: [true, 'Theater is required']
  },
  tickets: [ticketSchema],
  bookingNumber: {
    type: String,
    unique: true,
    required: true
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  payment: {
    method: {
      type: String,
      enum: ['card', 'wallet', 'upi', 'netbanking'],
      required: true
    },
    transactionId: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    stripePaymentIntentId: String,
    paidAt: Date
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'expired', 'completed'],
    default: 'pending'
  },
  bookingDate: {
    type: Date,
    default: Date.now
  },
  showDate: {
    type: Date,
    required: [true, 'Show date is required']
  },
  showTime: {
    type: String,
    required: [true, 'Show time is required']
  },
  cancellation: {
    isCancelled: {
      type: Boolean,
      default: false
    },
    cancelledAt: Date,
    cancelledBy: {
      type: String,
      enum: ['user', 'admin', 'system']
    },
    refundAmount: {
      type: Number,
      default: 0
    },
    refundStatus: {
      type: String,
      enum: ['pending', 'processed', 'failed'],
      default: 'pending'
    },
    refundTransactionId: String
  },
  notifications: {
    bookingConfirmation: {
      sent: { type: Boolean, default: false },
      sentAt: Date
    },
    reminder: {
      sent: { type: Boolean, default: false },
      sentAt: Date
    },
    cancellation: {
      sent: { type: Boolean, default: false },
      sentAt: Date
    }
  },
  specialRequests: String,
  qrCode: String
}, {
  timestamps: true
});

// Indexes for efficient queries
bookingSchema.index({ user: 1, bookingDate: -1 });
bookingSchema.index({ bookingNumber: 1 });
bookingSchema.index({ showtime: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ 'payment.transactionId': 1 });

// Generate unique booking number
bookingSchema.pre('save', async function(next) {
  if (!this.bookingNumber) {
    const count = await mongoose.model('Booking').countDocuments();
    this.bookingNumber = `BK${Date.now()}${String(count + 1).padStart(4, '0')}`;
  }
  
  // Generate unique ticket IDs
  if (this.tickets && this.tickets.length > 0) {
    this.tickets.forEach((ticket, index) => {
      if (!ticket.ticketId) {
        ticket.ticketId = `TK${this.bookingNumber}${String(index + 1).padStart(2, '0')}`;
      }
    });
  }
  
  next();
});

// Virtual for total tickets count
bookingSchema.virtual('ticketCount').get(function() {
  return this.tickets.length;
});

// Virtual for formatted booking date
bookingSchema.virtual('formattedBookingDate').get(function() {
  return this.bookingDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Virtual for formatted show date
bookingSchema.virtual('formattedShowDate').get(function() {
  return this.showDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Method to check if booking can be cancelled
bookingSchema.methods.canBeCancelled = function() {
  if (this.status === 'cancelled' || this.status === 'completed') {
    return false;
  }
  
  const showDateTime = new Date(this.showDate);
  const [hours, minutes] = this.showTime.split(':');
  showDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  
  const now = new Date();
  const timeDifference = showDateTime - now;
  const hoursUntilShow = timeDifference / (1000 * 60 * 60);
  
  // Allow cancellation up to 2 hours before show
  return hoursUntilShow > 2;
};

// Method to calculate refund amount
bookingSchema.methods.calculateRefundAmount = function() {
  if (!this.canBeCancelled()) {
    return 0;
  }
  
  const showDateTime = new Date(this.showDate);
  const [hours, minutes] = this.showTime.split(':');
  showDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  
  const now = new Date();
  const timeDifference = showDateTime - now;
  const hoursUntilShow = timeDifference / (1000 * 60 * 60);
  
  // Full refund if cancelled more than 24 hours before show
  if (hoursUntilShow > 24) {
    return this.totalAmount;
  }
  
  // 50% refund if cancelled between 2-24 hours before show
  if (hoursUntilShow > 2) {
    return this.totalAmount * 0.5;
  }
  
  return 0;
};

// Method to cancel booking
bookingSchema.methods.cancelBooking = function(cancelledBy = 'user') {
  if (!this.canBeCancelled()) {
    throw new Error('Booking cannot be cancelled');
  }
  
  this.status = 'cancelled';
  this.cancellation.isCancelled = true;
  this.cancellation.cancelledAt = new Date();
  this.cancellation.cancelledBy = cancelledBy;
  this.cancellation.refundAmount = this.calculateRefundAmount();
  
  return this.save();
};

module.exports = mongoose.model('Booking', bookingSchema);
