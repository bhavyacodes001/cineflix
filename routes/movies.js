const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Movie = require('../models/Movie');
const { auth, adminAuth } = require('../middleware/auth');
const axios = require('axios');

const router = express.Router();

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// @route   GET /api/movies
// @desc    Get all movies with filtering and pagination
// @access  Public
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('genre').optional().isString().withMessage('Genre must be a string'),
  query('status').optional().isIn(['upcoming', 'now_showing', 'ended']).withMessage('Invalid status'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('title').optional().isString().withMessage('Title must be a string'),
  query('language').optional().isString().withMessage('Language must be a string'),
  query('releaseDateFrom').optional().isISO8601().withMessage('releaseDateFrom must be a valid date'),
  query('releaseDateTo').optional().isISO8601().withMessage('releaseDateTo must be a valid date')
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
    
    if (req.query.genre) {
      filter.genre = { $in: [req.query.genre] };
    }
    
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }

    if (req.query.title) {
      filter.title = { $regex: escapeRegex(req.query.title), $options: 'i' };
    }

    if (req.query.language) {
      filter.language = req.query.language;
    }

    if (req.query.releaseDateFrom || req.query.releaseDateTo) {
      filter.releaseDate = {};
      if (req.query.releaseDateFrom) {
        filter.releaseDate.$gte = new Date(req.query.releaseDateFrom);
      }
      if (req.query.releaseDateTo) {
        // include the entire end day by setting to end-of-day
        const to = new Date(req.query.releaseDateTo);
        to.setHours(23, 59, 59, 999);
        filter.releaseDate.$lte = to;
      }
    }

    // Execute query
    const movies = await Movie.find(filter)
      .sort({ releaseDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v');

    const total = await Movie.countDocuments(filter);

    res.json({
      movies,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalMovies: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get movies error:', error);
    res.status(500).json({ 
      message: 'Server error while fetching movies' 
    });
  }
});

// @route   GET /api/movies/featured
// @desc    Get featured/trending movies
// @access  Public
router.get('/featured', async (req, res) => {
  try {
    const featuredMovies = await Movie.find({ 
      isActive: true, 
      status: 'now_showing' 
    })
    .sort({ imdbRating: -1, releaseDate: -1 })
    .limit(8)
    .select('-__v');

    res.json({ movies: featuredMovies });
  } catch (error) {
    console.error('Get featured movies error:', error);
    res.status(500).json({ 
      message: 'Server error while fetching featured movies' 
    });
  }
});

// @route   GET /api/movies/upcoming
// @desc    Get upcoming movies
// @access  Public
router.get('/upcoming', async (req, res) => {
  try {
    const upcomingMovies = await Movie.find({ 
      isActive: true, 
      status: 'upcoming' 
    })
    .sort({ releaseDate: 1 })
    .limit(10)
    .select('-__v');

    res.json({ movies: upcomingMovies });
  } catch (error) {
    console.error('Get upcoming movies error:', error);
    res.status(500).json({ 
      message: 'Server error while fetching upcoming movies' 
    });
  }
});

// @route   GET /api/movies/:id
// @desc    Get movie by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const movieId = req.params.id;
    
    // Check for undefined or invalid IDs
    if (!movieId || movieId === 'undefined' || movieId === 'null') {
      return res.status(400).json({ 
        message: 'Invalid movie ID: ID is undefined or null' 
      });
    }
    
    // Check if it's a valid MongoDB ObjectId (24 hex characters)
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(movieId);
    
    if (!isValidObjectId) {
      return res.status(400).json({ 
        message: 'Invalid movie ID format' 
      });
    }
    
    const movie = await Movie.findById(movieId);
    
    if (!movie) {
      return res.status(404).json({ 
        message: 'Movie not found' 
      });
    }

    if (!movie.isActive) {
      return res.status(404).json({ 
        message: 'Movie is not available' 
      });
    }

    res.json({ movie });
  } catch (error) {
    console.error('Get movie error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: 'Invalid movie ID' 
      });
    }
    res.status(500).json({ 
      message: 'Server error while fetching movie' 
    });
  }
});

