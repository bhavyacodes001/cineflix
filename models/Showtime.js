const mongoose = require('mongoose');

const showtimeSchema = new mongoose.Schema({
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
  hall: {
    name: {
      type: String,
      required: [true, 'Hall name is required']
    },
    hallId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    }
  },
  date: {
    type: Date,
    required: [true, 'Show date is required']
  },
  time: {
    type: String,
    required: [true, 'Show time is required'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format']
  },
  endTime: {
    type: String,
    required: [true, 'End time is required'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be in HH:MM format']
  },
  price: {
    regular: {
      type: Number,
      required: [true, 'Regular price is required'],
      min: [0, 'Price cannot be negative']
    },
    premium: {
      type: Number,
      required: [true, 'Premium price is required'],
      min: [0, 'Price cannot be negative']
    },
    vip: {
      type: Number,
      required: [true, 'VIP price is required'],
      min: [0, 'Price cannot be negative']
    }
  },
  availableSeats: {
    regular: {
      type: Number,
      default: 0
    },
    premium: {
      type: Number,
      default: 0
    },
    vip: {
      type: Number,
      default: 0
    },
    wheelchair: {
      type: Number,
      default: 0
    }
  },
  bookedSeats: [{
    row: String,
    number: Number,
    type: {
      type: String,
      enum: ['regular', 'premium', 'vip', 'wheelchair']
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    }
  }],
  status: {
    type: String,
    enum: ['scheduled', 'cancelled', 'completed'],
    default: 'scheduled'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  specialNotes: String,
  cinemaApiId: {
    type: String,
    unique: true,
    sparse: true
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
showtimeSchema.index({ movie: 1, theater: 1, date: 1, time: 1 });
showtimeSchema.index({ theater: 1, date: 1 });
showtimeSchema.index({ date: 1, time: 1 });
showtimeSchema.index({ status: 1, isActive: 1 });

// Virtual for full datetime
showtimeSchema.virtual('fullDateTime').get(function() {
  const showDate = new Date(this.date);
  const [hours, minutes] = this.time.split(':');
  showDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  return showDate;
});

// Virtual for end datetime
showtimeSchema.virtual('endDateTime').get(function() {
  const endDate = new Date(this.date);
  const [hours, minutes] = this.endTime.split(':');
  endDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  return endDate;
});

// Method to check if showtime is in the past
showtimeSchema.methods.isPast = function() {
  return this.fullDateTime < new Date();
};

// Method to check if showtime is today
showtimeSchema.methods.isToday = function() {
  const today = new Date();
  const showDate = new Date(this.date);
  return showDate.toDateString() === today.toDateString();
};

// Method to get available seats count
showtimeSchema.methods.getAvailableSeatsCount = function() {
  return Object.values(this.availableSeats).reduce((total, count) => total + count, 0);
};

// Method to check if seat is available
showtimeSchema.methods.isSeatAvailable = function(row, number) {
  return !this.bookedSeats.some(seat => seat.row === row && seat.number === number);
};

// Atomic seat booking — uses findOneAndUpdate to prevent race conditions
showtimeSchema.statics.bookSeatAtomic = async function(showtimeId, row, number, type, bookingId) {
  const availableKey = `availableSeats.${type}`;
  const result = await this.findOneAndUpdate(
    {
      _id: showtimeId,
      [availableKey]: { $gt: 0 },
      'bookedSeats': { $not: { $elemMatch: { row, number } } }
    },
    {
      $push: { bookedSeats: { row, number, type, bookingId } },
      $inc: { [availableKey]: -1 }
    },
    { new: true }
  );
  if (!result) {
    throw new Error('Seat is already booked or unavailable');
  }
  return result;
};

// Instance method kept for backward compatibility — delegates to atomic version
showtimeSchema.methods.bookSeat = async function(row, number, type, bookingId) {
  return this.constructor.bookSeatAtomic(this._id, row, number, type, bookingId);
};

// Atomic seat release
showtimeSchema.statics.releaseSeatAtomic = async function(showtimeId, row, number) {
  const showtime = await this.findById(showtimeId);
  if (!showtime) throw new Error('Showtime not found');
  
  const seat = showtime.bookedSeats.find(s => s.row === row && s.number === number);
  if (!seat) throw new Error('Seat not found in booked seats');
  
  const availableKey = `availableSeats.${seat.type}`;
  const result = await this.findOneAndUpdate(
    {
      _id: showtimeId,
      'bookedSeats': { $elemMatch: { row, number } }
    },
    {
      $pull: { bookedSeats: { row, number } },
      $inc: { [availableKey]: 1 }
    },
    { new: true }
  );
  if (!result) throw new Error('Failed to release seat');
  return result;
};

// Instance method kept for backward compatibility
showtimeSchema.methods.releaseSeat = async function(row, number) {
  return this.constructor.releaseSeatAtomic(this._id, row, number);
};

module.exports = mongoose.model('Showtime', showtimeSchema);
