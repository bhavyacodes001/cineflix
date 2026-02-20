import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../utils/api';
import '../styles/animations.css';
import LoadingSpinner from '../components/LoadingSpinner';

type Movie = {
  _id: string;
  id?: string | number;
  title: string;
  description: string;
  overview?: string;
  poster: string;
  poster_path?: string;
  backdrop_path?: string;
  imdbRating: number;
  vote_average?: number;
  releaseDate: string;
  release_date?: string;
  genre: string[];
  genre_ids?: number[];
  poster_url?: string;
  basePrice?: number;
  cast?: { name: string }[];
  director?: string;
  duration?: number;
  rating?: string;
  language?: string;
  subtitles?: string[];
  status?: string;
  trailer?: string;
  isActive?: boolean;
};

const Movies: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const navigate = useNavigate();

  // Read search query from URL parameters on component mount
  useEffect(() => {
    const urlSearchQuery = searchParams.get('search') || '';
    setSearchQuery(urlSearchQuery);
  }, [searchParams]);

  const fetchMovies = useCallback(async (searchTerm: string = '') => {
    try {
      setLoading(true);
      setError('');

      let pageMovies: any[] = [];
      
      if (searchTerm.trim()) {
        // Search movies
        const resp = await api.get('/movies/tmdb/search', { 
          params: { q: searchTerm.trim(), page: 1 } 
        });
        pageMovies = resp.data?.results || [];
      } else {
        // Get popular movies
        const resp = await api.get('/movies/tmdb/popular', { 
          params: { page: 1 } 
        });
        pageMovies = resp.data?.results || [];
      }

      if (pageMovies.length === 0) {
        if (searchTerm.trim()) {
          setError(`No movies found for "${searchTerm}". Try searching for popular titles like "Avengers", "Batman", or "Star Wars".`);
        } else {
          setError('Unable to load movies at the moment. Please try again later.');
        }
      } else {
        setMovies(pageMovies);
      }
    } catch (err: any) {
      console.error('Movie fetch error:', err);
      
      if (err.response?.data?.message?.includes('TMDB API key not configured')) {
        setError('🔑 TMDB API key not configured. Please add your API key to the .env file.');
      } else if (err.response?.status === 429) {
        setError('⏰ Too many requests. Please wait a moment and try again.');
      } else if (err.response?.status === 500) {
        setError('🔧 Server error. Please try again or contact support if the issue persists.');
      } else if (err.code === 'NETWORK_ERROR' || !err.response) {
        setError('🌐 Network error. Please check your internet connection and try again.');
      } else {
        setError(err.response?.data?.message || 'Failed to load movies. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMovies(searchQuery);
  }, [searchQuery, fetchMovies]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSearchParams({ search: searchQuery.trim() });
    } else {
      setSearchParams({});
    }
  };

  const handleMovieClick = (movie: any) => {
    const movieId = movie._id || movie.id;
    
    if (movieId && movieId !== 'undefined' && movieId !== 'null') {
      // Check if it's a TMDB movie (numeric ID) or local movie (ObjectId)
      if (typeof movieId === 'number' || /^\d+$/.test(String(movieId))) {
        // TMDB movie
        navigate(`/movies/tmdb/${movieId}`);
      } else if (/^[0-9a-fA-F]{24}$/.test(String(movieId))) {
        // Local database movie (valid ObjectId)
        navigate(`/movies/${movieId}`);
      } else {
        setError('Invalid movie ID format. Please try again.');
      }
    } else {
      setError('Invalid movie data. Please try again.');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ 
        fontSize: '32px', 
        fontWeight: 'bold', 
        margin: '0 0 10px 0',
        color: '#333',
        textAlign: 'center'
      }}>
        {searchQuery ? `Search Results for "${searchQuery}"` : 'Popular Movies'}
      </h1>

      {/* Search */}
      <form onSubmit={handleSearch} style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', justifyContent: 'center' }}>
          <input
            type="text"
            placeholder="Search for movies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              maxWidth: '400px',
              padding: '12px 20px',
              border: '1px solid #ddd',
              borderRadius: '25px',
              fontSize: '14px',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            style={{
              background: 'linear-gradient(135deg, #e50914, #b20710)',
              color: 'white',
              border: 'none',
              padding: '12px 25px',
              borderRadius: '25px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Search
          </button>
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setError('');
                setSearchParams({});
              }}
              style={{
                background: '#666',
                color: 'white',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '25px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {/* Loading State */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <LoadingSpinner size="large" text={`Loading ${searchQuery ? 'search results' : 'popular movies'}...`} />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div style={{ 
          padding: '30px', 
          textAlign: 'center',
          background: 'rgba(229,9,20,0.1)',
          border: '1px solid rgba(229,9,20,0.3)',
          borderRadius: '12px',
          marginBottom: '30px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>
            {error.includes('No movies found') ? '🔍' : '⚠️'}
          </div>
          <p style={{ color: '#e50914', fontSize: '16px', fontWeight: 'bold' }}>{error}</p>
          {error.includes('No movies found') && (
            <button 
              onClick={() => {
                setSearchQuery(''); 
                setError('');
                setSearchParams({});
              }}
              style={{
                background: '#e50914',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '14px',
                cursor: 'pointer',
                marginTop: '15px'
              }}
            >
              View Popular Movies
            </button>
          )}
        </div>
      )}

      {/* Movies Grid - Ultra Simple Layout */}
      {!loading && !error && movies.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '15px',
          marginBottom: '20px'
        }}>
          {movies.map((movie, index) => (
            <div 
              key={movie.id || movie._id || index}
              style={{
                background: '#fff',
                borderRadius: '6px',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                border: '1px solid #eee'
              }}
              onClick={() => handleMovieClick(movie)}
            >
              <img 
                src={movie.poster || movie.poster_url || (movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'https://via.placeholder.com/500x750/333/fff?text=No+Image')}
                alt={movie.title}
                style={{ 
                  width: '100%', 
                  height: '250px', 
                  objectFit: 'cover'
                }}
                onError={(e) => {
                  e.currentTarget.src = 'https://via.placeholder.com/500x750/333/fff?text=No+Image';
                }}
              />
              <div style={{ padding: '10px' }}>
                <h3 style={{ 
                  margin: '0 0 5px 0', 
                  fontSize: '14px', 
                  fontWeight: 'bold',
                  color: '#333',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {movie.title}
                </h3>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  fontSize: '12px'
                }}>
                  <span style={{ 
                    background: '#e50914',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontWeight: 'bold'
                  }}>
                    {(movie.imdbRating || movie.vote_average || 0).toFixed(1)}
                  </span>
                  <span style={{ color: '#666' }}>
                    {new Date(movie.releaseDate || movie.release_date || '').getFullYear()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Movie Count Display */}
      {!loading && !error && movies.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: '40px', color: '#666' }}>
          <p>🎬 Showing {movies.length} {searchQuery ? 'search results' : 'popular movies'}</p>
        </div>
      )}

      {/* No Results */}
      {!loading && !error && movies.length === 0 && (
        <div style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔍</div>
          <h3 style={{ color: '#333', marginBottom: '15px' }}>No movies found</h3>
          <p style={{ color: '#666' }}>Try a different search term or check your API configuration.</p>
        </div>
      )}
    </div>
  );
};

export default Movies;