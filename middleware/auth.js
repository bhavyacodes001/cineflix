const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        message: 'No token provided, authorization denied' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from token
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ 
        message: 'Token is not valid' 
      });
    }

    // Add user to request object
    req.user = {
      userId: user._id,
      email: user.email,
      role: user.role
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: 'Invalid token' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Token expired' 
      });
    }
    
    res.status(500).json({ 
      message: 'Server error in authentication' 
    });
  }
};

// Admin authorization middleware
const adminAuth = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Access denied. Admin privileges required.' 
      });
    }
    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    res.status(500).json({ 
      message: 'Server error in admin authentication' 
    });
  }
};

// Theater owner authorization middleware
const theaterOwnerAuth = async (req, res, next) => {
  try {
    if (req.user.role !== 'theater_owner' && req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Access denied. Theater owner privileges required.' 
      });
    }
    next();
  } catch (error) {
    console.error('Theater owner auth middleware error:', error);
    res.status(500).json({ 
      message: 'Server error in theater owner authentication' 
    });
  }
};

module.exports = { auth, adminAuth, theaterOwnerAuth };
