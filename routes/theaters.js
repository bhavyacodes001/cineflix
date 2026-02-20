const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Theater = require('../models/Theater');
const { auth, adminAuth, theaterOwnerAuth } = require('../middleware/auth');

const router = express.Router();

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// @route   GET /api/theaters
// @desc    Get all theaters with filtering
// @access  Public
router.get('/', [
  query('city').optional().isString().withMessage('City must be a string'),
  query('state').optional().isString().withMessage('State must be a string'),
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
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = { isActive: true };
    
    if (req.query.city) {
      filter['address.city'] = new RegExp(escapeRegex(req.query.city), 'i');
    }
    
    if (req.query.state) {
      filter['address.state'] = new RegExp(escapeRegex(req.query.state), 'i');
    }

    // Execute query
    const theaters = await Theater.find(filter)
      .populate('owner', 'firstName lastName email')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .select('-__v');

    const total = await Theater.countDocuments(filter);

    res.json({
      theaters,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalTheaters: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get theaters error:', error);
    res.status(500).json({ 
      message: 'Server error while fetching theaters' 
    });
  }
});

// @route   GET /api/theaters/nearby
// @desc    Get theaters near a location
// @access  Public
router.get('/nearby', [
  query('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude is required'),
  query('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude is required'),
  query('radius').optional().isFloat({ min: 0.1, max: 100 }).withMessage('Radius must be between 0.1 and 100 km')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { latitude, longitude, radius = 10 } = req.query;
    
    // Find theaters within radius (in kilometers)
    const theaters = await Theater.find({
      isActive: true,
      'location.latitude': { $exists: true },
      'location.longitude': { $exists: true }
    }).populate('owner', 'firstName lastName email');

    // Calculate distance and filter
    const nearbyTheaters = theaters.filter(theater => {
      if (!theater.location.latitude || !theater.location.longitude) return false;
      
      const distance = calculateDistance(
        parseFloat(latitude),
        parseFloat(longitude),
        theater.location.latitude,
        theater.location.longitude
      );
      
      return distance <= parseFloat(radius);
    }).map(theater => {
      const distance = calculateDistance(
        parseFloat(latitude),
        parseFloat(longitude),
        theater.location.latitude,
        theater.location.longitude
      );
      
      return {
        ...theater.toObject(),
        distance: Math.round(distance * 100) / 100 // Round to 2 decimal places
      };
    }).sort((a, b) => a.distance - b.distance);

    res.json({ theaters: nearbyTheaters });
  } catch (error) {
    console.error('Get nearby theaters error:', error);
    res.status(500).json({ 
      message: 'Server error while fetching nearby theaters' 
    });
  }
});

// @route   GET /api/theaters/:id
// @desc    Get theater by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.id)
      .populate('owner', 'firstName lastName email');
    
    if (!theater) {
      return res.status(404).json({ 
        message: 'Theater not found' 
      });
    }

    if (!theater.isActive) {
      return res.status(404).json({ 
        message: 'Theater is not available' 
      });
    }

    res.json({ theater });
  } catch (error) {
    console.error('Get theater error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: 'Invalid theater ID' 
      });
    }
    res.status(500).json({ 
      message: 'Server error while fetching theater' 
    });
  }
});

// @route   POST /api/theaters
// @desc    Create a new theater
// @access  Private (Theater Owner/Admin)
router.post('/', auth, theaterOwnerAuth, [
  body('name').trim().isLength({ min: 1 }).withMessage('Theater name is required'),
  body('address.street').trim().isLength({ min: 1 }).withMessage('Street address is required'),
  body('address.city').trim().isLength({ min: 1 }).withMessage('City is required'),
  body('address.state').trim().isLength({ min: 1 }).withMessage('State is required'),
  body('address.zipCode').trim().isLength({ min: 1 }).withMessage('ZIP code is required'),
  body('contact.phone').isMobilePhone().withMessage('Valid phone number is required'),
  body('contact.email').isEmail().withMessage('Valid email is required'),
  body('halls').isArray({ min: 1 }).withMessage('At least one hall is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const theaterData = {
      ...req.body,
      owner: req.user.userId
    };

    const theater = new Theater(theaterData);
    await theater.save();

    res.status(201).json({
      message: 'Theater created successfully',
      theater
    });
  } catch (error) {
    console.error('Create theater error:', error);
    res.status(500).json({ 
      message: 'Server error while creating theater' 
    });
  }
});

// @route   PUT /api/theaters/:id
// @desc    Update theater
// @access  Private (Theater Owner/Admin)
router.put('/:id', auth, async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.id);
    
    if (!theater) {
      return res.status(404).json({ 
        message: 'Theater not found' 
      });
    }

    // Check if user owns the theater or is admin
    if (theater.owner.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Access denied. You can only update your own theaters.' 
      });
    }

    const allowedFields = ['name', 'address', 'contact', 'halls', 'amenities', 'operatingHours'];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }

    const updatedTheater = await Theater.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      message: 'Theater updated successfully',
      theater: updatedTheater
    });
  } catch (error) {
    console.error('Update theater error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: 'Invalid theater ID' 
      });
    }
    res.status(500).json({ 
      message: 'Server error while updating theater' 
    });
  }
});

// @route   DELETE /api/theaters/:id
// @desc    Delete theater
// @access  Private (Theater Owner/Admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.id);
    
    if (!theater) {
      return res.status(404).json({ 
        message: 'Theater not found' 
      });
    }

    // Check if user owns the theater or is admin
    if (theater.owner.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Access denied. You can only delete your own theaters.' 
      });
    }

    await Theater.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    res.json({
      message: 'Theater deactivated successfully'
    });
  } catch (error) {
    console.error('Delete theater error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: 'Invalid theater ID' 
      });
    }
    res.status(500).json({ 
      message: 'Server error while deleting theater' 
    });
  }
});

// @route   GET /api/theaters/:id/halls
// @desc    Get theater halls
// @access  Public
router.get('/:id/halls', async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.id).select('halls name');
    
    if (!theater) {
      return res.status(404).json({ 
        message: 'Theater not found' 
      });
    }

    res.json({ 
      theaterName: theater.name,
      halls: theater.halls 
    });
  } catch (error) {
    console.error('Get theater halls error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: 'Invalid theater ID' 
      });
    }
    res.status(500).json({ 
      message: 'Server error while fetching theater halls' 
    });
  }
});

// Helper function to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  return distance;
}

module.exports = router;
