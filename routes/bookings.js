const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Booking = require('../models/Booking');
const Showtime = require('../models/Showtime');
const Movie = require('../models/Movie');
const Theater = require('../models/Theater');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/bookings
// @desc    Create a new booking
// @access  Private
router.post('/', auth, [
  body('showtimeId').isMongoId().withMessage('Valid showtime ID is required'),
  body('seats').isArray({ min: 1 }).withMessage('At least one seat must be selected'),
  body('seats.*.row').trim().isLength({ min: 1 }).withMessage('Seat row is required'),
  body('seats.*.number').isInt({ min: 1 }).withMessage('Valid seat number is required'),
  body('seats.*.type').isIn(['regular', 'premium', 'vip', 'wheelchair']).withMessage('Invalid seat type'),
  body('paymentMethod').isIn(['card', 'wallet', 'upi', 'netbanking']).withMessage('Invalid payment method')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { showtimeId, seats, paymentMethod, specialRequests } = req.body;

    // Get showtime with populated data
    const showtime = await Showtime.findById(showtimeId)
      .populate('movie', 'title poster duration')
      .populate('theater', 'name address.city address.state');
    
    if (!showtime) {
      return res.status(404).json({ 
        message: 'Showtime not found' 
      });
    }

    if (!showtime.isActive || showtime.status !== 'scheduled') {
      return res.status(400).json({ 
        message: 'Showtime is not available for booking' 
      });
    }

    // Check if showtime is in the past
    if (showtime.isPast()) {
      return res.status(400).json({ 
        message: 'Cannot book tickets for past showtimes' 
      });
    }

    // Validate seats and calculate total amount
    let totalAmount = 0;
    const validatedSeats = [];

    for (const seat of seats) {
      // Check if seat is available
      if (!showtime.isSeatAvailable(seat.row, seat.number)) {
        return res.status(400).json({ 
          message: `Seat ${seat.row}${seat.number} is not available` 
        });
      }

      // Get seat price
      const seatPrice = showtime.price[seat.type];
      if (!seatPrice) {
        return res.status(400).json({ 
          message: `Invalid seat type: ${seat.type}` 
        });
      }

      // Check if seat type is available
      if (showtime.availableSeats[seat.type] <= 0) {
        return res.status(400).json({ 
          message: `No ${seat.type} seats available` 
        });
      }

      validatedSeats.push({
        seat: {
          row: seat.row,
          number: seat.number,
          type: seat.type,
          price: seatPrice
        }
      });

      totalAmount += seatPrice;
    }

    // Create booking
    const bookingData = {
      user: req.user.userId,
      showtime: showtimeId,
      movie: showtime.movie._id,
      theater: showtime.theater._id,
      tickets: validatedSeats,
      totalAmount,
      payment: {
        method: paymentMethod,
        transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
        status: 'pending'
      },
      showDate: showtime.date,
      showTime: showtime.time,
      specialRequests
    };

    const booking = new Booking(bookingData);
    await booking.save();

    // Populate booking data
    await booking.populate([
      { path: 'movie', select: 'title poster duration' },
      { path: 'theater', select: 'name address.city address.state' },
      { path: 'showtime', select: 'date time endTime' }
    ]);

    res.status(201).json({
      message: 'Booking created successfully. Please complete payment to confirm.',
      booking,
      paymentRequired: true
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ 
      message: 'Server error while creating booking' 
    });
  }
});