// @route   POST /api/movies
// @desc    Create a new movie (Admin only)
// @access  Private (Admin)
router.post('/', auth, adminAuth, [
  body('title').trim().isLength({ min: 1 }).withMessage('Title is required'),
  body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('genre').isArray({ min: 1 }).withMessage('At least one genre is required'),
  body('director').trim().isLength({ min: 1 }).withMessage('Director is required'),
  body('releaseDate').isISO8601().withMessage('Valid release date is required'),
  body('duration').isInt({ min: 1 }).withMessage('Duration must be a positive integer'),
  body('rating').isIn(['G', 'PG', 'PG-13', 'R', 'NC-17', 'NR']).withMessage('Invalid rating'),
  body('poster').isURL().withMessage('Valid poster URL is required'),
  body('basePrice').isFloat({ min: 0 }).withMessage('Base price must be a positive number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const allowedFields = ['title', 'description', 'genre', 'director', 'cast', 'releaseDate', 'duration', 'rating', 'poster', 'trailer', 'images', 'basePrice', 'language', 'subtitles'];
    const movieData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) movieData[field] = req.body[field];
    }
    movieData.releaseDate = new Date(req.body.releaseDate);

    const movie = new Movie(movieData);
    await movie.save();

    res.status(201).json({
      message: 'Movie created successfully',
      movie
    });
  } catch (error) {
    console.error('Create movie error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'Movie with this title already exists' 
      });
    }
    res.status(500).json({ 
      message: 'Server error while creating movie' 
    });
  }
});

// @route   PUT /api/movies/:id
// @desc    Update movie (Admin only)
// @access  Private (Admin)
router.put('/:id', auth, adminAuth, [
  body('title').optional().trim().isLength({ min: 1 }).withMessage('Title cannot be empty'),
  body('description').optional().trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('genre').optional().isArray({ min: 1 }).withMessage('At least one genre is required'),
  body('director').optional().trim().isLength({ min: 1 }).withMessage('Director cannot be empty'),
  body('releaseDate').optional().isISO8601().withMessage('Valid release date is required'),
  body('duration').optional().isInt({ min: 1 }).withMessage('Duration must be a positive integer'),
  body('rating').optional().isIn(['G', 'PG', 'PG-13', 'R', 'NC-17', 'NR']).withMessage('Invalid rating'),
  body('poster').optional().isURL().withMessage('Valid poster URL is required'),
  body('basePrice').optional().isFloat({ min: 0 }).withMessage('Base price must be a positive number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const allowedUpdateFields = ['title', 'description', 'genre', 'director', 'cast', 'releaseDate', 'duration', 'rating', 'poster', 'trailer', 'images', 'basePrice', 'language', 'subtitles', 'status'];
    const updateData = {};
    for (const field of allowedUpdateFields) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }
    if (updateData.releaseDate) {
      updateData.releaseDate = new Date(updateData.releaseDate);
    }
    updateData.lastUpdated = new Date();

    const movie = await Movie.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!movie) {
      return res.status(404).json({ 
        message: 'Movie not found' 
      });
    }

    res.json({
      message: 'Movie updated successfully',
      movie
    });
  } catch (error) {
    console.error('Update movie error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: 'Invalid movie ID' 
      });
    }
    res.status(500).json({ 
      message: 'Server error while updating movie' 
    });
  }
});

// @route   DELETE /api/movies/:id
// @desc    Delete movie (Admin only)
// @access  Private (Admin)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const movie = await Movie.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!movie) {
      return res.status(404).json({ 
        message: 'Movie not found' 
      });
    }

    res.json({
      message: 'Movie deactivated successfully'
    });
  } catch (error) {
    console.error('Delete movie error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: 'Invalid movie ID' 
      });
    }
    res.status(500).json({ 
      message: 'Server error while deleting movie' 
    });
  }
});

