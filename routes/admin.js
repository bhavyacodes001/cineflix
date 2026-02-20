const express = require('express');
const { body, validationResult, query } = require('express-validator');
const User = require('../models/User');
const Movie = require('../models/Movie');
const Theater = require('../models/Theater');
const Showtime = require('../models/Showtime');
const Booking = require('../models/Booking');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Apply admin authentication to all routes
router.use(auth, adminAuth);

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private (Admin)
router.get('/dashboard', async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // Get statistics
    const [
      totalUsers,
      totalMovies,
      totalTheaters,
      totalBookings,
      todayBookings,
      totalRevenue,
      todayRevenue,
      activeShowtimes
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      Movie.countDocuments({ isActive: true }),
      Theater.countDocuments({ isActive: true }),
      Booking.countDocuments(),
      Booking.countDocuments({
        bookingDate: { $gte: startOfDay, $lte: endOfDay }
      }),
      Booking.aggregate([
        { $match: { status: 'confirmed' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      Booking.aggregate([
        { 
          $match: { 
            status: 'confirmed',
            bookingDate: { $gte: startOfDay, $lte: endOfDay }
          }
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      Showtime.countDocuments({ status: 'scheduled', isActive: true })
    ]);

    // Get recent bookings
    const recentBookings = await Booking.find()
      .populate('user', 'firstName lastName email')
      .populate('movie', 'title poster')
      .populate('theater', 'name')
      .sort({ bookingDate: -1 })
      .limit(10);

    // Get top movies by bookings
    const topMovies = await Booking.aggregate([
      { $match: { status: 'confirmed' } },
      { $group: { _id: '$movie', count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
      { $lookup: { from: 'movies', localField: '_id', foreignField: '_id', as: 'movie' } },
      { $unwind: '$movie' },
      { $project: { 'movie.title': 1, 'movie.poster': 1, count: 1, revenue: 1 } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      statistics: {
        totalUsers,
        totalMovies,
        totalTheaters,
        totalBookings,
        todayBookings,
        totalRevenue: totalRevenue[0]?.total || 0,
        todayRevenue: todayRevenue[0]?.total || 0,
        activeShowtimes
      },
      recentBookings,
      topMovies
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ 
      message: 'Server error while fetching dashboard data' 
    });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users with pagination
// @access  Private (Admin)
router.get('/users', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('role').optional().isIn(['user', 'admin', 'theater_owner']).withMessage('Invalid role'),
  query('search').optional().isString().withMessage('Search must be a string')
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
    if (req.query.role) filter.role = req.query.role;
    if (req.query.search) {
      const safeSearch = escapeRegex(req.query.search);
      filter.$or = [
        { firstName: new RegExp(safeSearch, 'i') },
        { lastName: new RegExp(safeSearch, 'i') },
        { email: new RegExp(safeSearch, 'i') }
      ];
    }

    const users = await User.find(filter)
      .select('-password -emailVerificationToken -passwordResetToken -passwordResetExpires')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(filter);

    res.json({
      users,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalUsers: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ 
      message: 'Server error while fetching users' 
    });
  }
});

// @route   PUT /api/admin/users/:id/role
// @desc    Update user role
// @access  Private (Admin)
router.put('/users/:id/role', [
  body('role').isIn(['user', 'admin', 'theater_owner']).withMessage('Invalid role')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { role } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-password -emailVerificationToken -passwordResetToken -passwordResetExpires');

    if (!user) {
      return res.status(404).json({ 
        message: 'User not found' 
      });
    }

    res.json({
      message: 'User role updated successfully',
      user
    });
  } catch (error) {
    console.error('Update user role error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: 'Invalid user ID' 
      });
    }
    res.status(500).json({ 
      message: 'Server error while updating user role' 
    });
  }
});

// @route   GET /api/admin/analytics/revenue
// @desc    Get revenue analytics
// @access  Private (Admin)
router.get('/analytics/revenue', [
  query('period').optional().isIn(['day', 'week', 'month', 'year']).withMessage('Invalid period'),
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { period = 'month', startDate, endDate } = req.query;

    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        bookingDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    } else {
      // Default to last 30 days
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      dateFilter = {
        bookingDate: { $gte: start, $lte: end }
      };
    }

    // Revenue by period
    const revenueData = await Booking.aggregate([
      { $match: { status: 'confirmed', ...dateFilter } },
      {
        $group: {
          _id: {
            year: { $year: '$bookingDate' },
            month: { $month: '$bookingDate' },
            day: { $dayOfMonth: '$bookingDate' }
          },
          revenue: { $sum: '$totalAmount' },
          bookings: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Revenue by theater
    const revenueByTheater = await Booking.aggregate([
      { $match: { status: 'confirmed', ...dateFilter } },
      { $group: { _id: '$theater', revenue: { $sum: '$totalAmount' }, bookings: { $sum: 1 } } },
      { $lookup: { from: 'theaters', localField: '_id', foreignField: '_id', as: 'theater' } },
      { $unwind: '$theater' },
      { $project: { 'theater.name': 1, 'theater.address.city': 1, revenue: 1, bookings: 1 } },
      { $sort: { revenue: -1 } }
    ]);

    // Revenue by movie
    const revenueByMovie = await Booking.aggregate([
      { $match: { status: 'confirmed', ...dateFilter } },
      { $group: { _id: '$movie', revenue: { $sum: '$totalAmount' }, bookings: { $sum: 1 } } },
      { $lookup: { from: 'movies', localField: '_id', foreignField: '_id', as: 'movie' } },
      { $unwind: '$movie' },
      { $project: { 'movie.title': 1, 'movie.poster': 1, revenue: 1, bookings: 1 } },
      { $sort: { revenue: -1 } }
    ]);

    res.json({
      revenueData,
      revenueByTheater,
      revenueByMovie
    });
  } catch (error) {
    console.error('Get revenue analytics error:', error);
    res.status(500).json({ 
      message: 'Server error while fetching revenue analytics' 
    });
  }
});

// @route   GET /api/admin/analytics/bookings
// @desc    Get booking analytics
// @access  Private (Admin)
router.get('/analytics/bookings', [
  query('period').optional().isIn(['day', 'week', 'month', 'year']).withMessage('Invalid period')
], async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    // Booking trends
    const bookingTrends = await Booking.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$bookingDate' },
            month: { $month: '$bookingDate' },
            day: { $dayOfMonth: '$bookingDate' }
          },
          totalBookings: { $sum: 1 },
          confirmedBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
          },
          cancelledBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Booking status distribution
    const statusDistribution = await Booking.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Peak booking hours
    const peakHours = await Booking.aggregate([
      { $match: { status: 'confirmed' } },
      { $group: { _id: { $hour: '$bookingDate' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      bookingTrends,
      statusDistribution,
      peakHours
    });
  } catch (error) {
    console.error('Get booking analytics error:', error);
    res.status(500).json({ 
      message: 'Server error while fetching booking analytics' 
    });
  }
});

// @route   GET /api/admin/reports/export
// @desc    Export data reports
// @access  Private (Admin)
router.get('/reports/export', [
  query('type').isIn(['bookings', 'users', 'revenue']).withMessage('Invalid report type'),
  query('format').optional().isIn(['json', 'csv']).withMessage('Invalid format'),
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { type, format = 'json', startDate, endDate } = req.query;

    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        bookingDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    }

    let data;
    switch (type) {
      case 'bookings':
        data = await Booking.find(dateFilter)
          .populate('user', 'firstName lastName email')
          .populate('movie', 'title')
          .populate('theater', 'name address.city')
          .sort({ bookingDate: -1 });
        break;
      case 'users':
        data = await User.find()
          .select('-password -emailVerificationToken -passwordResetToken -passwordResetExpires')
          .sort({ createdAt: -1 });
        break;
      case 'revenue':
        data = await Booking.aggregate([
          { $match: { status: 'confirmed', ...dateFilter } },
          {
            $group: {
              _id: {
                year: { $year: '$bookingDate' },
                month: { $month: '$bookingDate' },
                day: { $dayOfMonth: '$bookingDate' }
              },
              revenue: { $sum: '$totalAmount' },
              bookings: { $sum: 1 }
            }
          },
          { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);
        break;
    }

    if (format === 'csv') {
      // TODO: Implement CSV export
      res.json({ message: 'CSV export not implemented yet', data });
    } else {
      res.json({ data });
    }
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({ 
      message: 'Server error while exporting report' 
    });
  }
});

module.exports = router;
