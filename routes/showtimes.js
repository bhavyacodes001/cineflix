const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Showtime = require('../models/Showtime');
const Movie = require('../models/Movie');
const Theater = require('../models/Theater');
const { auth, adminAuth, theaterOwnerAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/showtimes
// @desc    Get showtimes with filtering
// @access  Public
router.get('/', [
  query('movieId').optional().isMongoId().withMessage('Invalid movie ID'),
  query('theaterId').optional().isMongoId().withMessage('Invalid theater ID'),
  query('date').optional().isISO8601().withMessage('Invalid date format'),
  query('city').optional().isString().withMessage('City must be a string'),
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

    // Build filter object
    const filter = { 
      status: 'scheduled',
      isActive: true 
    };
    
    if (req.query.movieId) {
      filter.movie = req.query.movieId;
    }
    
    if (req.query.theaterId) {
      filter.theater = req.query.theaterId;
    }
    
    if (req.query.date) {
      const searchDate = new Date(req.query.date);
      const nextDay = new Date(searchDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      filter.date = {
        $gte: searchDate,
        $lt: nextDay
      };
    }

    // If city is provided, we need to filter by theaters in that city
    let theaterFilter = {};
    if (req.query.city) {
      const theatersInCity = await Theater.find({
        'address.city': new RegExp(req.query.city, 'i'),
        isActive: true
      }).select('_id');
      
      const theaterIds = theatersInCity.map(t => t._id);
      filter.theater = { $in: theaterIds };
    }

    // Execute query with population
    const showtimes = await Showtime.find(filter)
      .populate('movie', 'title poster duration rating genre')
      .populate('theater', 'name address.city address.state')
      .sort({ date: 1, time: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Showtime.countDocuments(filter);

    res.json({
      showtimes,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalShowtimes: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get showtimes error:', error);
    res.status(500).json({ 
      message: 'Server error while fetching showtimes' 
    });
  }
});

// @route   GET /api/showtimes/movie/:movieId
// @desc    Get showtimes for a specific movie
// @access  Public
router.get('/movie/:movieId', [
  query('date').optional().isISO8601().withMessage('Invalid date format'),
  query('city').optional().isString().withMessage('City must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { movieId } = req.params;
    
    // Verify movie exists
    const movie = await Movie.findById(movieId);
    if (!movie || !movie.isActive) {
      return res.status(404).json({ 
        message: 'Movie not found' 
      });
    }

    // Build filter
    const filter = { 
      movie: movieId,
      status: 'scheduled',
      isActive: true 
    };
    
    if (req.query.date) {
      const searchDate = new Date(req.query.date);
      const nextDay = new Date(searchDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      filter.date = {
        $gte: searchDate,
        $lt: nextDay
      };
    }

    // Filter by city if provided
    if (req.query.city) {
      const theatersInCity = await Theater.find({
        'address.city': new RegExp(req.query.city, 'i'),
        isActive: true
      }).select('_id');
      
      const theaterIds = theatersInCity.map(t => t._id);
      filter.theater = { $in: theaterIds };
    }

    const showtimes = await Showtime.find(filter)
      .populate('theater', 'name address.city address.state halls')
      .sort({ date: 1, time: 1 });

    // Group showtimes by theater
    const groupedShowtimes = showtimes.reduce((acc, showtime) => {
      const theaterId = showtime.theater._id.toString();
      if (!acc[theaterId]) {
        acc[theaterId] = {
          theater: showtime.theater,
          showtimes: []
        };
      }
      acc[theaterId].showtimes.push(showtime);
      return acc;
    }, {});

    res.json({
      movie,
      theaters: Object.values(groupedShowtimes)
    });
  } catch (error) {
    console.error('Get movie showtimes error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: 'Invalid movie ID' 
      });
    }
    res.status(500).json({ 
      message: 'Server error while fetching movie showtimes' 
    });
  }
});

// @route   GET /api/showtimes/:id
// @desc    Get showtime by ID with seat availability
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const showtime = await Showtime.findById(req.params.id)
      .populate('movie', 'title poster duration rating genre')
      .populate('theater', 'name address halls');
    
    if (!showtime) {
      return res.status(404).json({ 
        message: 'Showtime not found' 
      });
    }

    if (!showtime.isActive || showtime.status !== 'scheduled') {
      return res.status(404).json({ 
        message: 'Showtime is not available' 
      });
    }

    // Check if showtime is in the past
    if (showtime.isPast()) {
      return res.status(400).json({ 
        message: 'Showtime has already passed' 
      });
    }

    // Get theater hall layout
    const theater = await Theater.findById(showtime.theater._id);
    const hall = theater.halls.find(h => h.name === showtime.hall.name);
    
    if (!hall) {
      return res.status(404).json({ 
        message: 'Hall not found' 
      });
    }

    // Create seat map with availability
    const seatMap = hall.layout.rows.map(row => ({
      rowName: row.name,
      seats: row.seats.map(seat => ({
        number: seat.number,
        type: seat.type,
        price: seat.price,
        isAvailable: showtime.isSeatAvailable(row.name, seat.number),
        isBooked: !showtime.isSeatAvailable(row.name, seat.number)
      }))
    }));

    res.json({
      showtime,
      seatMap,
      availableSeats: showtime.availableSeats
    });
  } catch (error) {
    console.error('Get showtime error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: 'Invalid showtime ID' 
      });
    }
    res.status(500).json({ 
      message: 'Server error while fetching showtime' 
    });
  }
});