// @route   GET /api/movies/genres/list
// @desc    Get list of all available genres
// @access  Public
router.get('/genres/list', async (req, res) => {
  try {
    const genres = [
      'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 'Crime', 
      'Documentary', 'Drama', 'Family', 'Fantasy', 'Film-Noir', 'History', 
      'Horror', 'Music', 'Musical', 'Mystery', 'Romance', 'Sci-Fi', 
      'Sport', 'Thriller', 'War', 'Western'
    ];

    res.json({ genres });
  } catch (error) {
    console.error('Get genres error:', error);
    res.status(500).json({ 
      message: 'Server error while fetching genres' 
    });
  }
});

// ===== TMDB Integration: Public endpoints =====
// @route   GET /api/movies/tmdb/now-playing
// @desc    Proxy TMDB Now Playing movies with enhanced data
// @access  Public
router.get('/tmdb/now-playing', async (req, res) => {
  try {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) return res.status(500).json({ message: 'TMDB API key not configured' });
    
    const region = req.query.region || 'US';
    const page = Math.min(parseInt(req.query.page) || 1, 500); // TMDB limit
    
    const resp = await axios.get(`${process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3'}/movie/now_playing`, {
      params: { api_key: apiKey, region, page, language: 'en-US' }
    });
    
    // Enhance movie data
    const enhancedResults = resp.data.results.map(movie => ({
      ...movie,
      poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
      backdrop_url: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
      rating: movie.vote_average,
      description: movie.overview,
      genres: movie.genre_ids // You can map these to genre names if needed
    }));
    
    res.json({
      ...resp.data,
      results: enhancedResults
    });
  } catch (error) {
    console.error('TMDB now-playing error:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to fetch now playing from TMDB' });
  }
});

// @route   GET /api/movies/tmdb/upcoming
// @desc    Proxy TMDB Upcoming movies with enhanced data
// @access  Public
router.get('/tmdb/upcoming', async (req, res) => {
  try {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) return res.status(500).json({ message: 'TMDB API key not configured' });
    
    const region = req.query.region || 'US';
    const page = Math.min(parseInt(req.query.page) || 1, 500);
    
    const resp = await axios.get(`${process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3'}/movie/upcoming`, {
      params: { api_key: apiKey, region, page, language: 'en-US' }
    });
    
    // Enhance movie data
    const enhancedResults = resp.data.results.map(movie => ({
      ...movie,
      poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
      backdrop_url: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
      rating: movie.vote_average,
      description: movie.overview,
      genres: movie.genre_ids
    }));
    
    res.json({
      ...resp.data,
      results: enhancedResults
    });
  } catch (error) {
    console.error('TMDB upcoming error:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to fetch upcoming from TMDB' });
  }
});

// Helper function for TMDB API calls with retry logic
async function tmdbApiCall(url, params, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, {
        params,
        timeout: 15000, // Increased timeout to 15 seconds
        headers: {
          'User-Agent': 'Movie-Booking-System/1.0',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate'
        },
        // Add retry configuration
        maxRedirects: 5,
        validateStatus: function (status) {
          return status >= 200 && status < 300; // Only resolve for 2xx status codes
        }
      });
      return response;
    } catch (error) {
      console.error(`TMDB API attempt ${i + 1} failed:`, error.code || error.message);
      
      // Don't retry for certain error types
      if (error.response?.status === 404 || error.response?.status === 401 || error.response?.status === 403) {
        throw error; // Don't retry for these errors
      }
      
      if (i === retries - 1) {
        throw error; // Last attempt failed
      }
      
      // Wait before retry (exponential backoff with jitter)
      const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
      console.log(`Retrying TMDB API call in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// @route   GET /api/movies/tmdb/health
// @desc    Check TMDB API health
// @access  Public
router.get('/tmdb/health', async (req, res) => {
  try {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
      return res.json({ 
        status: 'unavailable', 
        message: 'TMDB API key not configured',
        fallback: 'local_database'
      });
    }
    
    const response = await axios.get(`${process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3'}/movie/popular`, {
      params: { api_key: apiKey, page: 1 },
      timeout: 5000
    });
    
    res.json({ 
      status: 'healthy', 
      message: 'TMDB API is working',
      results_count: response.data.results?.length || 0
    });
  } catch (error) {
    console.error('TMDB health check failed:', error.message);
    res.json({ 
      status: 'unhealthy', 
      message: 'TMDB API is not responding',
      error: error.message,
      fallback: 'local_database'
    });
  }
});

