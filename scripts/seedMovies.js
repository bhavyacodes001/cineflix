/* eslint-disable no-console */
const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

const Movie = require('../models/Movie');

// TMDB API configuration
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';

// Function to fetch popular movies from TMDB
async function fetchPopularMovies(page = 1) {
  try {
    const response = await axios.get(`${TMDB_BASE_URL}/movie/popular`, {
      params: {
        api_key: TMDB_API_KEY,
        page: page,
        language: 'en-US'
      },
      timeout: 10000, // 10 second timeout
      headers: {
        'User-Agent': 'Movie-Booking-System/1.0'
      }
    });
    return response.data.results;
  } catch (error) {
    console.error('Error fetching movies from TMDB:', error.message);
    return [];
  }
}

// Function to get movie details including cast
async function getMovieDetails(movieId) {
  try {
    const [movieResponse, creditsResponse] = await Promise.all([
      axios.get(`${TMDB_BASE_URL}/movie/${movieId}`, {
        params: { api_key: TMDB_API_KEY },
        timeout: 10000,
        headers: { 'User-Agent': 'Movie-Booking-System/1.0' }
      }),
      axios.get(`${TMDB_BASE_URL}/movie/${movieId}/credits`, {
        params: { api_key: TMDB_API_KEY },
        timeout: 10000,
        headers: { 'User-Agent': 'Movie-Booking-System/1.0' }
      })
    ]);
    
    return {
      movie: movieResponse.data,
      credits: creditsResponse.data
    };
  } catch (error) {
    console.error(`Error fetching details for movie ${movieId}:`, error.message);
    return null;
  }
}

// Function to convert TMDB movie data to our schema format
function convertTMDBToOurFormat(tmdbMovie, credits) {
  const now = new Date();
  
  return {
    title: tmdbMovie.title,
    description: tmdbMovie.overview || 'No description available',
    genre: tmdbMovie.genres ? tmdbMovie.genres.map(g => mapTMDBGenreToOurs(g.name)).filter(Boolean) : ['Drama'],
    director: credits.crew.find(person => person.job === 'Director')?.name || 'Unknown Director',
    cast: credits.cast.slice(0, 5).map(actor => ({ name: actor.name })), // Top 5 cast members
    releaseDate: new Date(tmdbMovie.release_date || now),
    duration: tmdbMovie.runtime || 120,
    rating: getRatingFromTMDB(tmdbMovie.adult),
    poster: tmdbMovie.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbMovie.poster_path}` : 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=1200&auto=format&fit=crop',
    trailer: `https://www.youtube.com/results?search_query=${encodeURIComponent(tmdbMovie.title + ' trailer')}`,
    language: getLanguageName(tmdbMovie.original_language),
    subtitles: ['English'],
    imdbRating: tmdbMovie.vote_average || 0,
    status: getMovieStatus(tmdbMovie.release_date),
    basePrice: getRandomPrice(),
    isActive: true
  };
}

// Helper functions
function mapTMDBGenreToOurs(tmdbGenre) {
  // Map TMDB genres to our allowed genres
  const genreMap = {
    'Action': 'Action',
    'Adventure': 'Adventure',
    'Animation': 'Animation',
    'Comedy': 'Comedy',
    'Crime': 'Crime',
    'Documentary': 'Documentary',
    'Drama': 'Drama',
    'Family': 'Family',
    'Fantasy': 'Fantasy',
    'History': 'History',
    'Horror': 'Horror',
    'Music': 'Music',
    'Mystery': 'Mystery',
    'Romance': 'Romance',
    'Science Fiction': 'Sci-Fi', // TMDB uses "Science Fiction", we use "Sci-Fi"
    'TV Movie': 'Drama', // Map TV Movie to Drama
    'Thriller': 'Thriller',
    'War': 'War',
    'Western': 'Western'
  };
  
  return genreMap[tmdbGenre] || 'Drama'; // Default to Drama if no mapping found
}

function getRatingFromTMDB(adult) {
  return adult ? 'R' : 'PG-13';
}

function getLanguageName(langCode) {
  const languages = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'ja': 'English', // Map Japanese to English to avoid indexing issues
    'ko': 'English', // Map Korean to English
    'zh': 'English'  // Map Chinese to English
  };
  return languages[langCode] || 'English';
}

