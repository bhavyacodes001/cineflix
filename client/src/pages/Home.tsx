import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

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
  const [currentSlide, setCurrentSlide] = useState(0);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [featuredMovies, setFeaturedMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMovies = async () => {
      try {
        setLoading(true);
        // Fetch local movies and featured movies with error handling
        const responses = await Promise.allSettled([
          api.get('/movies?limit=24'),
          api.get('/movies/featured'),
          api.get('/movies/tmdb/popular?page=1') // Get TMDB movies to supplement
        ]);
        
        const localMovies = responses[0].status === 'fulfilled' ? (responses[0].value.data.movies || []) : [];
        const featuredMovies = responses[1].status === 'fulfilled' ? (responses[1].value.data.movies || []) : [];
        const tmdbMovies = responses[2].status === 'fulfilled' ? (responses[2].value.data.results || []) : [];
        
        // Convert TMDB movies to our format for display
        const convertedTmdbMovies = tmdbMovies.slice(0, 15).map((movie: any) => ({
          _id: movie.id,
          title: movie.title,
          description: movie.overview || 'No description available',
          genre: ['Popular'], // Simple genre for TMDB movies
          poster: movie.poster_url || `https://image.tmdb.org/t/p/w500${movie.poster_path}` || 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=1200&auto=format&fit=crop',
          imdbRating: movie.vote_average || 0,
          rating: 'PG-13',
          status: 'now_showing'
        }));
        
        // Combine local movies with TMDB movies to get at least 20
        const allMovies = [...localMovies, ...convertedTmdbMovies];
        
        setMovies(allMovies);
        setFeaturedMovies(featuredMovies);
      } catch (error) {
        console.error('Error fetching movies:', error);
        // Fallback to empty arrays if API fails
        setMovies([]);
        setFeaturedMovies([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMovies();
  }, []);

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
        <div>Loading movies...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 0, background: '#f8f9fa' }}>
      {/* Hero Carousel - District Style */}
      <div style={{
        height: '500px',
        background: `linear-gradient(90deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.7) 100%), url("${safeCurrentMovie.poster}") center/cover`,
        display: 'flex',
        alignItems: 'center',
        position: 'relative'
      }}>
        {/* Navigation Arrows */}
        <button
          onClick={() => setCurrentSlide((prev) => (prev - 1 + heroMovies.length) % heroMovies.length)}
          style={{
            position: 'absolute',
            left: '20px',
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            borderRadius: '50%',
            width: '50px',
            height: '50px',
            color: 'white',
            fontSize: '20px',
            cursor: 'pointer',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ←
        </button>
        
        <button
          onClick={() => setCurrentSlide((prev) => (prev + 1) % heroMovies.length)}
          style={{
            position: 'absolute',
            right: '20px',
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            borderRadius: '50%',
            width: '50px',
            height: '50px',
            color: 'white',
            fontSize: '20px',
            cursor: 'pointer',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          →
        </button>

        {/* Content */}
        <div style={{
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
            <button style={{
              background: '#000',
              color: 'white',
              border: 'none',
              padding: '15px 35px',
              borderRadius: '25px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              Book now
            </button>
          </div>
          <div style={{ flexShrink: 0 }}>
            <img 
              src={currentMovie.poster}
              alt={currentMovie.title}
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
        <div style={{
          position: 'absolute',
          bottom: '30px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '12px'
        }}>
          {heroMovies.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              style={{
                width: index === currentSlide ? '24px' : '12px',
                height: '12px',
                borderRadius: '6px',
                border: 'none',
                background: index === currentSlide ? 'white' : 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
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
          {[
            { label: '🔽 Filters', active: false },
            { label: 'Hindi', active: false },
            { label: 'English', active: false },
            { label: 'New Releases', active: false },
            { label: '3D', active: false }
          ].map((filter, index) => (
            <button
              key={filter.label}
              style={{
                padding: '8px 16px',
                border: '1px solid #ddd',
                borderRadius: '20px',
                background: filter.active ? '#007bff' : 'white',
                color: filter.active ? 'white' : '#666',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Movies Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '20px'
        }}>
          {movies.slice(0, 20).map((movie, index) => (
            <a 
              key={movie._id} 
              href={`/movies/${movie._id}`} 
              style={{ textDecoration: 'none' }}
            >
              <div style={{
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
                // Show trailer button on hover
                const trailerBtn = e.currentTarget.querySelector('.trailer-btn') as HTMLElement;
                if (trailerBtn) trailerBtn.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                // Hide trailer button
                const trailerBtn = e.currentTarget.querySelector('.trailer-btn') as HTMLElement;
                if (trailerBtn) trailerBtn.style.opacity = '0';
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
                    className="trailer-btn"
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
                      boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
                    }}
                    title="Watch trailer on YouTube"
                  >
                    ▶️ Trailer
                  </button>
                </div>
                <div style={{ padding: '12px' }}>
                  <h3 style={{ 
                    margin: '0 0 4px 0', 
                    fontSize: '14px', 
                    fontWeight: '600',
                    color: '#000',
                    lineHeight: '1.2',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {movie.title}
                  </h3>
                  <p style={{
                    margin: '0',
                    fontSize: '12px',
                    color: '#666',
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
            </a>
          ))}
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
              <button style={{
                background: 'linear-gradient(135deg, #e50914, #b20710)',
                color: 'white',
                border: 'none',
                padding: '15px 30px',
                borderRadius: '25px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(229,9,20,0.3)',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                View All Movies ({movies.length})
              </button>
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
