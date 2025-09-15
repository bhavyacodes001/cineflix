import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import '../styles/animations.css';
import LoadingSpinner from '../components/LoadingSpinner';

type Movie = {
  _id: string;
  title: string;
  description: string;
  genre: string[];
  director: string;
  cast: { name: string }[];
  releaseDate: string;
  duration: number;
  rating: string;
  imdbRating: number;
  poster: string;
  trailer?: string;
  language: string;
  subtitles: string[];
  status: string;
  basePrice: number;
  isActive: boolean;
};

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [featuredMovies, setFeaturedMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('All');

  useEffect(() => {
    const fetchMovies = async () => {
      try {
        setLoading(true);
        console.log('Fetching movies...');
        
        // Fetch local movies and featured movies with error handling
        const responses = await Promise.allSettled([
          api.get('/movies?limit=24'),
          api.get('/movies/featured'),
          api.get('/movies/tmdb/popular?page=1') // Get TMDB movies to supplement
        ]);
        
        console.log('API responses:', responses);
        
        const localMovies = responses[0].status === 'fulfilled' ? (responses[0].value.data.movies || []) : [];
        const featuredMovies = responses[1].status === 'fulfilled' ? (responses[1].value.data.movies || []) : [];
        const tmdbMovies = responses[2].status === 'fulfilled' ? (responses[2].value.data.results || []) : [];
        
        console.log('Local movies:', localMovies.length);
        console.log('Featured movies:', featuredMovies.length);
        console.log('TMDB movies:', tmdbMovies.length);
        
        // Convert TMDB movies to our format for display
        const convertedTmdbMovies: Movie[] = tmdbMovies.slice(0, 15).map((movie: any) => ({
          _id: movie.id,
          title: movie.title,
          description: movie.overview || 'No description available',
          genre: ['Popular'], // Simple genre for TMDB movies
          director: movie.director || 'Unknown Director',
          cast: movie.cast || [{ name: 'Unknown Cast' }],
          poster: movie.poster_url || `https://image.tmdb.org/t/p/w500${movie.poster_path}` || 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=1200&auto=format&fit=crop',
          imdbRating: movie.vote_average || 0,
          rating: 'PG-13',
          status: 'now_showing',
          language: 'English',
          subtitles: ['English'],
          releaseDate: movie.release_date || new Date().toISOString(),
          duration: movie.runtime || 120,
          basePrice: 12.99,
          isActive: true
        }));
        
        // Combine and de-duplicate by title to avoid repeats
        const combined = [...localMovies, ...convertedTmdbMovies];
        const uniqueByTitle = new Map<string, any>();
        combined.forEach((m: any) => {
          const key = (m.title || '').toLowerCase().trim();
          if (key && !uniqueByTitle.has(key)) uniqueByTitle.set(key, m);
        });

        const finalMovies = Array.from(uniqueByTitle.values());
        console.log('Final movies count:', finalMovies.length);
        
        setMovies(finalMovies);
        setFeaturedMovies(featuredMovies);
      } catch (error) {
        console.error('Error fetching movies:', error);
        // Fallback movies if API fails
        const fallbackMovies: Movie[] = [
          {
            _id: 'fallback-1',
            title: 'The Dark Knight',
            description: 'When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.',
            genre: ['Action', 'Crime'],
            director: 'Christopher Nolan',
            cast: [{ name: 'Christian Bale' }, { name: 'Heath Ledger' }, { name: 'Aaron Eckhart' }],
            poster: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=1200&auto=format&fit=crop',
            imdbRating: 9.0,
            rating: 'PG-13',
            status: 'now_showing',
            language: 'English',
            subtitles: ['English', 'Spanish'],
            releaseDate: '2008-07-18',
            duration: 152,
            basePrice: 12.99,
            isActive: true
          },
          {
            _id: 'fallback-2',
            title: 'Inception',
            description: 'A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.',
            genre: ['Action', 'Sci-Fi'],
            director: 'Christopher Nolan',
            cast: [{ name: 'Leonardo DiCaprio' }, { name: 'Marion Cotillard' }, { name: 'Tom Hardy' }],
            poster: 'https://images.unsplash.com/photo-1489599808888-0b4b4a0b4b4b?q=80&w=1200&auto=format&fit=crop',
            imdbRating: 8.8,
            rating: 'PG-13',
            status: 'now_showing',
            language: 'English',
            subtitles: ['English', 'French'],
            releaseDate: '2010-07-16',
            duration: 148,
            basePrice: 13.99,
            isActive: true
          },
          {
            _id: 'fallback-3',
            title: 'Interstellar',
            description: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity\'s survival.',
            genre: ['Adventure', 'Drama'],
            director: 'Christopher Nolan',
            cast: [{ name: 'Matthew McConaughey' }, { name: 'Anne Hathaway' }, { name: 'Jessica Chastain' }],
            poster: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?q=80&w=1200&auto=format&fit=crop',
            imdbRating: 8.6,
            rating: 'PG-13',
            status: 'now_showing',
            language: 'English',
            subtitles: ['English', 'German'],
            releaseDate: '2014-11-07',
            duration: 169,
            basePrice: 14.99,
            isActive: true
          }
        ];
        setMovies(fallbackMovies);
        setFeaturedMovies(fallbackMovies.slice(0, 3));
      } finally {
        setLoading(false);
      }
    };

    fetchMovies();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedMovie) setSelectedMovie(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selectedMovie]);

  // Use featured movies for hero section, fallback to regular movies
  // Ensure we have at least 5 movies for the carousel
  let heroMovies = [];
  if (featuredMovies.length >= 5) {
    heroMovies = featuredMovies.slice(0, 5);
  } else {
    // Combine featured and regular movies to get at least 5
    const combined = [...featuredMovies, ...movies.filter(m => !featuredMovies.find(f => f._id === m._id))];
    heroMovies = combined.slice(0, 5);
  }

  useEffect(() => {
    if (heroMovies.length > 0) {
      const timer = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % heroMovies.length);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [heroMovies.length]);

  const currentMovie = heroMovies[currentSlide];

  // Safety check for currentMovie
  const safeCurrentMovie = currentMovie || {
    title: 'Loading...',
    genre: ['Entertainment'],
    imdbRating: 0,
    description: 'Loading movie information...',
    poster: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=1200&auto=format&fit=crop'
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px',
        background: '#f8f9fa'
      }}>
        <LoadingSpinner size="large" text="Loading movies..." />
      </div>
    );
  }

  return (
    <div style={{ padding: 0, background: '#f8f9fa' }}>
      {/* Hero Carousel - Enhanced Style */}
      <div className="hero-enhanced" style={{
        height: '500px',
        background: `url("${currentMovie?.poster || safeCurrentMovie.poster}") center/cover`,
        display: 'flex',
        alignItems: 'center',
        position: 'relative'
      }}>
        {/* Navigation Arrows */}
        <button
          className="nav-arrow-enhanced"
          onClick={() => setCurrentSlide((prev) => (prev - 1 + heroMovies.length) % heroMovies.length)}
          style={{
            left: '20px'
          }}
        >
          ←
        </button>
        
        <button
          className="nav-arrow-enhanced"
          onClick={() => setCurrentSlide((prev) => (prev + 1) % heroMovies.length)}
          style={{
            right: '20px'
          }}
        >
          →
        </button>

        {/* Content */}
        <div className="hero-content-enhanced" style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 80px',
          display: 'flex',
          alignItems: 'center',
          gap: '60px',
          width: '100%'
        }}>
          <div style={{ flex: 1, color: 'white' }}>
            <h1 style={{ 
              fontSize: '48px', 
              fontWeight: 'bold', 
              margin: '0 0 15px 0',
              textShadow: '2px 2px 4px rgba(0,0,0,0.7)',
              lineHeight: '1.1'
            }}>
              {safeCurrentMovie.title}
            </h1>
            <div style={{ 
              fontSize: '18px', 
              margin: '15px 0 10px 0',
              color: 'rgba(255,255,255,0.9)'
            }}>
              {safeCurrentMovie.rating || 'PG-13'} | {safeCurrentMovie.genre?.join(', ')} | ⭐ {safeCurrentMovie.imdbRating?.toFixed(1)}
            </div>
            <div style={{ 
              fontSize: '14px', 
              margin: '5px 0 10px 0',
              color: 'rgba(255,255,255,0.7)'
            }}>
              {heroMovies.length > 0 && `${currentSlide + 1} of ${heroMovies.length} featured movies`}
            </div>
            <div style={{ 
              fontSize: '16px', 
              margin: '10px 0 25px 0',
              color: 'rgba(255,255,255,0.8)',
              maxWidth: '500px',
              lineHeight: '1.4'
            }}>
              {safeCurrentMovie.description?.substring(0, 120)}...
            </div>
            <button 
              className="btn-enhanced btn-primary-enhanced"
              onClick={() => {
                if (currentMovie && currentMovie._id) {
                  // Check if it's a local movie (MongoDB ObjectId) or TMDB movie
                  const isMongoId = typeof currentMovie._id === 'string' && /^[a-f0-9]{24}$/i.test(currentMovie._id);
                  if (isMongoId) {
                    navigate(`/movies/${currentMovie._id}`);
                  } else {
                    // For TMDB movies, navigate to showtimes with movie details
                    const posterUrl = currentMovie.poster || safeCurrentMovie.poster;
                    const qs = new URLSearchParams({
                      movie: `tmdb:${String(currentMovie._id)}`,
                      title: currentMovie.title || safeCurrentMovie.title,
                      poster: posterUrl,
                      rating: String(currentMovie.imdbRating || safeCurrentMovie.imdbRating || 0)
                    }).toString();
                    navigate(`/showtimes?${qs}`);
                  }
                } else {
                  // Fallback: navigate to movies page
                  navigate('/movies');
                }
              }}
            >
              Book now
            </button>
          </div>
          <div style={{ flexShrink: 0 }}>
            <img 
              src={currentMovie?.poster || safeCurrentMovie.poster}
              alt={currentMovie?.title || safeCurrentMovie.title}
              style={{ 
                width: '320px', 
                height: '420px', 
                objectFit: 'cover',
                borderRadius: '16px',
                boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
              }}
            />
          </div>
        </div>

        {/* Dots Indicator */}
        <div className="dots-enhanced">
          {heroMovies.map((_, index) => (
            <button
              key={index}
              className={`dot-enhanced ${index === currentSlide ? 'active' : ''}`}
              onClick={() => setCurrentSlide(index)}
            />
          ))}
        </div>
      </div>

      {/* Only in Theatres Section */}
      <div style={{ padding: '40px 20px', maxWidth: '1200px', margin: '0 auto' }}>
        <h2 style={{ 
          fontSize: '32px', 
          fontWeight: 'bold', 
          margin: '0 0 10px 0',
          color: '#000'
        }}>
          Now Showing
        </h2>
        <p style={{ 
          color: '#666', 
          fontSize: '16px', 
          margin: '0 0 30px 0' 
        }}>
          Popular movies currently available for booking
        </p>

        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', flexWrap: 'wrap' }}>
          {['All', 'Hindi', 'English', 'New Releases'].map((label, index) => (
            <button
              key={label}
              className={`filter-tab-enhanced ${activeFilter === label ? 'active' : ''} animate-slide-up animate-delay-${index + 1}`}
              onClick={() => setActiveFilter(label)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Movies Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '20px'
        }}>
          {movies
            .filter((m) => {
              if (activeFilter === 'All') return true;
              if (activeFilter === 'Hindi') return (m.language || '').toLowerCase() === 'hindi';
              if (activeFilter === 'English') return (m.language || '').toLowerCase() === 'english';
              if (activeFilter === 'New Releases') {
                const d = new Date(m.releaseDate || Date.now());
                const cutoff = new Date();
                cutoff.setMonth(cutoff.getMonth() - 2);
                return d >= cutoff;
              }
              return true;
            })
            .slice(0, 20)
            .map((movie, index) => {
            const isMongoId = typeof movie._id === 'string' && /^[a-f0-9]{24}$/i.test(movie._id);
            return (
            <div 
              key={movie._id}
              className={`animate-fade-in-scale animate-delay-${(index % 5) + 1}`}
              style={{ textDecoration: 'none' }}
            >
              <div 
              className="movie-card-enhanced"
              onClick={() => { 
                if (isMongoId) { 
                  window.location.href = `/movies/${movie._id}`; 
                } else {
                  setSelectedMovie(movie);
                }
              }}
              >
                <div style={{ position: 'relative' }}>
                  <img 
                    src={movie.poster}
                    alt={movie.title}
                    style={{ 
                      width: '100%', 
                      height: '280px', 
                      objectFit: 'cover'
                    }}
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=400&auto=format&fit=crop';
                    }}
                  />
                  {/* Trailer Button Overlay */}
                  <button
                    className="trailer-btn btn-enhanced"
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
                      padding: '12px 20px',
                      borderRadius: '25px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      opacity: '0',
                      transition: 'all 0.3s ease',
                      backdropFilter: 'blur(10px)',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                      zIndex: 2
                    }}
                    title="Watch trailer on YouTube"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '0';
                      e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)';
                    }}
                  >
                    ▶️ Trailer
                  </button>
                </div>
                <div className="movie-info">
                  <h3 className="movie-title" style={{ 
                    margin: '0 0 4px 0', 
                    fontSize: '14px', 
                    fontWeight: '600',
                    lineHeight: '1.2',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {movie.title}
                  </h3>
                  <p className="movie-meta" style={{
                    margin: '0',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span>⭐ {movie.imdbRating?.toFixed(1)}</span>
                    <span>•</span>
                    <span>{movie.genre[0]}</span>
                    {movie.genre[0] === 'Popular' && (
                      <span style={{ 
                        background: '#e50914', 
                        color: 'white', 
                        padding: '2px 6px', 
                        borderRadius: '8px', 
                        fontSize: '10px',
                        fontWeight: 'bold'
                      }}>
                        TRENDING
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          );})}
        </div>

        {/* View All Movies Button */}
        {movies.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>
              Showing {Math.min(20, movies.length)} of {movies.length} movies
            </p>
            <a 
              href="/movies" 
              style={{ 
                textDecoration: 'none',
                display: 'inline-block'
              }}
            >
              <button className="btn-enhanced btn-primary-enhanced">
                View All Movies ({movies.length})
              </button>
            </a>
          </div>
        )}
      </div>
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
                    src={selectedMovie!.poster} 
                    alt={selectedMovie!.title} 
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
                  ⭐ {selectedMovie!.imdbRating?.toFixed(1)}
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
                  {selectedMovie!.title}
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
                    {selectedMovie!.rating || 'PG-13'}
                  </span>
                  
                  {selectedMovie!.genre?.map((genre, index) => (
                    <span 
                      key={index}
                      style={{ 
                        background: 'rgba(255,255,255,0.1)', 
                        color: 'white', 
                        padding: '8px 16px', 
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '500',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.2)'
                      }}
                    >
                      {genre}
                    </span>
                  ))}
                  
                  <span style={{ 
                    color: 'rgba(255,255,255,0.7)', 
                    fontSize: '14px',
                    fontWeight: '500'
                  }}>
                    {selectedMovie!.duration ? `${selectedMovie!.duration} min` : '120 min'}
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
                  {selectedMovie!.description}
                </p>

                {/* Movie Details */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '16px',
                  marginBottom: '24px'
                }}>
                  {selectedMovie!.director && (
                    <div>
                      <span style={{ 
                        color: 'rgba(255,255,255,0.8)', 
                        fontSize: '14px',
                        fontWeight: '600',
                        textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                      }}>Director</span>
                      <div style={{ 
                        color: '#ffffff', 
                        fontWeight: '500',
                        textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                      }}>{selectedMovie!.director}</div>
                    </div>
                  )}
                  
                  <div>
                    <span style={{ 
                      color: 'rgba(255,255,255,0.8)', 
                      fontSize: '14px',
                      fontWeight: '600',
                      textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                    }}>Language</span>
                    <div style={{ 
                      color: '#ffffff', 
                      fontWeight: '500',
                      textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                    }}>{selectedMovie!.language}</div>
                  </div>
                  
                  {selectedMovie!.releaseDate && (
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
                        {new Date(selectedMovie!.releaseDate).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </div>
                    </div>
                  )}
                  
                  {selectedMovie!.basePrice && (
                    <div>
                      <span style={{ 
                        color: 'rgba(255,255,255,0.8)', 
                        fontSize: '14px',
                        fontWeight: '600',
                        textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                      }}>Starting Price</span>
                      <div style={{ 
                        color: '#ffffff', 
                        fontWeight: '500',
                        textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                      }}>${selectedMovie!.basePrice}</div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <button
                    className="btn-enhanced btn-primary-enhanced"
                    onClick={() => {
                      const q = encodeURIComponent(`${selectedMovie!.title} official trailer`);
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
                      if (selectedMovie!._id) {
                        const isMongoId = typeof selectedMovie!._id === 'string' && /^[a-f0-9]{24}$/i.test(selectedMovie!._id);
                        if (isMongoId) {
                          navigate(`/movies/${selectedMovie!._id}`);
                        } else {
                          const posterUrl = selectedMovie!.poster;
                          const qs = new URLSearchParams({
                            movie: `tmdb:${String(selectedMovie!._id)}`,
                            title: selectedMovie!.title,
                            poster: posterUrl,
                            rating: String(selectedMovie!.imdbRating || 0)
                          }).toString();
                          navigate(`/showtimes?${qs}`);
                        }
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
    </div>
  );
};

export default Home;
