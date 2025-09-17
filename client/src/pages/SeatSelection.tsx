import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../utils/api';

type Theater = {
  name: string;
  address?: { city?: string };
  halls?: any[];
};

type Movie = {
  title: string;
  poster: string;
  duration?: number;
  rating?: string;
};

type SeatCell = {
  number: number;
  type: 'regular' | 'premium' | 'vip' | 'wheelchair';
  price: number;
  isAvailable: boolean;
  isBooked: boolean;
};

type SeatRow = {
  rowName: string;
  seats: SeatCell[];
};

type Showtime = {
  _id: string;
  date: string;
  time: string;
  endTime: string;
  hall: { name: string };
  movie: Movie;
  theater: Theater;
  price: { regular: number; premium: number; vip: number };
};

type SeatPick = { row: string; number: number; type: SeatCell['type']; price: number };

const SeatSelection: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showtime, setShowtime] = useState<Showtime | null>(null);
  const [seatMap, setSeatMap] = useState<SeatRow[]>([]);
  const [selected, setSelected] = useState<SeatPick[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showModal) {
        setShowModal(false);
      }
    };

    if (showModal) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [showModal]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        if (id?.startsWith('dummy-')) {
          // Get movie data from URL parameters
          const movieTitle = searchParams.get('title') || 'Selected Movie';
          const moviePoster = searchParams.get('poster') || 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=1200&auto=format&fit=crop';
          const movieRating = searchParams.get('rating') || 'PG-13';
          
          // Build a professional seat map similar to District interface
          const rows = 'FGHIJKLMNOP'.split('').map((row, rIdx) => {
            let seatCount = 15;
            if (rIdx < 3) seatCount = 19; // Upper section (F, G, H)
            if (rIdx >= 7) seatCount = 11; // Lower rows (N, O, P)
            
            const seats = Array.from({ length: seatCount }).map((_, sIdx) => {
              let type: SeatCell['type'] = 'regular';
              let price = 300; // Default regular price
              
              // Professional seat type distribution
              if (rIdx < 3) {
                // Upper section - Premium/VIP
                if (sIdx >= 4 && sIdx <= 10) type = 'premium';
                else if (sIdx >= 11) type = 'vip';
                price = type === 'vip' ? 540 : type === 'premium' ? 420 : 300;
              } else if (rIdx >= 3 && rIdx < 7) {
                // Middle section - Regular/Premium
                if (sIdx >= 4 && sIdx <= 10) type = 'premium';
                price = type === 'premium' ? 420 : 300;
              } else {
                // Lower section - Regular
                price = 300;
              }
              
              // Random booking status (more realistic)
              const isBooked = Math.random() < 0.15;
              const isAvailable = !isBooked;
              
              return { number: sIdx + 1, type, price, isAvailable, isBooked } as SeatCell;
            });
            return { rowName: row, seats } as SeatRow;
          });
          setSeatMap(rows);
          
          // Minimal showtime details for header/summary with real movie data
          const showDate = new Date();
          const showTime = '14:30';
          const endTime = '16:45';
          
          setShowtime({
            _id: id,
            date: showDate.toISOString().slice(0, 10),
            time: showTime,
            endTime: endTime,
            hall: { name: 'Screen 2' },
            movie: { title: movieTitle, poster: moviePoster, duration: 135, rating: movieRating },
            theater: { name: 'CinePlex Downtown' },
            price: { regular: 300, premium: 420, vip: 540 }
          } as any);
        } else {
          const { data } = await api.get(`/showtimes/${id}`);
          setShowtime(data.showtime);
          setSeatMap(data.seatMap || []);
        }
      } catch (e: any) {
        setError(e?.response?.data?.message || 'Failed to load seats');
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id, searchParams]);

  const total = useMemo(() => selected.reduce((t, s) => t + (s.price || 0), 0), [selected]);
  const counts = useMemo(() => {
    let available = 0, reserved = 0, unavailable = 0;
    seatMap.forEach((r) => r.seats.forEach((c) => {
      if (c.isBooked) reserved += 1;
      else if (!c.isAvailable) unavailable += 1;
      else available += 1;
    }));
    return { available, reserved, unavailable };
  }, [seatMap]);

  const isSelected = (row: string, num: number) => selected.some((s) => s.row === row && s.number === num);

  const toggleSeat = (row: SeatRow, cell: SeatCell) => {
    if (!cell.isAvailable || cell.isBooked) return;
    setSelected((prev) => {
      const exists = prev.some((s) => s.row === row.rowName && s.number === cell.number);
      if (exists) return prev.filter((s) => !(s.row === row.rowName && s.number === cell.number));
      if (prev.length >= 10) {
        setModalMessage('You can book a maximum of 10 tickets at a time. Please remove some seats or complete this booking first.');
        setShowModal(true);
        return prev; // limit
      }
      return [...prev, { row: row.rowName, number: cell.number, type: cell.type, price: cell.price }];
    });
  };

  const bookNow = async () => {
    if (!id || selected.length === 0) return;
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Please login to proceed with booking.');
      navigate('/login');
      return;
    }
    try {
      const payload = {
        showtimeId: id,
        seats: selected.map((s) => ({ row: s.row, number: s.number, type: s.type })),
        paymentMethod: 'card',
        movieData: showtime ? {
          title: showtime.movie.title,
          poster: showtime.movie.poster,
          rating: showtime.movie.rating,
          duration: showtime.movie.duration
        } : undefined
      };
      const { data } = await api.post('/bookings', payload);
      navigate(`/payment?bookingId=${data.booking._id}`);
    } catch (e: any) {
      console.error('Booking error:', e?.response?.data);
      const errorMessage = e?.response?.data?.message || 'Booking failed';
      const validationErrors = e?.response?.data?.errors;
      
      if (validationErrors && validationErrors.length > 0) {
        const errorDetails = validationErrors.map((err: any) => `${err.param}: ${err.msg}`).join('\n');
        alert(`Validation failed:\n${errorDetails}`);
      } else {
        alert(errorMessage);
      }
    }
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: '#f8f9fa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column'
      }}>
        <div style={{ 
          fontSize: '64px', 
          marginBottom: '20px',
          animation: 'pulse 2s infinite'
        }}>🎟️</div>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading seat selection...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: '#f8f9fa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column'
      }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>⚠️</div>
        <div style={{ fontSize: '18px', color: '#e50914', marginBottom: '20px' }}>{error}</div>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: '#e50914',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!showtime) return null;

  const getSeatStyle = (cell: SeatCell, active: boolean) => {
    const baseStyle = {
      width: '32px',
      height: '32px',
      borderRadius: '8px',
      border: '1px solid #e0e0e0',
      fontSize: '12px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#333'
    };

    if (cell.isBooked) {
      return {
        ...baseStyle,
        background: '#f5f5f5',
        border: '1px solid #d0d0d0',
        cursor: 'not-allowed',
        color: '#999',
        position: 'relative' as const
      };
    }

    if (!cell.isAvailable) {
      return {
        ...baseStyle,
        background: '#f0f0f0',
        border: '1px solid #d0d0d0',
        cursor: 'not-allowed',
        color: '#999'
      };
    }

    if (active) {
      return {
        ...baseStyle,
        background: '#e50914',
        border: '1px solid #e50914',
        color: 'white',
        transform: 'scale(1.05)',
        boxShadow: '0 2px 8px rgba(229, 9, 20, 0.3)'
      };
    }

    // Available seats with type-based colors
    if (cell.type === 'vip') {
      return {
        ...baseStyle,
        background: '#fff3e0',
        border: '1px solid #ffb74d',
        color: '#e65100'
      };
    }

    if (cell.type === 'premium') {
      return {
        ...baseStyle,
        background: '#e3f2fd',
        border: '1px solid #64b5f6',
        color: '#1565c0'
      };
    }

    return {
      ...baseStyle,
      background: 'white',
      border: '1px solid #e0e0e0',
      color: '#333'
    };
  };

  const renderSeatRow = (row: SeatRow, index: number) => {
    const isUpperSection = index < 3;
    const isLowerSection = index >= 7;
    
    return (
      <div key={row.rowName} style={{ 
        display: 'flex', 
        alignItems: 'center', 
        marginBottom: '8px',
        gap: '12px'
      }}>
        {/* Row Label */}
        <div style={{ 
          width: '24px', 
          textAlign: 'center', 
          fontSize: '14px',
          fontWeight: '600',
          color: '#666'
        }}>
          {row.rowName}
        </div>
        
        {/* Seats with aisles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* First section */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {row.seats.slice(0, 4).map((cell) => {
              const active = isSelected(row.rowName, cell.number);
              return (
                <button
                  key={cell.number}
                  onClick={() => toggleSeat(row, cell)}
                  disabled={!cell.isAvailable || cell.isBooked}
                  style={getSeatStyle(cell, active)}
                  title={`${row.rowName}${cell.number} • ${cell.type.toUpperCase()} • ₹${cell.price}${cell.isBooked ? ' • Reserved' : ''}`}
                >
                  {cell.isBooked ? '✕' : cell.number}
                </button>
              );
            })}
          </div>
          
          {/* Aisle */}
          <div style={{ width: '16px' }} />
          
          {/* Middle section */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {row.seats.slice(4, 11).map((cell) => {
              const active = isSelected(row.rowName, cell.number);
              return (
                <button
                  key={cell.number}
                  onClick={() => toggleSeat(row, cell)}
                  disabled={!cell.isAvailable || cell.isBooked}
                  style={getSeatStyle(cell, active)}
                  title={`${row.rowName}${cell.number} • ${cell.type.toUpperCase()} • ₹${cell.price}${cell.isBooked ? ' • Reserved' : ''}`}
                >
                  {cell.isBooked ? '✕' : cell.number}
                </button>
              );
            })}
          </div>
          
          {/* Aisle */}
          <div style={{ width: '16px' }} />
          
          {/* Last section */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {row.seats.slice(11).map((cell) => {
              const active = isSelected(row.rowName, cell.number);
              return (
                <button
                  key={cell.number}
                  onClick={() => toggleSeat(row, cell)}
                  disabled={!cell.isAvailable || cell.isBooked}
                  style={getSeatStyle(cell, active)}
                  title={`${row.rowName}${cell.number} • ${cell.type.toUpperCase()} • ₹${cell.price}${cell.isBooked ? ' • Reserved' : ''}`}
                >
                  {cell.isBooked ? '✕' : cell.number}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#f8f9fa',
      padding: '20px'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Professional Header */}
        <div style={{ 
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <button 
              onClick={() => navigate(-1)} 
              style={{ 
                background: 'transparent', 
                border: 'none', 
                fontSize: '20px', 
                cursor: 'pointer',
                color: '#666'
              }}
            >
              ←
            </button>
            <div>
              <h1 style={{ 
                margin: '0 0 8px 0', 
                fontSize: '28px', 
                fontWeight: '700',
                color: '#1a1a1a'
              }}>
                {showtime.movie?.title}
              </h1>
              <div style={{ 
                color: '#666', 
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>{showtime.theater?.name}</span>
                <span>•</span>
                <span>{showtime.hall?.name}</span>
                <span>•</span>
                <span>{new Date(showtime.date).toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  day: 'numeric', 
                  month: 'short' 
                })}</span>
                <span>•</span>
                <span>{showtime.time}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Professional Legend */}
        <div style={{ 
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '20px'
          }}>
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ 
                  width: '20px', 
                  height: '20px', 
                  borderRadius: '6px', 
                  background: 'white',
                  border: '1px solid #e0e0e0'
                }} />
                <span style={{ fontSize: '14px', color: '#666' }}>Available ({counts.available})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ 
                  width: '20px', 
                  height: '20px', 
                  borderRadius: '6px', 
                  background: '#f5f5f5',
                  border: '1px solid #d0d0d0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  color: '#999'
                }}>✕</div>
                <span style={{ fontSize: '14px', color: '#666' }}>Occupied ({counts.reserved})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ 
                  width: '20px', 
                  height: '20px', 
                  borderRadius: '6px', 
                  background: '#e50914',
                  border: '1px solid #e50914'
                }} />
                <span style={{ fontSize: '14px', color: '#666' }}>Selected</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ 
                background: '#f8f9fa',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#666'
              }}>
                Regular ₹{showtime.price?.regular}
              </div>
              <div style={{ 
                background: '#e3f2fd',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#1565c0'
              }}>
                Premium ₹{showtime.price?.premium}
              </div>
              <div style={{ 
                background: '#fff3e0',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#e65100'
              }}>
                VIP ₹{showtime.price?.vip}
              </div>
            </div>
          </div>
        </div>

        {/* Professional Seat Layout */}
        <div style={{ 
          background: 'white',
          borderRadius: '12px',
          padding: '32px',
          marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          {/* Screen */}
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '32px',
            position: 'relative' as const
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              height: '8px',
              borderRadius: '4px',
              margin: '0 auto',
              width: '80%',
              position: 'relative' as const
            }}>
              <div style={{
                position: 'absolute',
                top: '-20px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '14px',
                fontWeight: '600',
                color: '#666',
                background: 'white',
                padding: '4px 12px',
                borderRadius: '20px',
                border: '1px solid #e0e0e0'
              }}>
                SCREEN THIS WAY
              </div>
            </div>
          </div>

          {/* Seat Grid */}
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            {seatMap.map((row, index) => renderSeatRow(row, index))}
          </div>
        </div>

        {/* Professional Summary */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '24px',
          marginBottom: '24px'
        }}>
          {/* Selected Seats */}
          <div 
            data-selected-seats
            style={{ 
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
            <h3 style={{ 
              margin: '0 0 16px 0', 
              fontSize: '18px',
              fontWeight: '600',
              color: '#1a1a1a'
            }}>
              Selected Seats ({selected.length}/10)
            </h3>
            {selected.length === 0 ? (
              <div style={{ 
                color: '#666', 
                fontSize: '14px',
                textAlign: 'center',
                padding: '20px 0'
              }}>
                No seats selected. Click on available seats to select them.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {selected.map((s) => (
                    <div key={`${s.row}-${s.number}`} style={{ 
                      background: '#f8f9fa', 
                      border: '1px solid #e0e0e0', 
                      padding: '8px 12px', 
                      borderRadius: '8px', 
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#333'
                    }}>
                      {s.row}{s.number} • {s.type.toUpperCase()} • ₹{s.price}
                    </div>
                  ))}
                </div>
                {selected.length >= 8 && (
                  <div style={{ 
                    marginTop: '12px',
                    padding: '8px 12px',
                    background: selected.length === 10 ? '#fff3cd' : '#d1ecf1',
                    border: `1px solid ${selected.length === 10 ? '#ffeaa7' : '#bee5eb'}`,
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: selected.length === 10 ? '#856404' : '#0c5460'
                  }}>
                    {selected.length === 10 
                      ? 'Maximum limit reached (10 tickets). Remove seats to select others.'
                      : `${10 - selected.length} more tickets can be selected.`
                    }
                  </div>
                )}
              </>
            )}
          </div>

          {/* Total and Booking */}
          <div style={{ 
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Total Amount</div>
              <div style={{ fontSize: '32px', fontWeight: '700', color: '#1a1a1a' }}>₹{total}</div>
            </div>
            <button
              disabled={selected.length === 0}
              onClick={bookNow}
              style={{
                background: selected.length === 0 ? '#f0f0f0' : 'linear-gradient(135deg, #e50914, #b20710)',
                color: selected.length === 0 ? '#999' : 'white',
                border: 'none',
                padding: '16px 24px',
                borderRadius: '12px',
                cursor: selected.length === 0 ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                fontSize: '16px',
                transition: 'all 0.3s ease',
                marginTop: '16px'
              }}
              onMouseEnter={(e) => {
                if (selected.length > 0) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(229, 9, 20, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                if (selected.length > 0) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              {selected.length === 0 ? 'Select Seats to Continue' : 'Proceed to Payment'}
            </button>
          </div>
        </div>
      </div>

      {/* Custom Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '480px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            position: 'relative',
            animation: 'slideIn 0.3s ease-out'
          }}>
            {/* Close button */}
            <button
              onClick={() => setShowModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'transparent',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f5f5f5';
                e.currentTarget.style.color = '#333';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#666';
              }}
            >
              ×
            </button>

            {/* Icon */}
            <div style={{
              textAlign: 'center',
              marginBottom: '20px'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #ff6b6b, #ee5a52)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                fontSize: '28px'
              }}>
                ⚠️
              </div>
            </div>

            {/* Title */}
            <h3 style={{
              margin: '0 0 16px 0',
              fontSize: '20px',
              fontWeight: '600',
              color: '#1a1a1a',
              textAlign: 'center'
            }}>
              Booking Limit Reached
            </h3>

            {/* Message */}
            <p style={{
              margin: '0 0 24px 0',
              fontSize: '16px',
              color: '#666',
              lineHeight: '1.5',
              textAlign: 'center'
            }}>
              {modalMessage}
            </p>

            {/* Action buttons */}
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center'
            }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: '#f8f9fa',
                  color: '#666',
                  border: '1px solid #e0e0e0',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease',
                  minWidth: '100px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e9ecef';
                  e.currentTarget.style.borderColor = '#d0d0d0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f8f9fa';
                  e.currentTarget.style.borderColor = '#e0e0e0';
                }}
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowModal(false);
                  // Scroll to selected seats section
                  const selectedSection = document.querySelector('[data-selected-seats]');
                  if (selectedSection) {
                    selectedSection.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                style={{
                  background: 'linear-gradient(135deg, #e50914, #b20710)',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease',
                  minWidth: '100px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(229, 9, 20, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                Manage Seats
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideIn {
          from { 
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          to { 
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
};

export default SeatSelection;