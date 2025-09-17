const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Booking = require('../models/Booking');
const Showtime = require('../models/Showtime');
const Movie = require('../models/Movie');
const Theater = require('../models/Theater');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// In-memory store for dummy bookings (in production, this would be in database)
const dummyBookings = new Map();

// @route   POST /api/bookings
// @desc    Create a new booking
// @access  Private
router.post('/', auth, [
  body('showtimeId').custom((value) => {
    // Allow MongoDB ObjectId format or dummy IDs for testing
    if (value.startsWith('dummy-') || /^[a-f0-9]{24}$/i.test(value)) {
      return true;
    }
    throw new Error('Valid showtime ID is required');
  }),
  body('seats').isArray({ min: 1, max: 10 }).withMessage('You can book between 1 and 10 tickets at a time'),
  body('seats.*.row').custom((value) => {
    if (!value || typeof value !== 'string' || value.trim().length === 0) {
      throw new Error('Seat row is required');
    }
    return true;
  }),
  body('seats.*.number').custom((value) => {
    const num = parseInt(value);
    if (isNaN(num) || num < 1) {
      throw new Error('Valid seat number is required');
    }
    return true;
  }),
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

            const { showtimeId, seats, paymentMethod, specialRequests, movieData } = req.body;

    let showtime;
    
            // Handle dummy showtime IDs for testing
            if (showtimeId.startsWith('dummy-')) {
              const showDate = new Date();
              const showTime = '14:30';
              const endTime = '16:45';
              
              showtime = {
                _id: showtimeId,
                movie: { 
                  _id: 'dummy-movie', 
                  title: movieData?.title || 'Selected Movie', 
                  poster: movieData?.poster || 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=1200&auto=format&fit=crop', 
                  duration: movieData?.duration || 135,
                  rating: movieData?.rating || 'PG-13'
                },
                theater: { _id: 'dummy-theater', name: 'CinePlex Downtown', address: { city: 'Mumbai', state: 'Maharashtra' } },
                date: showDate,
                time: showTime,
                endTime: endTime,
                price: { regular: 200, premium: 280, vip: 350 },
                availableSeats: { regular: 100, premium: 50, vip: 20, wheelchair: 5 },
                bookedSeats: [],
                isActive: true,
                status: 'scheduled',
                isPast: () => false,
                isSeatAvailable: () => true
              };
    } else {
      // Get showtime with populated data
      showtime = await Showtime.findById(showtimeId)
        .populate('movie', 'title poster duration')
        .populate('theater', 'name address.city address.state');
      
      if (!showtime) {
        return res.status(404).json({ 
          message: 'Showtime not found' 
        });
      }
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
      const seatPrice = showtime.price[seat.type] || showtime.price.regular;
      if (!seatPrice) {
        return res.status(400).json({ 
          message: `Invalid seat type: ${seat.type}` 
        });
      }

      // Check if seat type is available (skip check for wheelchair as it's not in price structure)
      if (seat.type !== 'wheelchair' && showtime.availableSeats[seat.type] <= 0) {
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
        },
        ticketId: `TKT${Date.now()}${Math.random().toString(36).substr(2, 8).toUpperCase()}`
      });

      totalAmount += seatPrice;
    }

    // Handle dummy bookings differently
    if (showtimeId.startsWith('dummy-')) {
      // For dummy bookings, create a mock booking response without saving to database
              const mockBooking = {
                _id: `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                user: req.user.userId,
                showtime: showtimeId,
                movie: {
                  _id: 'dummy-movie',
                  title: showtime.movie.title,
                  poster: showtime.movie.poster,
                  duration: showtime.movie.duration,
                  rating: showtime.movie.rating
                },
                theater: {
                  _id: 'dummy-theater',
                  name: showtime.theater.name,
                  address: showtime.theater.address
                },
        tickets: validatedSeats,
        bookingNumber: `BK${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        totalAmount,
        payment: {
          method: paymentMethod,
          transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
          status: 'pending'
        },
        showDate: showtime.date,
        showTime: showtime.time,
        endTime: showtime.endTime,
        status: 'pending',
        bookingDate: new Date(),
        specialRequests
      };

      // Store the booking in our in-memory store for later retrieval
      dummyBookings.set(mockBooking._id, mockBooking);

      res.status(201).json({
        message: 'Booking created successfully. Please complete payment to confirm.',
        booking: mockBooking,
        paymentRequired: true
      });
    } else {
      // Create booking for real showtimes
      const bookingData = {
        user: req.user.userId,
        showtime: showtimeId,
        movie: showtime.movie._id,
        theater: showtime.theater._id,
        tickets: validatedSeats,
        bookingNumber: `BK${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
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
    }
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
    let booking;
    
            // Handle dummy booking IDs
            if (req.params.id.startsWith('booking_')) {
              // For dummy bookings, retrieve from our in-memory store
              booking = dummyBookings.get(req.params.id);
              
              if (!booking) {
                return res.status(404).json({ 
                  message: 'Booking not found' 
                });
              }
    } else {
      // Handle real bookings
      booking = await Booking.findById(req.params.id)
        .populate('movie', 'title poster duration rating genre')
        .populate('theater', 'name address contact')
        .populate('showtime', 'date time endTime hall')
        .populate('user', 'firstName lastName email phone');

      if (!booking) {
        return res.status(404).json({ 
          message: 'Booking not found' 
        });
      }
    }

    // Check if user owns the booking or is admin
    const userId = booking.user._id ? booking.user._id.toString() : booking.user.toString();
    const currentUserId = req.user.userId.toString();
    if (userId !== currentUserId && req.user.role !== 'admin') {
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
