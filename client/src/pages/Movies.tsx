import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../utils/api';

type Movie = {
  id: string | number;
  title: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  release_date: string;
  genre_ids: number[];
  poster_url?: string;
};

const Movies: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loadingProgress, setLoadingProgress] = useState<string>('');
  const [useDatabase, setUseDatabase] = useState<boolean>(false);
  const [genre, setGenre] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const navigate = useNavigate();

  // Read search query from URL parameters on component mount
  useEffect(() => {
    const urlSearchQuery = searchParams.get('search') || '';
    setSearchQuery(urlSearchQuery);
  }, [searchParams]);

  const fetchMovies = useCallback(async (searchTerm: string = '', page: number = 1, append: boolean = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError('');
      setLoadingProgress('');

      let pageMovies: any[] = [];
      if (useDatabase) {
        const params: any = { limit: 20, page };
        if (searchTerm.trim()) params.title = searchTerm.trim();
        if (genre) params.genre = genre;
        if (dateFrom) params.releaseDateFrom = dateFrom;
        if (dateTo) params.releaseDateTo = dateTo;
        const resp = await api.get('/movies', { params });
        pageMovies = (resp.data.movies || []).map((m: any) => ({
          id: m._id,
          title: m.title,
          overview: m.description,
          poster_path: m.poster?.startsWith('http') ? '' : m.poster,
          backdrop_path: '',
          vote_average: m.imdbRating || 0,
          release_date: m.releaseDate ? new Date(m.releaseDate).toISOString().split('T')[0] : '',
          genre_ids: []
        }));
        setTotalPages(resp.data?.pagination?.totalPages || 1);
        setCurrentPage(resp.data?.pagination?.currentPage || page);
      } else {
        const isSearch = Boolean(searchTerm.trim());
        const endpoint = isSearch ? '/movies/tmdb/search' : '/movies/tmdb/popular';
        const params: any = isSearch ? { q: searchTerm.trim(), page } : { page };
        const resp = await api.get(endpoint, { params });
        pageMovies = resp.data?.results || [];
        setTotalPages(resp.data?.total_pages || 1);
        setCurrentPage(resp.data?.page || page);
      }

      if (pageMovies.length === 0) {
        if (!append) {
          if (searchTerm.trim()) {
            setError(`No movies found for "${searchTerm}". Try searching for popular titles like "Avengers", "Batman", or "Star Wars".`);
          } else {
            setError('Unable to load movies at the moment. Please try again later.');
          }
        }
      } else {
        setMovies(prev => append ? [...prev, ...pageMovies] : pageMovies);
      }
    } catch (err: any) {
      if (err.response?.data?.message?.includes('TMDB API key not configured')) {
        setError('🔑 TMDB API key not configured. Please add your API key to the .env file.');
      } else {
        setError(err.response?.data?.message || 'Failed to load movies');
      }
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
      setLoadingProgress('');
    }
  }, [useDatabase, genre, dateFrom, dateTo]);

  useEffect(() => {
    // Reset pagination and load first page when filters change
    setCurrentPage(1);
    setTotalPages(1);
    setMovies([]);
    fetchMovies(searchQuery, 1, false);
  }, [searchQuery, useDatabase, genre, dateFrom, dateTo, fetchMovies]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedMovie) {
        setSelectedMovie(null);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [selectedMovie]);

  // loadMovies replaced by fetchMovies (memoized)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Update URL parameters to reflect the search
    if (searchQuery.trim()) {
      setSearchParams({ search: searchQuery.trim() });
    } else {
      setSearchParams({});
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
      {searchQuery && (
        <p style={{ 
          textAlign: 'center', 
          color: '#666', 
          fontSize: '16px',
          margin: '0 0 30px 0'
        }}>
          Searching TMDB database for movies matching "{searchQuery}"
        </p>
      )}
      {!searchQuery && (
        <p style={{ 
          textAlign: 'center', 
          color: '#666', 
          fontSize: '16px',
          margin: '0 0 30px 0'
        }}>
          Discover trending and popular movies from around the world
        </p>
      )}

      {/* Search & Filters */}
      <form onSubmit={handleSearch} style={{ marginBottom: '30px' }}>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search for movies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginTop: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={useDatabase} onChange={(e) => setUseDatabase(e.target.checked)} />
              <span>Search in Database</span>
            </label>
            <select value={genre} onChange={(e) => setGenre(e.target.value)} style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '8px' }}>
              <option value="">All Genres</option>
              {/* Static fallback; optional improvement: fetch from backend */}
              <option>Action</option><option>Adventure</option><option>Animation</option><option>Biography</option>
              <option>Comedy</option><option>Crime</option><option>Documentary</option><option>Drama</option>
              <option>Family</option><option>Fantasy</option><option>Film-Noir</option><option>History</option>
              <option>Horror</option><option>Music</option><option>Musical</option><option>Mystery</option>
              <option>Romance</option><option>Sci-Fi</option><option>Sport</option><option>Thriller</option>
              <option>War</option><option>Western</option>
            </select>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '8px' }} />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '8px' }} />
          </div>
          <div style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
            <button type="button" onClick={() => { setGenre(''); setDateFrom(''); setDateTo(''); }} style={{ background: '#f5f5f5', border: '1px solid #ddd', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }}>
              Reset Filters
            </button>
          </div>
        </div>
      </form>

      {/* Loading State */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🎬</div>
          <p style={{ color: '#666', fontSize: '18px' }}>
            Loading {searchQuery ? 'search results' : 'popular movies'}...
          </p>
          {loadingProgress && (
            <p style={{ color: '#e50914', fontSize: '16px', fontWeight: 'bold', marginTop: '10px' }}>
              {loadingProgress}
            </p>
          )}
          <p style={{ color: '#999', fontSize: '14px', marginTop: '10px' }}>
            {searchQuery ? 'Fetching up to 40 movies' : 'Fetching up to 60 popular movies'}
          </p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="card" style={{ 
          padding: '30px', 
          textAlign: 'center',
          background: 'rgba(229,9,20,0.1)',
          border: '1px solid rgba(229,9,20,0.3)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>
            {error.includes('No movies found') ? '🔍' : '⚠️'}
          </div>
          <p style={{ color: '#e50914', fontSize: '16px', fontWeight: 'bold' }}>{error}</p>
          {error.includes('API key') && (
            <div style={{ marginTop: '20px', color: '#666', fontSize: '14px' }}>
              <p>To get endless movies:</p>
              <ol style={{ textAlign: 'left', maxWidth: '400px', margin: '0 auto' }}>
                <li>Get free API key from themoviedb.org</li>
                <li>Add TMDB_API_KEY=your_key to .env file</li>
                <li>Restart the backend server</li>
              </ol>
            </div>
          )}
          {error.includes('No movies found') && (
            <div style={{ marginTop: '20px', color: '#666', fontSize: '14px' }}>
              <p><strong>Search Tips:</strong></p>
              <ul style={{ textAlign: 'left', maxWidth: '400px', margin: '10px auto 0' }}>
                <li>Try popular movie titles</li>
                <li>Use simple keywords (e.g., "action", "comedy")</li>
                <li>Check spelling of movie names</li>
                <li>Try searching for actor names</li>
              </ul>
              <button 
                onClick={() => {
                  setSearchQuery(''); 
                  setError('');
                  setSearchParams({}); // Clear URL search parameters
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
            </div>
          )}
        </div>
      )}

      {/* Movies Grid */}
      {!loading && !error && movies.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '16px',
          marginBottom: '20px'
        }}>
          {movies.map((movie) => (
            <div 
              key={movie.id} 
              style={{ textDecoration: 'none' }}
            >
              <div 
                onClick={() => setSelectedMovie(movie)}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  transition: 'transform 0.3s ease',
                  cursor: 'pointer',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)';
                  const overlayBtns = e.currentTarget.querySelectorAll('.overlay-btn');
                  overlayBtns.forEach((btn) => ((btn as HTMLElement).style.opacity = '1'));
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  const overlayBtns = e.currentTarget.querySelectorAll('.overlay-btn');
                  overlayBtns.forEach((btn) => ((btn as HTMLElement).style.opacity = '0'));
                }}
              >
                <div style={{ position: 'relative' }}>
                  <img 
                    src={movie.poster_url || (movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'https://via.placeholder.com/500x750/333/fff?text=No+Image')}
                    alt={movie.title}
                    style={{ 
                      width: '100%', 
                      height: '300px', 
                      objectFit: 'cover'
                    }}
                    onError={(e) => {
                      e.currentTarget.src = 'https://via.placeholder.com/500x750/333/fff?text=No+Image';
                    }}
                  />
                  {/* Overlay Buttons */}
                  <button
                    className="overlay-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const searchQuery = encodeURIComponent(`${movie.title} official trailer`);
                      const youtubeUrl = `https://www.youtube.com/results?search_query=${searchQuery}`;
                      window.open(youtubeUrl, '_blank');
                    }}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: 'rgba(229,9,20,0.9)',
                      color: 'white',
                      border: 'none',
                      padding: '10px 16px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      opacity: '0',
                      transition: 'all 0.3s ease',
                      backdropFilter: 'blur(10px)',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
                    }}
                    title="Watch trailer on YouTube"
                  >
                    ▶️ Trailer
                  </button>
                  <button
                    className="overlay-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const isLocal = typeof movie.id === 'string';
                      if (isLocal) {
                        navigate(`/showtimes?movie=${movie.id}`);
                      } else {
                        const posterUrl = movie.poster_url || (movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '');
                        const qs = new URLSearchParams({
                          movie: `tmdb:${String(movie.id)}`,
                          title: movie.title,
                          poster: posterUrl,
                          rating: String(movie.vote_average || 0)
                        }).toString();
                        navigate(`/showtimes?${qs}`);
                      }
                    }}
                    style={{
                      position: 'absolute',
                      top: '65%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: 'rgba(0,0,0,0.75)',
                      color: 'white',
                      border: '1px solid rgba(255,255,255,0.3)',
                      padding: '10px 16px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      opacity: '0',
                      transition: 'all 0.3s ease',
                      backdropFilter: 'blur(10px)',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
                    }}
                    title="Book tickets for this movie"
                  >
                    🎫 Book Tickets
                  </button>
                </div>
                <div style={{ padding: '15px' }}>
                  <h3 style={{ 
                    margin: '0 0 8px 0', 
                    fontSize: '16px', 
                    fontWeight: 'bold',
                    color: '#000',
                    lineHeight: '1.3',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {movie.title}
                  </h3>
                  <p style={{ 
                    color: '#666', 
                    fontSize: '13px',
                    lineHeight: '1.4',
                    margin: '0 0 10px 0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {movie.overview}
                  </p>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '10px'
                  }}>
                    <span style={{ 
                      color: '#ffa500', 
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}>
                      ⭐ {movie.vote_average.toFixed(1)}
                    </span>
                    <span style={{ 
                      color: '#666', 
                      fontSize: '12px'
                    }}>
                      {new Date(movie.release_date).getFullYear()}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const isLocal = typeof movie.id === 'string';
                      if (isLocal) {
                        navigate(`/showtimes?movie=${movie.id}`);
                      } else {
                        const posterUrl = movie.poster_url || (movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '');
                        const qs = new URLSearchParams({
                          movie: `tmdb:${String(movie.id)}`,
                          title: movie.title,
                          poster: posterUrl,
                          rating: String(movie.vote_average || 0)
                        }).toString();
                        navigate(`/showtimes?${qs}`);
                      }
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #e50914, #b20710)',
                      color: 'white',
                      padding: '8px 16px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      textAlign: 'center',
                      boxShadow: '0 2px 8px rgba(229,9,20,0.3)',
                      border: 'none',
                      width: '100%',
                      cursor: 'pointer'
                    }}
                  >
                    Book Tickets
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load More */}
      {!loading && !error && movies.length > 0 && currentPage < totalPages && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
          <button
            type="button"
            onClick={() => fetchMovies(searchQuery, currentPage + 1, true)}
            disabled={loadingMore}
            style={{
              background: loadingMore ? '#aaa' : 'linear-gradient(135deg, #e50914, #b20710)',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '25px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: loadingMore ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 15px rgba(229,9,20,0.3)'
            }}
          >
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}

      {/* Movie Details Modal */}
      {selectedMovie && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(10px)',
          padding: '20px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
            borderRadius: '20px',
            maxWidth: '800px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            position: 'relative',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            {/* Close Button */}
            <button
              onClick={() => setSelectedMovie(null)}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: 'rgba(255,255,255,0.1)',
                color: 'white',
                border: 'none',
                padding: '8px 12px',
                borderRadius: '50%',
                fontSize: '18px',
                cursor: 'pointer',
                zIndex: 1001
              }}
            >
              ✕
            </button>

            {/* Modal Content */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 2fr',
              gap: '30px',
              padding: '30px'
            }}>
              {/* Movie Poster */}
              <div>
                <img 
                  src={selectedMovie.poster_path 
                    ? `https://image.tmdb.org/t/p/w500${selectedMovie.poster_path}` 
                    : 'https://via.placeholder.com/500x750/333/fff?text=No+Image'}
                  alt={selectedMovie.title}
                  style={{ 
                    width: '100%', 
                    height: '400px', 
                    objectFit: 'cover',
                    borderRadius: '15px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                  }}
                />
              </div>

              {/* Movie Details */}
              <div style={{ color: 'white' }}>
                <h2 style={{ 
                  margin: '0 0 15px 0', 
                  fontSize: '28px',
                  fontWeight: 'bold',
                  color: '#fff'
                }}>
                  {selectedMovie.title}
                </h2>

                <div style={{ 
                  display: 'flex', 
                  gap: '10px', 
                  marginBottom: '20px', 
                  flexWrap: 'wrap' 
                }}>
                  <span style={{ 
                    background: 'linear-gradient(135deg, #feca57, #ff9ff3)',
                    padding: '6px 12px', 
                    borderRadius: '15px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: '#333'
                  }}>
                    ⭐ {selectedMovie.vote_average?.toFixed(1)}
                  </span>
                  <span style={{ 
                    background: 'linear-gradient(135deg, #5f27cd, #00d2d3)',
                    padding: '6px 12px', 
                    borderRadius: '15px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {new Date(selectedMovie.release_date).getFullYear()}
                  </span>
                </div>

                <p style={{ 
                  fontSize: '16px', 
                  lineHeight: '1.6', 
                  marginBottom: '25px',
                  color: 'rgba(255,255,255,0.9)'
                }}>
                  {selectedMovie.overview || 'No description available.'}
                </p>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      const searchQuery = encodeURIComponent(`${selectedMovie.title} official trailer`);
                      const youtubeUrl = `https://www.youtube.com/results?search_query=${searchQuery}`;
                      window.open(youtubeUrl, '_blank');
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #e50914, #b20710)',
                      color: 'white',
                      border: 'none',
                      padding: '12px 24px',
                      borderRadius: '25px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      boxShadow: '0 4px 15px rgba(229,9,20,0.4)'
                    }}
                  >
                    ▶️ Watch Trailer
                  </button>
                  
                  <button
                    onClick={() => {
                      const isLocal = typeof selectedMovie.id === 'string';
                      if (isLocal) {
                        navigate(`/showtimes?movie=${selectedMovie.id}`);
                      } else {
                        const posterUrl = selectedMovie.poster_url || (selectedMovie.poster_path ? `https://image.tmdb.org/t/p/w500${selectedMovie.poster_path}` : '');
                        const qs = new URLSearchParams({
                          movie: `tmdb:${String(selectedMovie.id)}`,
                          title: selectedMovie.title,
                          poster: posterUrl,
                          rating: String(selectedMovie.vote_average || 0)
                        }).toString();
                        navigate(`/showtimes?${qs}`);
                      }
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      color: 'white',
                      border: '2px solid rgba(255,255,255,0.3)',
                      padding: '10px 20px',
                      borderRadius: '25px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    🎫 Book Tickets
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Movie Count Display */}
      {!loading && !error && movies.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: '40px', color: '#666' }}>
          <p>🎬 Showing {movies.length} {searchQuery ? 'search results' : 'popular movies'}</p>
          {!searchQuery && (
            <p style={{ fontSize: '14px', marginTop: '10px' }}>
              Displaying the most popular movies from TMDB
            </p>
          )}
        </div>
      )}

      {/* No Results */}
      {!loading && !error && movies.length === 0 && (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔍</div>
          <h3 style={{ color: '#333', marginBottom: '15px' }}>No movies found</h3>
          <p style={{ color: '#666' }}>Try a different search term or check your API configuration.</p>
        </div>
      )}
    </div>
  );
};

export default Movies;