// @route   GET /api/movies/tmdb/popular
// @desc    Get popular movies with pagination
// @access  Public
router.get('/tmdb/popular', async (req, res) => {
  try {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
      console.log('TMDB API key not configured, falling back to local movies');
      return await getLocalMoviesFallback(res);
    }
    
    const page = Math.min(parseInt(req.query.page) || 1, 500);
    
    const resp = await tmdbApiCall(`${process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3'}/movie/popular`, {
      api_key: apiKey, 
      page, 
      language: 'en-US' 
    });
    
    const enhancedResults = resp.data.results
      .filter(movie => movie.id && movie.title) // Filter out movies without ID or title
      .map(movie => ({
        ...movie,
        poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
        backdrop_url: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
        rating: movie.vote_average,
        description: movie.overview,
        genres: movie.genre_ids
      }));
    
    res.json({
      ...resp.data,
      results: enhancedResults
    });
  } catch (error) {
    console.error('TMDB popular error (all retries failed):', error.response?.data || error.message);
    
    // Fallback: return our local movies in TMDB format
    try {
      await getLocalMoviesFallback(res);
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
      res.status(500).json({ 
        message: 'Failed to fetch popular movies from TMDB and fallback failed',
        error: process.env.NODE_ENV === 'development' ? fallbackError.message : 'Internal server error'
      });
    }
  }
});

// Helper function for local movies fallback
async function getLocalMoviesFallback(res) {
  const localMovies = await Movie.find({ isActive: true })
    .sort({ imdbRating: -1 })
    .limit(20)
    .select('-__v');
  
  const tmdbFormatMovies = localMovies
    .filter(movie => movie._id && movie.title) // Filter out movies without ID or title
    .map(movie => ({
      id: movie._id,
      _id: movie._id, // Also include _id for frontend compatibility
      title: movie.title,
      overview: movie.description,
      poster_path: movie.poster?.replace('https://image.tmdb.org/t/p/w500', '') || '',
      backdrop_path: null,
      release_date: movie.releaseDate.toISOString().split('T')[0],
      vote_average: movie.imdbRating,
      genre_ids: [],
      poster_url: movie.poster,
      backdrop_url: null,
      rating: movie.imdbRating,
      description: movie.description,
      genres: []
    }));
  
  res.json({
    page: 1,
    results: tmdbFormatMovies,
    total_pages: 1,
    total_results: tmdbFormatMovies.length,
    fallback: true,
    message: 'Using local database movies as fallback'
  });
}

// @route   GET /api/movies/tmdb/search
// @desc    Search movies on TMDB
// @access  Public
router.get('/tmdb/search', async (req, res) => {
  try {
    const apiKey = process.env.TMDB_API_KEY;
    const query = req.query.q;
    if (!query) return res.status(400).json({ message: 'Search query is required' });
    
    if (!apiKey) {
      console.log('TMDB API key not configured, falling back to local search');
      return await searchLocalMoviesFallback(res, query);
    }
    
    const page = Math.min(parseInt(req.query.page) || 1, 500);
    
    const resp = await tmdbApiCall(`${process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3'}/search/movie`, {
      api_key: apiKey, 
      query, 
      page, 
      language: 'en-US' 
    });
    
    const enhancedResults = resp.data.results
      .filter(movie => movie.id && movie.title) // Filter out movies without ID or title
      .map(movie => ({
        ...movie,
        poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
        backdrop_url: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
        rating: movie.vote_average,
        description: movie.overview,
        genres: movie.genre_ids
      }));
    
    res.json({
      ...resp.data,
      results: enhancedResults
    });
  } catch (error) {
    console.error('TMDB search error (all retries failed):', error.response?.data || error.message);
    
    // Fallback: search local movies
    try {
      await searchLocalMoviesFallback(res, req.query.q);
    } catch (fallbackError) {
      console.error('Search fallback also failed:', fallbackError);
      res.status(500).json({ 
        message: 'Failed to search movies on TMDB and fallback failed',
        error: process.env.NODE_ENV === 'development' ? fallbackError.message : 'Internal server error'
      });
    }
  }
});

