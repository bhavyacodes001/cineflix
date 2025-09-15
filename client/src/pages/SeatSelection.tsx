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

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        if (id?.startsWith('dummy-')) {
          // Get movie data from URL parameters
          const movieTitle = searchParams.get('title') || 'Selected Movie';
          const moviePoster = searchParams.get('poster') || 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=1200&auto=format&fit=crop';
          const movieRating = searchParams.get('rating') || 'PG-13';
          
          // Build a mock seat map for dummy showtime ids
          const rows = 'ABCDEFGHIJ'.split('').map((row, rIdx) => {
            const seats = Array.from({ length: 14 }).map((_, sIdx) => {
              const type = rIdx < 3 ? 'vip' : rIdx < 6 ? 'premium' : 'regular';
              const price = type === 'vip' ? 350 : type === 'premium' ? 280 : 200;
              const isBooked = Math.random() < 0.08;
              const isAvailable = !isBooked || Math.random() > 0.5;
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
            price: { regular: 200, premium: 280, vip: 350 }
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
    if (!cell.isAvailable || cell.isBooked) return; // not pickable
    setSelected((prev) => {
      const exists = prev.some((s) => s.row === row.rowName && s.number === cell.number);
      if (exists) return prev.filter((s) => !(s.row === row.rowName && s.number === cell.number));
      if (prev.length >= 10) return prev; // limit
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
        // Include movie data for dummy bookings
        movieData: showtime ? {
          title: showtime.movie.title,
          poster: showtime.movie.poster,
          rating: showtime.movie.rating,
          duration: showtime.movie.duration
        } : undefined
      };
      const { data } = await api.post('/bookings', payload);
      // Navigate to payment page with booking ID
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
      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: 10 }}>🎟️</div>
        Loading seats...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: 10 }}>⚠️</div>
        {error}
      </div>
    );
  }

  if (!showtime) return null;

  const legendBox = (color: string, label: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 16, height: 16, borderRadius: 4, background: color, border: '1px solid #ccc' }} />
      <span style={{ fontSize: 12, color: '#666' }}>{label}</span>
    </div>
  );

  const colorFor = (cell: SeatCell, active: boolean) => {
    if (cell.isBooked) return '#ffd6d6';
    if (!cell.isAvailable) return '#e0e0e0';
    if (active) return '#e50914';
    if (cell.type === 'vip') return '#ffe6ea';
    if (cell.type === 'premium') return '#e9f5ff';
    return '#f7f7f8';
  };

  return (
    <div style={{ padding: '20px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20 }}>{showtime.movie?.title}</div>
          <div style={{ color: '#666', fontSize: 12 }}>{showtime.theater?.name} • {showtime.hall?.name} • {new Date(showtime.date).toLocaleDateString()} {showtime.time}</div>
        </div>
      </div>

      {/* Legend */}
      <div className="card" style={{ padding: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 16 }}>
            {legendBox('#f7f7f8', `Available (${counts.available})`)}
            {legendBox('#ffd6d6', `Reserved (${counts.reserved})`)}
            {legendBox('#e0e0e0', `Unavailable (${counts.unavailable})`)}
            {legendBox('#e50914', 'Selected')}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ fontSize: 12, color: '#666' }}>Regular ₹{showtime.price?.regular}</span>
            <span style={{ fontSize: 12, color: '#666' }}>Premium ₹{showtime.price?.premium}</span>
            <span style={{ fontSize: 12, color: '#666' }}>VIP ₹{showtime.price?.vip}</span>
          </div>
        </div>
      </div>

      {/* Seat Grid */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 10, color: '#666' }}>SCREEN THIS SIDE</div>
        <div style={{ display: 'grid', gap: 12 }}>
          {seatMap.map((row) => (
            <div key={row.rowName} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 24, textAlign: 'center', color: '#666', fontSize: 12 }}>{row.rowName}</div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(row.seats.length, 1)}, minmax(28px, 1fr))`, gap: 6 }}>
                {row.seats.map((cell) => {
                  const active = isSelected(row.rowName, cell.number);
                  return (
                    <button
                      key={cell.number}
                      onClick={() => toggleSeat(row, cell)}
                      disabled={!cell.isAvailable || cell.isBooked}
                      title={`${row.rowName}${cell.number} • ${cell.type.toUpperCase()} • ₹${cell.price}${cell.isBooked ? ' • Reserved' : (!cell.isAvailable ? ' • Unavailable' : '')}`}
                      style={{
                        height: 28,
                        borderRadius: 6,
                        background: colorFor(cell, active),
                        border: '1px solid #d9d9d9',
                        cursor: (!cell.isAvailable || cell.isBooked) ? 'not-allowed' : 'pointer',
                        fontSize: 12,
                        color: '#222'
                      }}
                    >
                      {cell.number}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Selected Seats ({selected.length})</div>
          {selected.length === 0 ? (
            <div style={{ color: '#666', fontSize: 14 }}>No seats selected.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {selected.map((s) => (
                <div key={`${s.row}-${s.number}`} style={{ background: '#f7f7f8', border: '1px solid #e6e6e6', padding: '6px 10px', borderRadius: 8, fontSize: 12 }}>
                  {s.row}{s.number} • {s.type.toUpperCase()} • ₹{s.price}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 12, color: '#666' }}>Total</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>₹{total}</div>
          </div>
          <button
            disabled={selected.length === 0}
            onClick={bookNow}
            style={{
              background: 'linear-gradient(135deg, #e50914, #b20710)',
              color: 'white',
              border: 'none',
              padding: '12px 20px',
              borderRadius: 24,
              cursor: selected.length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 700
            }}
          >
            Proceed to Booking
          </button>
        </div>
      </div>
    </div>
  );
};

export default SeatSelection;


