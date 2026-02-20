import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

type Movie = {
  _id: string;
  id?: string | number;
  title: string;
  description: string;
  genre: string[];
  poster: string;
  releaseDate: string;
  duration?: number;
  runtime?: number;
  rating?: string;
  imdbRating?: number;
  language?: string;
  subtitles?: string[];
  formattedDuration?: string;
  cast?: { name: string }[];
  director?: string;
  trailer?: string;
  source?: string;
  backdrop?: string;
};

const MovieDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'cast' | 'reviews'>('overview');
  const heroRef = useRef<HTMLDivElement>(null);

  const fetchMovie = useCallback(async () => {
    try {
      setError('');
      
      // Determine if it's a TMDB movie or local movie based on the route
      const isTmdbRoute = window.location.pathname.includes('/movies/tmdb/');
      const endpoint = isTmdbRoute ? `/movies/tmdb/${id}` : `/movies/${id}`;
      
      const { data } = await api.get(endpoint);
      setMovie(data.movie);
    } catch (err: any) {
      console.error('Movie fetch error:', err);
      
      // Handle specific error types with user-friendly messages
      if (err.response?.status === 503) {
        setError('Movie service is temporarily unavailable. Please try again in a few moments.');
      } else if (err.response?.status === 429) {
        setError('Too many requests. Please wait a moment and try again.');
      } else if (err.response?.status === 404) {
        setError('Movie not found. It may have been removed or the link is invalid.');
      } else if (err.response?.status === 500) {
        setError('Server error. Please try again or contact support if the issue persists.');
      } else if (err.code === 'NETWORK_ERROR' || !err.response) {
        setError('Network error. Please check your internet connection and try again.');
      } else {
        setError(err.response?.data?.message || 'Failed to load movie');
      }
    }
  }, [id]);

  useEffect(() => {
    if (id && id !== 'undefined') {
      fetchMovie();
    } else {
      setError('Invalid movie ID');
    }
  }, [id, fetchMovie]);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    
    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      el.style.transform = `perspective(1000px) rotateY(${x * 3}deg) rotateX(${y * -3}deg) scale(1.02)`;
    };
    
    const handleLeave = () => {
      el.style.transform = 'perspective(1000px) rotateY(0deg) rotateX(0deg) scale(1)';
    };
    
    el.addEventListener('mousemove', handleMove);
    el.addEventListener('mouseleave', handleLeave);
    return () => {
      el.removeEventListener('mousemove', handleMove);
      el.removeEventListener('mouseleave', handleLeave);
    };
  }, []);


  // Show placeholder content while loading
  const displayMovie = movie || {
    _id: 'placeholder',
    title: 'Loading...',
    description: 'Please wait while we fetch the movie details...',
    genre: [],
    poster: 'https://via.placeholder.com/500x750/333/fff?text=Loading...',
    releaseDate: new Date().toISOString(),
    duration: 0,
    rating: 'N/A',
    imdbRating: 0,
    language: 'N/A',
    source: 'loading'
  };

  if (error) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>😞</div>
          <h2 style={{ margin: '0 0 20px 0' }}>Oops! Something went wrong</h2>
          <p style={{ marginBottom: '30px', opacity: 0.9 }}>{error}</p>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/movies')}
              style={{
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: '2px solid white',
                padding: '12px 30px',
                borderRadius: '25px',
                fontSize: '16px',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              Back to Movies
            </button>
            <button
              onClick={() => {
                setError('');
                if (id && id !== 'undefined') {
                  fetchMovie();
                }
              }}
              style={{
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: '2px solid white',
                padding: '12px 30px',
                borderRadius: '25px',
                fontSize: '16px',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              🔄 Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!movie) return null;

  return (
    <div style={{ padding: 0, background: '#0a0a0a', minHeight: '100vh' }}>
      {/* Cinematic Hero Section */}
      <div
        ref={heroRef}
        style={{
          position: 'relative',
          height: '100vh',
          background: `
            linear-gradient(45deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.8) 100%),
            linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.7)),
            url(${displayMovie.poster})
          `,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
          display: 'flex',
          alignItems: 'center',
          transition: 'transform 0.3s ease',
          overflow: 'hidden'
        }}
      >
        {/* Animated Background Particles */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `
            radial-gradient(circle at 20% 80%, rgba(120,119,198,0.3) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(255,119,198,0.3) 0%, transparent 50%),
            radial-gradient(circle at 40% 40%, rgba(120,200,255,0.2) 0%, transparent 50%)
          `,
          animation: 'float 6s ease-in-out infinite'
        }} />

        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          style={{
            position: 'absolute',
            top: '30px',
            left: '30px',
            background: 'rgba(255,255,255,0.1)',
            border: '2px solid rgba(255,255,255,0.3)',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '50px',
            fontSize: '16px',
            cursor: 'pointer',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.3s ease',
            zIndex: 10
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          ← Back
        </button>

        {/* Main Content */}
        <div style={{ 
          maxWidth: '1400px', 
          margin: '0 auto', 
          padding: '0 40px',
          display: 'grid',
          gridTemplateColumns: '1fr 2fr',
          gap: '60px',
          alignItems: 'center',
          width: '100%'
        }}>
          {/* Movie Poster */}
          <div style={{
            position: 'relative',
            transform: 'perspective(1000px) rotateY(-15deg)',
            transition: 'transform 0.6s ease'
          }}>
            <div style={{
              background: 'linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
              padding: '20px',
              borderRadius: '20px',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <img 
                src={displayMovie.poster}
                alt={displayMovie.title}
                style={{ 
                  width: '100%', 
                  height: '600px', 
                  objectFit: 'cover',
                  borderRadius: '15px',
                  boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
                }}
              />
            </div>
          </div>

          {/* Movie Info */}
          <div style={{ color: 'white', zIndex: 2 }}>
            <div style={{
              background: 'linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '25px',
              padding: '40px'
            }}>
              {/* Title */}
              <h1 style={{ 
                margin: '0 0 20px 0', 
                fontSize: '48px',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #fff 0%, #f0f0f0 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                lineHeight: '1.1'
              }}>
                {displayMovie.title}
              </h1>

              {/* Rating & Genre Tags */}
              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                marginBottom: '25px', 
                flexWrap: 'wrap' 
              }}>
                <span style={{ 
                  background: 'linear-gradient(135deg, #ff6b6b, #ee5a24)',
                  padding: '8px 16px', 
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 15px rgba(238,90,36,0.4)'
                }}>
                  {displayMovie.rating || 'N/A'}
                </span>
                <span style={{ 
                  background: 'linear-gradient(135deg, #feca57, #ff9ff3)',
                  padding: '8px 16px', 
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: '#333',
                  boxShadow: '0 4px 15px rgba(254,202,87,0.4)'
                }}>
                  ⭐ {displayMovie.imdbRating?.toFixed(1) ?? 'N/A'}
                </span>
                {displayMovie.genre?.map((g, i) => (
                  <span key={i} style={{ 
                    background: 'linear-gradient(135deg, #5f27cd, #00d2d3)',
                    padding: '8px 16px', 
                    borderRadius: '20px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 15px rgba(95,39,205,0.4)'
                  }}>
                    {g}
                  </span>
                ))}
              </div>

              {/* Description */}
              <p style={{ 
                fontSize: '18px', 
                lineHeight: '1.7', 
                marginBottom: '30px',
                color: 'rgba(255,255,255,0.9)'
              }}>
                {displayMovie.description}
              </p>

              {/* Movie Details */}
              <div style={{ 
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '20px',
                marginBottom: '35px'
              }}>
                <div style={{
                  background: 'rgba(255,255,255,0.05)',
                  padding: '15px',
                  borderRadius: '15px',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginBottom: '5px' }}>Duration</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    {displayMovie.duration ? `${Math.floor(displayMovie.duration/60)}h ${displayMovie.duration%60}m` : displayMovie.runtime ? `${Math.floor(displayMovie.runtime/60)}h ${displayMovie.runtime%60}m` : 'N/A'}
                  </div>
                </div>
                <div style={{
                  background: 'rgba(255,255,255,0.05)',
                  padding: '15px',
                  borderRadius: '15px',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginBottom: '5px' }}>Release Date</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    {new Date(displayMovie.releaseDate).toLocaleDateString()}
                  </div>
                </div>
                <div style={{
                  background: 'rgba(255,255,255,0.05)',
                  padding: '15px',
                  borderRadius: '15px',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginBottom: '5px' }}>Language</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{displayMovie.language}</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    if (displayMovie.source === 'tmdb' || String(displayMovie._id).startsWith('tmdb_')) {
                      const tmdbId = displayMovie.id || String(displayMovie._id).replace('tmdb_', '');
                      const params = new URLSearchParams({
                        movie: `tmdb:${tmdbId}`,
                        title: displayMovie.title,
                        poster: displayMovie.poster || ''
                      });
                      navigate(`/showtimes?${params.toString()}`);
                    } else {
                      navigate(`/showtimes?movie=${displayMovie._id}`);
                    }
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #e50914, #b20710)',
                    color: 'white',
                    border: 'none',
                    padding: '18px 35px',
                    borderRadius: '50px',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: '0 8px 25px rgba(229,9,20,0.4)',
                    transition: 'all 0.3s ease',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.boxShadow = '0 12px 35px rgba(229,9,20,0.6)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 25px rgba(229,9,20,0.4)';
                  }}
                >
                  🎫 Book Tickets
                </button>
                
                <button
                  onClick={() => {
                    // Create multiple trailer search options
                    const movieYear = new Date(displayMovie.releaseDate).getFullYear();
                    const searchQueries = [
                      `${displayMovie.title} ${movieYear} official trailer`,
                      `${displayMovie.title} trailer ${movieYear}`,
                      `${displayMovie.title} official trailer`
                    ];
                    
                    // Try the most specific search first
                    const searchQuery = encodeURIComponent(searchQueries[0]);
                    const youtubeUrl = `https://www.youtube.com/results?search_query=${searchQuery}`;
                    
                    // Open in new tab
                    window.open(youtubeUrl, '_blank');
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    color: 'white',
                    border: '2px solid rgba(255,255,255,0.3)',
                    padding: '16px 30px',
                    borderRadius: '50px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    backdropFilter: 'blur(10px)',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                  title={`Search for "${displayMovie.title}" trailer on YouTube`}
                >
                  ▶️ Watch Trailer on YouTube
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Content Section */}
      <div style={{ 
        background: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%)',
        padding: '80px 40px',
        position: 'relative'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          {/* Tab Navigation */}
          <div style={{ 
            display: 'flex', 
            gap: '30px', 
            marginBottom: '50px',
            justifyContent: 'center'
          }}>
            {[
              { id: 'overview', label: 'Overview', icon: '📖' },
              { id: 'cast', label: 'Cast & Crew', icon: '🎭' },
              { id: 'reviews', label: 'Reviews', icon: '⭐' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  background: activeTab === tab.id 
                    ? 'linear-gradient(135deg, #e50914, #b20710)' 
                    : 'rgba(255,255,255,0.1)',
                  color: 'white',
                  border: activeTab === tab.id ? 'none' : '2px solid rgba(255,255,255,0.2)',
                  padding: '15px 25px',
                  borderRadius: '25px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(10px)'
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '25px',
            padding: '40px',
            minHeight: '300px'
          }}>
            {activeTab === 'overview' && (
              <div style={{ color: 'white' }}>
                <h3 style={{ fontSize: '28px', marginBottom: '20px', color: '#e50914' }}>
                  📖 Movie Overview
                </h3>
                <p style={{ fontSize: '18px', lineHeight: '1.8', marginBottom: '30px' }}>
                  {displayMovie.description}
                </p>
                {displayMovie.director && (
                  <div style={{ marginBottom: '20px' }}>
                    <strong style={{ color: '#feca57' }}>Director:</strong> {displayMovie.director}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                  <div>
                    <strong style={{ color: '#feca57' }}>Genres:</strong><br/>
                    {displayMovie.genre?.join(', ')}
                  </div>
                  <div>
                    <strong style={{ color: '#feca57' }}>Rating:</strong><br/>
                    {displayMovie.rating || 'N/A'} • ⭐ {displayMovie.imdbRating?.toFixed(1) || 'N/A'}/10
                  </div>
                  <div>
                    <strong style={{ color: '#feca57' }}>Runtime:</strong><br/>
                    {displayMovie.duration ? `${Math.floor(displayMovie.duration/60)}h ${displayMovie.duration%60}m` : displayMovie.runtime ? `${Math.floor(displayMovie.runtime/60)}h ${displayMovie.runtime%60}m` : 'N/A'}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'cast' && (
              <div style={{ color: 'white' }}>
                <h3 style={{ fontSize: '28px', marginBottom: '30px', color: '#e50914' }}>
                  🎭 Cast & Crew
                </h3>
                {displayMovie.cast && displayMovie.cast.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                    {displayMovie.cast.map((actor, index) => (
                      <div key={index} style={{
                        background: 'rgba(255,255,255,0.05)',
                        padding: '20px',
                        borderRadius: '15px',
                        textAlign: 'center',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}>
                        <div style={{ 
                          width: '80px', 
                          height: '80px', 
                          background: 'linear-gradient(135deg, #667eea, #764ba2)',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '30px',
                          margin: '0 auto 15px'
                        }}>
                          🎭
                        </div>
                        <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{actor.name}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '18px', textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>
                    Cast information not available for this displayMovie.
                  </p>
                )}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div style={{ color: 'white', textAlign: 'center' }}>
                <h3 style={{ fontSize: '28px', marginBottom: '30px', color: '#e50914' }}>
                  ⭐ Reviews & Ratings
                </h3>
                <div style={{ fontSize: '64px', marginBottom: '20px' }}>⭐</div>
                <div style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '10px' }}>
                  {displayMovie.imdbRating?.toFixed(1) || 'N/A'}/10
                </div>
                <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.7)', marginBottom: '30px' }}>
                  Based on IMDb ratings
                </p>
                <div style={{ fontSize: '18px', color: 'rgba(255,255,255,0.6)' }}>
                  Detailed reviews coming soon...
                </div>
              </div>
            )}
          </div>
        </div>
      </div>


      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-10px) rotate(1deg); }
          66% { transform: translateY(-5px) rotate(-1deg); }
        }
      `}</style>
    </div>
  );
};

export default MovieDetails;