function getMovieStatus(releaseDate) {
  const now = new Date();
  const release = new Date(releaseDate);
  const diffTime = release - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays > 7) return 'upcoming';
  if (diffDays < -30) return 'ended';
  return 'now_showing';
}

function getRandomPrice() {
  const prices = [9.0, 9.5, 10.0, 10.5, 11.0, 11.5, 12.0];
  return prices[Math.floor(Math.random() * prices.length)];
}

async function run() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/movie-ticket-booking';
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  const existing = await Movie.countDocuments({});
  if (existing > 0) {
    console.log(`Movies already present (${existing}). Skipping seed.`);
    await mongoose.disconnect();
    return;
  }

  // Check if TMDB API key is available
  if (!TMDB_API_KEY) {
    console.error('TMDB_API_KEY not found in environment variables. Please add it to your .env file.');
    await mongoose.disconnect();
    return;
  }

  console.log('Fetching popular movies from TMDB...');
  
  try {
    // Fetch popular movies from TMDB
    const popularMovies = await fetchPopularMovies(1);
    
    if (popularMovies.length === 0) {
      console.log('No movies fetched from TMDB. Using fallback sample data.');
      // Fallback to sample data if TMDB fails
      const now = new Date();
      const fallbackMovies = [
        {
          title: 'The Galactic Odyssey',
          description: 'A crew of explorers ventures beyond the known universe to save humanity.',
          genre: ['Sci-Fi', 'Adventure'],
          director: 'Lena Hart',
          cast: [{ name: 'A. Rivera' }, { name: 'C. Chen' }],
          releaseDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 10),
          duration: 132,
          rating: 'PG-13',
          poster: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=1200&auto=format&fit=crop',
          trailerUrl: 'https://example.com/trailer1',
          language: 'English',
          subtitles: ['Spanish', 'French'],
          imdbRating: 8.2,
          status: 'now_showing',
          basePrice: 10.0,
          isActive: true
        }
      ];
      
      await Movie.insertMany(fallbackMovies);
      console.log('Seeded fallback movies:', fallbackMovies.map(s => s.title));
      await mongoose.disconnect();
      return;
    }

    // Get detailed information for the first 10 movies
    const moviesToSeed = [];
    console.log(`Processing ${Math.min(10, popularMovies.length)} movies...`);
    
    for (let i = 0; i < Math.min(10, popularMovies.length); i++) {
      const movie = popularMovies[i];
      console.log(`Fetching details for: ${movie.title}`);
      
      const details = await getMovieDetails(movie.id);
      if (details) {
        try {
          const formattedMovie = convertTMDBToOurFormat(details.movie, details.credits);
          // Ensure genre array is not empty and has valid values
          if (!formattedMovie.genre || formattedMovie.genre.length === 0) {
            formattedMovie.genre = ['Drama'];
          }
          moviesToSeed.push(formattedMovie);
        } catch (formatError) {
          console.error(`Error formatting movie ${movie.title}:`, formatError.message);
        }
      }
      
      // Add a small delay to avoid hitting rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (moviesToSeed.length > 0) {
      try {
        await Movie.insertMany(moviesToSeed, { ordered: false }); // Continue on individual errors
        console.log(`Successfully seeded ${moviesToSeed.length} movies from TMDB:`);
        moviesToSeed.forEach(movie => console.log(`- ${movie.title} (${movie.status})`));
      } catch (insertError) {
        console.error('Error inserting movies:', insertError.message);
        
        // Try inserting movies one by one to identify problematic ones
        console.log('Attempting to insert movies individually...');
        let successCount = 0;
        for (const movie of moviesToSeed) {
          try {
            await Movie.create(movie);
            console.log(`✓ Successfully inserted: ${movie.title}`);
            successCount++;
          } catch (singleError) {
            console.error(`✗ Failed to insert ${movie.title}:`, singleError.message);
          }
        }
        console.log(`Successfully inserted ${successCount} out of ${moviesToSeed.length} movies.`);
      }
    } else {
      console.log('No movies were successfully processed.');
    }

  } catch (error) {
    console.error('Error during seeding process:', error.message);
  }
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});