// @route   POST /api/showtimes
// @desc    Create a new showtime
// @access  Private (Theater Owner/Admin)
router.post('/', auth, theaterOwnerAuth, [
  body('movie').isMongoId().withMessage('Valid movie ID is required'),
  body('theater').isMongoId().withMessage('Valid theater ID is required'),
  body('hall.name').trim().isLength({ min: 1 }).withMessage('Hall name is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('time').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Time must be in HH:MM format'),
  body('endTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('End time must be in HH:MM format'),
  body('price.regular').isFloat({ min: 0 }).withMessage('Regular price must be a positive number'),
  body('price.premium').isFloat({ min: 0 }).withMessage('Premium price must be a positive number'),
  body('price.vip').isFloat({ min: 0 }).withMessage('VIP price must be a positive number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { movie, theater, hall, date, time, endTime, price } = req.body;

    // Verify movie exists and is active
    const movieDoc = await Movie.findById(movie);
    if (!movieDoc || !movieDoc.isActive) {
      return res.status(404).json({ 
        message: 'Movie not found or inactive' 
      });
    }

    // Verify theater exists and user has access
    const theaterDoc = await Theater.findById(theater);
    if (!theaterDoc || !theaterDoc.isActive) {
      return res.status(404).json({ 
        message: 'Theater not found or inactive' 
      });
    }

    // Check if user owns the theater or is admin
    if (theaterDoc.owner.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Access denied. You can only create showtimes for your own theaters.' 
      });
    }

    // Verify hall exists in theater
    const hallDoc = theaterDoc.halls.find(h => h.name === hall.name);
    if (!hallDoc) {
      return res.status(404).json({ 
        message: 'Hall not found in theater' 
      });
    }

    // Check for conflicting showtimes
    const conflictingShowtime = await Showtime.findOne({
      theater,
      'hall.name': hall.name,
      date: new Date(date),
      status: 'scheduled',
      isActive: true,
      $or: [
        {
          time: { $lt: endTime },
          endTime: { $gt: time }
        }
      ]
    });

    if (conflictingShowtime) {
      return res.status(400).json({ 
        message: 'Showtime conflicts with existing showtime in the same hall' 
      });
    }

    // Calculate available seats based on hall capacity
    const availableSeats = {
      regular: hallDoc.layout.rows.reduce((total, row) => 
        total + row.seats.filter(seat => seat.type === 'regular').length, 0),
      premium: hallDoc.layout.rows.reduce((total, row) => 
        total + row.seats.filter(seat => seat.type === 'premium').length, 0),
      vip: hallDoc.layout.rows.reduce((total, row) => 
        total + row.seats.filter(seat => seat.type === 'vip').length, 0),
      wheelchair: hallDoc.layout.rows.reduce((total, row) => 
        total + row.seats.filter(seat => seat.type === 'wheelchair').length, 0)
    };

    const showtimeData = {
      movie,
      theater,
      hall: {
        name: hall.name,
        hallId: hallDoc._id
      },
      date: new Date(date),
      time,
      endTime,
      price,
      availableSeats
    };

    const showtime = new Showtime(showtimeData);
    await showtime.save();

    // Populate the response
    await showtime.populate([
      { path: 'movie', select: 'title poster duration' },
      { path: 'theater', select: 'name address.city' }
    ]);

    res.status(201).json({
      message: 'Showtime created successfully',
      showtime
    });
  } catch (error) {
    console.error('Create showtime error:', error);
    res.status(500).json({ 
      message: 'Server error while creating showtime' 
    });
  }
});

// @route   PUT /api/showtimes/:id
// @desc    Update showtime
// @access  Private (Theater Owner/Admin)
router.put('/:id', auth, async (req, res) => {
  try {
    const showtime = await Showtime.findById(req.params.id)
      .populate('theater', 'owner');
    
    if (!showtime) {
      return res.status(404).json({ 
        message: 'Showtime not found' 
      });
    }

    // Check if user owns the theater or is admin
    if (showtime.theater.owner.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Access denied. You can only update showtimes for your own theaters.' 
      });
    }

    // Don't allow updates if showtime has bookings
    if (showtime.bookedSeats.length > 0) {
      return res.status(400).json({ 
        message: 'Cannot update showtime with existing bookings' 
      });
    }

    const updatedShowtime = await Showtime.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate([
      { path: 'movie', select: 'title poster duration' },
      { path: 'theater', select: 'name address.city' }
    ]);

    res.json({
      message: 'Showtime updated successfully',
      showtime: updatedShowtime
    });
  } catch (error) {
    console.error('Update showtime error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: 'Invalid showtime ID' 
      });
    }
    res.status(500).json({ 
      message: 'Server error while updating showtime' 
    });
  }
});

// @route   DELETE /api/showtimes/:id
// @desc    Cancel showtime
// @access  Private (Theater Owner/Admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    const showtime = await Showtime.findById(req.params.id)
      .populate('theater', 'owner');
    
    if (!showtime) {
      return res.status(404).json({ 
        message: 'Showtime not found' 
      });
    }

    // Check if user owns the theater or is admin
    if (showtime.theater.owner.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Access denied. You can only cancel showtimes for your own theaters.' 
      });
    }

    // Update status to cancelled
    showtime.status = 'cancelled';
    showtime.isActive = false;
    await showtime.save();

    res.json({
      message: 'Showtime cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel showtime error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: 'Invalid showtime ID' 
      });
    }
    res.status(500).json({ 
      message: 'Server error while cancelling showtime' 
    });
  }
});

module.exports = router;