// Helper function for local movies search fallback
async function searchLocalMoviesFallback(res, query) {
  const localMovies = await Movie.find({ 
    isActive: true,
    $text: { $search: query }
  })
  .sort({ imdbRating: -1 })
  .limit(20)
  .select('-__v');
  
  const tmdbFormatMovies = localMovies
    .filter(movie => movie._id && movie.title) // Filter out movies without ID or title
    .map(movie => ({
      id: movie._id,
      _id: movie._id, // Also include _id for frontend compatibility
      title: movie.title,
      overview: movie.description,
      poster_path: movie.poster?.replace('https://image.tmdb.org/t/p/w500', '') || '',
      backdrop_path: null,
      release_date: movie.releaseDate.toISOString().split('T')[0],
      vote_average: movie.imdbRating,
      genre_ids: [],
      poster_url: movie.poster,
      backdrop_url: null,
      rating: movie.imdbRating,
      description: movie.description,
      genres: []
    }));
  
  res.json({
    page: 1,
    results: tmdbFormatMovies,
    total_pages: 1,
    total_results: tmdbFormatMovies.length,
    fallback: true,
    message: `Using local database search for "${query}" as fallback`
  });
}

// @route   GET /api/movies/tmdb/:id
// @desc    Get TMDB movie by ID
// @access  Public
router.get('/tmdb/:id', async (req, res) => {
  try {
    const tmdbId = req.params.id;
    
    // Check for undefined or invalid IDs
    if (!tmdbId || tmdbId === 'undefined' || tmdbId === 'null') {
      return res.status(400).json({ 
        message: 'Invalid TMDB movie ID: ID is undefined or null' 
      });
    }
    
    // Validate TMDB ID (should be numeric)
    if (!/^\d+$/.test(tmdbId)) {
      return res.status(400).json({ 
        message: 'Invalid TMDB movie ID format' 
      });
    }
    
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        message: 'TMDB API key not configured' 
      });
    }
    
    // Use the retry logic for TMDB API calls
    const response = await tmdbApiCall(`${process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3'}/movie/${tmdbId}`, {
      api_key: apiKey, 
      language: 'en-US' 
    });
    
    const movie = response.data;
    
    // Format the response to match our local movie format
    const formattedMovie = {
      _id: `tmdb_${movie.id}`,
      id: movie.id,
      title: movie.title,
      description: movie.overview,
      poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
      backdrop: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
      imdbRating: movie.vote_average,
      releaseDate: movie.release_date,
      genre: movie.genres?.map(g => g.name) || [],
      runtime: movie.runtime,
      status: 'now_showing',
      isActive: true,
      source: 'tmdb'
    };
    
    res.json({ movie: formattedMovie });
  } catch (error) {
    console.error('Get TMDB movie error:', error);
    
    // Handle specific error types
    if (error.response?.status === 404) {
      return res.status(404).json({ 
        message: 'TMDB movie not found' 
      });
    }
    
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({ 
        message: 'TMDB service temporarily unavailable. Please try again later.',
        error: 'Network connection issue'
      });
    }
    
    if (error.response?.status === 429) {
      return res.status(429).json({ 
        message: 'Too many requests to TMDB API. Please wait a moment and try again.',
        error: 'Rate limit exceeded'
      });
    }
    
    // Generic error response
    res.status(500).json({ 
      message: 'Server error while fetching TMDB movie',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