// @route   GET /api/bookings
// @desc    Get user's bookings
// @access  Private
router.get('/', auth, [
  query('status').optional().isIn(['pending', 'confirmed', 'cancelled', 'expired', 'completed']).withMessage('Invalid status'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = { user: req.user.userId };
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const bookings = await Booking.find(filter)
      .populate('movie', 'title poster')
      .populate('theater', 'name address.city')
      .populate('showtime', 'date time')
      .sort({ bookingDate: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Booking.countDocuments(filter);

    res.json({
      bookings,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalBookings: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ 
      message: 'Server error while fetching bookings' 
    });
  }
});

// @route   GET /api/bookings/:id
// @desc    Get booking by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('movie', 'title poster duration rating genre')
      .populate('theater', 'name address contact')
      .populate('showtime', 'date time endTime hall')
      .populate('user', 'firstName lastName email phone');

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

    res.json({ booking });
  } catch (error) {
    console.error('Get booking error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: 'Invalid booking ID' 
      });
    }
    res.status(500).json({ 
      message: 'Server error while fetching booking' 
    });
  }
});

// @route   PUT /api/bookings/:id/cancel
// @desc    Cancel booking
// @access  Private
router.put('/:id/cancel', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('showtime')
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

    // Check if booking can be cancelled
    if (!booking.canBeCancelled()) {
      return res.status(400).json({ 
        message: 'Booking cannot be cancelled at this time' 
      });
    }

    // Cancel booking
    await booking.cancelBooking(req.user.role === 'admin' ? 'admin' : 'user');

    // Release seats in showtime
    for (const ticket of booking.tickets) {
      await booking.showtime.releaseSeat(ticket.seat.row, ticket.seat.number);
    }

    res.json({
      message: 'Booking cancelled successfully',
      refundAmount: booking.cancellation.refundAmount,
      booking
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: 'Invalid booking ID' 
      });
    }
    res.status(500).json({ 
      message: 'Server error while cancelling booking' 
    });
  }
});

// @route   GET /api/bookings/booking-number/:bookingNumber
// @desc    Get booking by booking number
// @access  Public (for ticket verification)
router.get('/booking-number/:bookingNumber', async (req, res) => {
  try {
    const booking = await Booking.findOne({ bookingNumber: req.params.bookingNumber })
      .populate('movie', 'title poster duration')
      .populate('theater', 'name address')
      .populate('showtime', 'date time hall')
      .populate('user', 'firstName lastName email');

    if (!booking) {
      return res.status(404).json({ 
        message: 'Booking not found' 
      });
    }

    // Only return basic info for public access
    res.json({
      booking: {
        bookingNumber: booking.bookingNumber,
        movie: booking.movie,
        theater: booking.theater,
        showtime: booking.showtime,
        tickets: booking.tickets,
        status: booking.status,
        bookingDate: booking.bookingDate,
        showDate: booking.showDate,
        showTime: booking.showTime
      }
    });
  } catch (error) {
    console.error('Get booking by number error:', error);
    res.status(500).json({ 
      message: 'Server error while fetching booking' 
    });
  }
});

// @route   GET /api/bookings/admin/all
// @desc    Get all bookings (Admin only)
// @access  Private (Admin)
router.get('/admin/all', auth, adminAuth, [
  query('status').optional().isIn(['pending', 'confirmed', 'cancelled', 'expired', 'completed']).withMessage('Invalid status'),
  query('theaterId').optional().isMongoId().withMessage('Invalid theater ID'),
  query('movieId').optional().isMongoId().withMessage('Invalid movie ID'),
  query('date').optional().isISO8601().withMessage('Invalid date format'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.theaterId) filter.theater = req.query.theaterId;
    if (req.query.movieId) filter.movie = req.query.movieId;
    if (req.query.date) {
      const searchDate = new Date(req.query.date);
      const nextDay = new Date(searchDate);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.showDate = { $gte: searchDate, $lt: nextDay };
    }

    const bookings = await Booking.find(filter)
      .populate('user', 'firstName lastName email phone')
      .populate('movie', 'title poster')
      .populate('theater', 'name address.city')
      .populate('showtime', 'date time')
      .sort({ bookingDate: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Booking.countDocuments(filter);

    res.json({
      bookings,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalBookings: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get all bookings error:', error);
    res.status(500).json({ 
      message: 'Server error while fetching bookings' 
    });
  }
});

module.exports = router;
