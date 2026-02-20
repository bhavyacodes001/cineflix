import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../utils/api';
import '../styles/animations.css';
import LoadingSpinner from '../components/LoadingSpinner';

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
  const [cache, setCache] = useState<Map<string, any>>(new Map());
  const navigate = useNavigate();

  // Read search query from URL parameters on component mount
  useEffect(() => {
    const urlSearchQuery = searchParams.get('search') || '';
    setSearchQuery(urlSearchQuery);
  }, [searchParams]);

  const fetchMovies = useCallback(async (searchTerm: string = '', page: number = 1, append: boolean = false) => {
    try {
      console.log('fetchMovies called:', { searchTerm, page, append, useDatabase });
      
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError('');
      setLoadingProgress('');

      // Create cache key
      const cacheKey = `${searchTerm}-${page}-${useDatabase}-${genre}-${dateFrom}-${dateTo}`;
      
      // Check cache first (only for non-append requests)
      if (!append && cache.has(cacheKey)) {
        const cachedData = cache.get(cacheKey);
        setMovies(cachedData.movies);
        setTotalPages(cachedData.totalPages);
        setCurrentPage(cachedData.currentPage);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      let pageMovies: any[] = [];
      let responseData: any = null;
      
      if (useDatabase) {
        const params: any = { limit: 20, page };
        if (searchTerm.trim()) params.title = searchTerm.trim();
        if (genre) params.genre = genre;
        if (dateFrom) params.releaseDateFrom = dateFrom;
        if (dateTo) params.releaseDateTo = dateTo;
        
        setLoadingProgress('Fetching from database...');
        const resp = await api.get('/movies', { params });
        responseData = resp.data;
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
        
        setLoadingProgress(isSearch ? 'Searching TMDB...' : 'Loading popular movies...');
        const resp = await api.get(endpoint, { params });
        responseData = resp.data;
        pageMovies = resp.data?.results || [];
        console.log('TMDB API response:', { 
          page, 
          append, 
          resultsCount: pageMovies.length, 
          totalPages: resp.data?.total_pages,
          currentPage: resp.data?.page 
        });
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
        if (append) {
          // For append requests, use functional update to get the latest movies state
          console.log('Appending movies:', { 
            currentMoviesCount: movies.length, 
            newMoviesCount: pageMovies.length,
            totalAfterAppend: movies.length + pageMovies.length 
          });
          setMovies(prevMovies => [...prevMovies, ...pageMovies]);
        } else {
          setMovies(pageMovies);
          
          // Cache the results (only for non-append requests)
          if (responseData) {
            setCache(prev => {
              const newCache = new Map(prev);
              newCache.set(cacheKey, {
                movies: pageMovies,
                totalPages: responseData?.total_pages || responseData?.pagination?.totalPages || 1,
                currentPage: responseData?.page || responseData?.pagination?.currentPage || page,
                timestamp: Date.now()
              });
              // Keep only last 10 cache entries
              if (newCache.size > 10) {
                const firstKey = newCache.keys().next().value;
                newCache.delete(firstKey);
              }
              return newCache;
            });
          }
        }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useDatabase, genre, dateFrom, dateTo, cache]);

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

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery !== searchParams.get('search')) {
        if (searchQuery.trim()) {
          setSearchParams({ search: searchQuery.trim() });
        } else {
          setSearchParams({});
        }
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Immediate search on form submit
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
        <div>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <LoadingSpinner size="large" text={`Loading ${searchQuery ? 'search results' : 'popular movies'}...`} />
            {loadingProgress && (
              <p style={{ color: '#e50914', fontSize: '16px', fontWeight: 'bold', marginTop: '20px' }}>
                {loadingProgress}
              </p>
            )}
            <p style={{ color: '#999', fontSize: '14px', marginTop: '20px' }}>
              {searchQuery ? 'Fetching up to 40 movies' : 'Fetching up to 60 popular movies'}
            </p>
          </div>
          
          {/* Loading Skeleton */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '24px',
            marginBottom: '20px'
          }}>
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} style={{
                background: '#ffffff',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                animation: 'pulse 1.5s ease-in-out infinite'
              }}>
                <div style={{
                  width: '100%',
                  height: '320px',
                  backgroundColor: '#f0f0f0',
                  borderRadius: '12px 12px 0 0'
                }} />
                <div style={{ padding: '18px' }}>
                  <div style={{
                    height: '20px',
                    backgroundColor: '#f0f0f0',
                    borderRadius: '4px',
                    marginBottom: '10px'
                  }} />
                  <div style={{
                    height: '16px',
                    backgroundColor: '#f0f0f0',
                    borderRadius: '4px',
                    marginBottom: '8px'
                  }} />
                  <div style={{
                    height: '16px',
                    backgroundColor: '#f0f0f0',
                    borderRadius: '4px',
                    marginBottom: '12px',
                    width: '60%'
                  }} />
                  <div style={{
                    height: '12px',
                    backgroundColor: '#f0f0f0',
                    borderRadius: '4px',
                    marginBottom: '15px'
                  }} />
                  <div style={{
                    height: '40px',
                    backgroundColor: '#f0f0f0',
                    borderRadius: '8px'
                  }} />
                </div>
              </div>
            ))}
          </div>
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
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '24px',
          marginBottom: '20px'
        }}>
          {movies.map((movie, index) => (
            <div 
              key={movie.id} 
              className={`animate-fade-in-scale animate-delay-${(index % 5) + 1}`}
              style={{ textDecoration: 'none' }}
            >
              <div 
                className="movie-card-enhanced"
                onClick={() => setSelectedMovie(movie)}
                style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
              >
                <div style={{ position: 'relative' }}>
                  <img 
                    src={movie.poster_url || (movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'https://via.placeholder.com/500x750/333/fff?text=No+Image')}
                    alt={movie.title}
                    loading="lazy"
                    style={{ 
                      width: '100%', 
                      height: '320px', 
                      objectFit: 'cover',
                      borderRadius: '12px 12px 0 0',
                      backgroundColor: '#f0f0f0'
                    }}
                    onError={(e) => {
                      e.currentTarget.src = 'https://via.placeholder.com/500x750/333/fff?text=No+Image';
                    }}
                    onLoad={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  />
                  {/* Overlay Buttons Container */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.4)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '12px',
                    opacity: '0',
                    transition: 'all 0.3s ease',
                    backdropFilter: 'blur(5px)'
                  }}
                  className="overlay-container"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '0';
                  }}
                  >
                    <button
                      className="btn-enhanced"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const searchQuery = encodeURIComponent(`${movie.title} official trailer`);
                        const youtubeUrl = `https://www.youtube.com/results?search_query=${searchQuery}`;
                        window.open(youtubeUrl, '_blank');
                      }}
                      style={{
                        background: 'rgba(229,9,20,0.9)',
                        color: 'white',
                        border: 'none',
                        padding: '12px 20px',
                        borderRadius: '25px',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        backdropFilter: 'blur(10px)',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                        minWidth: '140px'
                      }}
                      title="Watch trailer on YouTube"
                    >
                      ▶️ Trailer
                    </button>
                    <button
                      className="btn-enhanced"
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
                        background: 'rgba(0,0,0,0.8)',
                        color: 'white',
                        border: '2px solid rgba(255,255,255,0.3)',
                        padding: '12px 20px',
                        borderRadius: '25px',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        backdropFilter: 'blur(10px)',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                        minWidth: '140px'
                      }}
                      title="Book tickets for this movie"
                    >
                      🎫 Book Tickets
                    </button>
                  </div>
                </div>
                <div className="movie-info" style={{ 
                  padding: '18px',
                  borderRadius: '0 0 12px 12px',
                  marginTop: '-4px'
                }}>
                  <h3 className="movie-title" style={{ 
                    margin: '0 0 10px 0', 
                    fontSize: '16px', 
                    fontWeight: 'bold',
                    lineHeight: '1.3',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    minHeight: '42px'
                  }}>
                    {movie.title}
                  </h3>
                  <p className="movie-meta" style={{ 
                    fontSize: '13px',
                    lineHeight: '1.4',
                    margin: '0 0 12px 0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    minHeight: '55px',
                    color: '#555'
                  }}>
                    {movie.overview}
                  </p>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '15px'
                  }}>
                    <span style={{ 
                      background: 'linear-gradient(135deg, #ffa500, #ff8c00)',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      ⭐ {movie.vote_average.toFixed(1)}
                    </span>
                    <span style={{ 
                      color: '#666', 
                      fontSize: '12px',
                      fontWeight: '500',
                      background: '#f0f0f0',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      backdropFilter: 'none',
                      border: 'none'
                    }}>
                      {new Date(movie.release_date).getFullYear()}
                    </span>
                  </div>
                  <button
                    className="btn-enhanced btn-primary-enhanced"
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
                      fontSize: '13px',
                      padding: '10px 16px',
                      width: '100%'
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
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => {
              console.log('Load More clicked:', { currentPage, totalPages, searchQuery });
              fetchMovies(searchQuery, currentPage + 1, true);
            }}
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
              boxShadow: '0 4px 15px rgba(229,9,20,0.3)',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              if (!loadingMore) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(229,9,20,0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loadingMore) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(229,9,20,0.3)';
              }
            }}
          >
            {loadingMore ? 'Loading more movies...' : `Load more (Page ${currentPage + 1} of ${totalPages})`}
          </button>
          {loadingMore && (
            <div style={{ 
              fontSize: '12px', 
              color: '#666',
              textAlign: 'center'
            }}>
              Fetching next page of movies...
            </div>
          )}
        </div>
      )}

      {/* Enhanced Movie Details Modal */}
      {selectedMovie && (
        <div className="modal-enhanced"
        onClick={() => setSelectedMovie(null)}
        >
          <div className="modal-content-enhanced"
          onClick={(e) => e.stopPropagation()}
          >
            {/* Enhanced Close Button */}
            <button
              onClick={() => setSelectedMovie(null)}
              className="btn-enhanced"
              style={{ 
                position: 'absolute', 
                top: 20, 
                right: 20, 
                background: 'rgba(255,255,255,0.1)',
                color: 'white', 
                border: 'none', 
                padding: '12px 16px', 
                borderRadius: '50%', 
                cursor: 'pointer',
                fontSize: '18px',
                fontWeight: 'bold',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                zIndex: 10
              }}
            >
              ✕
            </button>

            {/* Enhanced Movie Content */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1.5fr', 
              gap: '32px', 
              padding: '32px',
              alignItems: 'start'
            }}>
              {/* Enhanced Movie Poster */}
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'relative',
                  borderRadius: '20px',
                  overflow: 'hidden',
                  boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
                  transition: 'transform 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                >
                  <img 
                    src={selectedMovie.poster_url || (selectedMovie.poster_path ? `https://image.tmdb.org/t/p/w500${selectedMovie.poster_path}` : 'https://via.placeholder.com/500x750/333/fff?text=No+Image')}
                    alt={selectedMovie.title} 
                    style={{ 
                      width: '100%', 
                      height: '450px', 
                      objectFit: 'cover',
                      display: 'block'
                    }} 
                  />
                </div>
                
                {/* Movie Rating Badge */}
                <div style={{
                  position: 'absolute',
                  top: '20px',
                  left: '20px',
                  background: 'linear-gradient(135deg, #ffa500, #ff8c00)',
                  color: 'white',
                  padding: '8px 12px',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                  backdropFilter: 'blur(10px)'
                }}>
                  ⭐ {selectedMovie.vote_average?.toFixed(1)}
                </div>
              </div>

              {/* Enhanced Movie Details */}
              <div style={{ 
                color: 'white', 
                paddingTop: '20px',
                background: 'rgba(0, 0, 0, 0.7)',
                borderRadius: '20px',
                padding: '24px',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                {/* Movie Title */}
                <h1 style={{ 
                  margin: '0 0 16px 0', 
                  fontSize: '32px',
                  fontWeight: 'bold',
                  color: '#ffffff',
                  textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                  lineHeight: '1.2'
                }}>
                  {selectedMovie.title}
                </h1>

                {/* Movie Meta Info */}
                <div style={{ 
                  display: 'flex', 
                  gap: '12px', 
                  marginBottom: '20px',
                  flexWrap: 'wrap',
                  alignItems: 'center'
                }}>
                  <span style={{ 
                    background: 'linear-gradient(135deg, #e50914, #b20710)', 
                    color: 'white', 
                    padding: '8px 16px', 
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                  }}>
                    PG-13
                  </span>
                  
                  <span style={{ 
                    background: 'rgba(255,255,255,0.1)', 
                    color: 'white', 
                    padding: '8px 16px', 
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '500',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.2)'
                  }}>
                    Movie
                  </span>
                  
                  <span style={{ 
                    color: 'rgba(255,255,255,0.7)', 
                    fontSize: '14px',
                    fontWeight: '500'
                  }}>
                    {new Date(selectedMovie.release_date).getFullYear()}
                  </span>
                </div>

                {/* Movie Description */}
                <p style={{ 
                  color: '#ffffff', 
                  lineHeight: 1.7, 
                  marginBottom: '24px',
                  fontSize: '16px',
                  textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                  fontWeight: '400'
                }}>
                  {selectedMovie.overview || 'No description available.'}
                </p>

                {/* Movie Details */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '16px',
                  marginBottom: '24px'
                }}>
                  <div>
                    <span style={{ 
                      color: 'rgba(255,255,255,0.8)', 
                      fontSize: '14px',
                      fontWeight: '600',
                      textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                    }}>Release Year</span>
                    <div style={{ 
                      color: '#ffffff', 
                      fontWeight: '500',
                      textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                    }}>{new Date(selectedMovie.release_date).getFullYear()}</div>
                  </div>
                  
                  <div>
                    <span style={{ 
                      color: 'rgba(255,255,255,0.8)', 
                      fontSize: '14px',
                      fontWeight: '600',
                      textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                    }}>Rating</span>
                    <div style={{ 
                      color: '#ffffff', 
                      fontWeight: '500',
                      textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                    }}>{selectedMovie.vote_average?.toFixed(1)}/10</div>
                  </div>
                  
                  <div>
                    <span style={{ 
                      color: 'rgba(255,255,255,0.8)', 
                      fontSize: '14px',
                      fontWeight: '600',
                      textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                    }}>Release Date</span>
                    <div style={{ 
                      color: '#ffffff', 
                      fontWeight: '500',
                      textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                    }}>
                      {new Date(selectedMovie.release_date).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </div>
                  </div>
                  
                  <div>
                    <span style={{ 
                      color: 'rgba(255,255,255,0.8)', 
                      fontSize: '14px',
                      fontWeight: '600',
                      textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                    }}>Source</span>
                    <div style={{ 
                      color: '#ffffff', 
                      fontWeight: '500',
                      textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                    }}>TMDB</div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <button
                    className="btn-enhanced btn-primary-enhanced"
                    onClick={() => {
                      const q = encodeURIComponent(`${selectedMovie.title} official trailer`);
                      window.open(`https://www.youtube.com/results?search_query=${q}`, '_blank');
                    }}
                    style={{
                      fontSize: '16px',
                      padding: '14px 28px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    ▶️ Watch Trailer
                  </button>
                  
                  <button
                    className="btn-enhanced"
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
                      padding: '12px 24px',
                      borderRadius: '25px',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      backdropFilter: 'blur(10px)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
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
      
      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { 
            opacity: 1; 
          }
          50% { 
            opacity: 0.5; 
          }
        }
      `}</style>
    </div>
  );
};

export default Movies;


