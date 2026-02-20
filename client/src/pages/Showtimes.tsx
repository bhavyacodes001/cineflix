import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../utils/api';

type Movie = {
  _id: string;
  title: string;
  poster: string;
  duration: number;
  rating: string;
  genre: string[];
};

type Theater = {
  _id: string;
  name: string;
  address?: { city?: string; state?: string };
  halls?: { name: string }[];
};

type Showtime = {
  _id: string;
  date: string; // ISO date
  time: string; // HH:MM
  endTime: string;
  price: { regular: number; premium: number; vip: number };
  theater: Theater;
};

type GroupedByTheater = {
  theater: Theater;
  showtimes: Showtime[];
};

const Showtimes: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const movieId = searchParams.get('movie') || '';
  const dummyTitle = searchParams.get('title') || '';
  const dummyPoster = searchParams.get('poster') || '';
  // rating not used in this view currently
  const [movie, setMovie] = useState<Movie | null>(null);
  const [groups, setGroups] = useState<GroupedByTheater[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [date, setDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [city, setCity] = useState<string>(() => localStorage.getItem('selectedCity') || '');
  const [slot, setSlot] = useState<'All' | 'Morning' | 'Afternoon' | 'Evening' | 'Night'>('All');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calendarLoading, setCalendarLoading] = useState<boolean>(false);
  const [calendarDays, setCalendarDays] = useState<Array<{ date: string; groups: GroupedByTheater[] }>>([]);

  const slotPredicate = useMemo(() => {
    return (t: string) => {
      // t: HH:MM
      const [hh, mm] = t.split(':').map((n) => parseInt(n, 10));
      const minutes = hh * 60 + mm;
      if (slot === 'All') return true;
      if (slot === 'Morning') return minutes >= 6 * 60 && minutes < 12 * 60; // 06:00-11:59
      if (slot === 'Afternoon') return minutes >= 12 * 60 && minutes < 17 * 60; // 12:00-16:59
      if (slot === 'Evening') return minutes >= 17 * 60 && minutes < 21 * 60; // 17:00-20:59
      if (slot === 'Night') return minutes >= 21 * 60 || minutes < 6 * 60; // 21:00-05:59
      return true;
    };
  }, [slot]);

  useEffect(() => {
    const fetchShowtimes = async () => {
      if (!movieId) {
        setError('Missing movie parameter');
        setLoading(false);
        return;
      }
      const isDummy = movieId.startsWith('tmdb:') || movieId.startsWith('tmdb_');
      try {
        setLoading(true);
        setError('');
        if (!isDummy) {
          // Validate ObjectId format
          if (!/^[0-9a-fA-F]{24}$/.test(movieId)) {
            setError('Invalid movie ID format');
            setLoading(false);
            return;
          }
          
          try {
            const { data } = await api.get(`/showtimes/movie/${movieId}`, {
              params: { date, city }
            });
            setMovie(data.movie);
            const apiGroups = (data.theaters || []) as GroupedByTheater[];
            if (apiGroups.length > 0) {
              setGroups(apiGroups);
            } else {
            // Fallback: generate dummy groups so every local movie has slots
            const basePrice = 200;
            const theaters: GroupedByTheater[] = [
              { theater: { _id: 't1', name: 'CinePlex Downtown' } as any, showtimes: [] },
              { theater: { _id: 't2', name: 'Grand Cinema Mall' } as any, showtimes: [] }
            ];
            const times = ['10:00', '13:30', '17:00', '20:30'];
            theaters.forEach((g, i) => {
              g.showtimes = times.map((t, idx) => ({
                _id: `dummy-local-${movieId}-${i * 10 + idx}`,
                date,
                time: t,
                endTime: '00:00',
                price: { regular: basePrice, premium: basePrice + 80, vip: basePrice + 150 },
                theater: g.theater,
                hall: { name: 'Screen 1' },
                movie: {
                  _id: movieId,
                  title: data.movie?.title,
                  poster: (data.movie?.poster || '') as string,
                  duration: data.movie?.duration,
                  rating: data.movie?.rating
                }
              }) as any);
            });
            setGroups(theaters);
          }
          } catch (movieErr: any) {
            console.error('Movie fetch error:', movieErr);
            if (movieErr.response?.status === 404) {
              setError('Movie not found in our database');
            } else {
              setError('Failed to load movie details');
            }
            setLoading(false);
            return;
          }
        } else {
          const tmdbId = movieId.replace(/^tmdb[:_]/, '');
          if (!/^\d+$/.test(tmdbId)) {
            setError('Invalid TMDB movie ID');
            setLoading(false);
            return;
          }
          
          // Generate mock theaters/showtimes for dummy TMDB movie
          const basePrice = 200;
          const theaters: GroupedByTheater[] = [
            { theater: { _id: 't1', name: 'CinePlex Downtown' }, showtimes: [] },
            { theater: { _id: 't2', name: 'Grand Cinema Mall' }, showtimes: [] }
          ];
          const times = ['14:30', '17:45', '20:15', '22:30'];
          const mkShowtime = (theater: Theater, t: string, idx: number): Showtime => {
            // Calculate end time (135 minutes = 2h 15min)
            const [hours, minutes] = t.split(':').map(Number);
            const endTime = new Date();
            endTime.setHours(hours, minutes + 135, 0, 0);
            const endTimeStr = endTime.toTimeString().slice(0, 5);
            
            return {
              _id: `dummy-${idx}-${t}`,
              date,
              time: t,
              endTime: endTimeStr,
              price: { regular: basePrice, premium: basePrice + 80, vip: basePrice + 150 },
              theater,
              // @ts-ignore minimal hall info for UI
              hall: { name: 'Screen 2' },
              movie: { title: dummyTitle || 'Movie', poster: dummyPoster, duration: 135, rating: 'PG-13' }
            };
          };
          theaters.forEach((g, i) => {
            g.showtimes = times.map((t, idx) => mkShowtime(g.theater as any, t, i * 10 + idx));
          });
          setMovie({ _id: 'dummy', title: dummyTitle || 'Movie', poster: dummyPoster, duration: 135, rating: 'PG', genre: [] } as any);
          setGroups(theaters);
        }
      } catch (e: any) {
        setError(e?.response?.data?.message || 'Failed to load showtimes');
      } finally {
        setLoading(false);
      }
    };

    fetchShowtimes();
  }, [movieId, date, city, dummyPoster, dummyTitle]);

  // Build a 7-day window starting from selected date
  const buildWeekFrom = (startISO: string) => {
    const start = new Date(startISO);
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  };

  // Load calendar data for the selected week
  useEffect(() => {
    const loadCalendar = async () => {
      if (viewMode !== 'calendar' || !movieId) return;
      try {
        setCalendarLoading(true);
        const isDummy = movieId.startsWith('tmdb:') || movieId.startsWith('tmdb_');
        if (!isDummy) {
          const days = buildWeekFrom(date);
          const requests = days.map((d) => api.get(`/showtimes/movie/${movieId}`, { params: { date: d, city } }));
          const results = await Promise.allSettled(requests);
          const dayData: Array<{ date: string; groups: GroupedByTheater[] }> = [];
          results.forEach((res, idx) => {
            if (res.status === 'fulfilled') {
              dayData.push({ date: days[idx], groups: (res.value.data.theaters || []) as GroupedByTheater[] });
            } else {
              dayData.push({ date: days[idx], groups: [] });
            }
          });
          setCalendarDays(dayData);
        } else {
          const days = buildWeekFrom(date);
          const basePrice = 200;
          const times = ['10:00', '13:30', '17:00', '20:30'];
          const dummy: Array<{ date: string; groups: GroupedByTheater[] }> = days.map((d) => ({
            date: d,
            groups: [
              { theater: { _id: 't1', name: 'CinePlex Downtown' }, showtimes: times.map((t, i) => ({ _id: `dummy-${d}-${i}`, date: d, time: t, endTime: '00:00', price: { regular: basePrice, premium: basePrice + 80, vip: basePrice + 150 }, theater: { _id: 't1', name: 'CinePlex Downtown' } as any, hall: { name: 'Screen 1' } as any }) as any) },
            ]
          }));
          setCalendarDays(dummy);
        }
      } finally {
        setCalendarLoading(false);
      }
    };
    loadCalendar();
  }, [viewMode, movieId, date, city]);

  const handleChangeDate = (newDate: string) => {
    setDate(newDate);
    const next = new URLSearchParams(searchParams);
    next.set('movie', movieId);
    next.set('date', newDate);
    if (city) next.set('city', city); else next.delete('city');
    setSearchParams(next);
  };

  const handleChangeCity = (newCity: string) => {
    setCity(newCity);
    const next = new URLSearchParams(searchParams);
    next.set('movie', movieId);
    if (date) next.set('date', date);
    if (newCity) next.set('city', newCity); else next.delete('city');
    setSearchParams(next);
  };

  if (loading) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '10px' }}>🕒</div>
        <div>Loading showtimes...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '10px' }}>⚠️</div>
        <div style={{ color: '#e50914', marginBottom: '16px' }}>{error}</div>
        <button onClick={() => navigate(-1)} style={{ background: '#e50914', color: 'white', border: 'none', padding: '10px 16px', borderRadius: 20, cursor: 'pointer' }}>Go Back</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer' }}>←</button>
        <h1 style={{ margin: 0, fontSize: '24px' }}>{movie?.title || 'Showtimes'}</h1>
      </div>

      {/* Controls */}
      <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr 1fr', gap: '12px', alignItems: 'center' }}>
          <input type="date" value={date} onChange={(e) => handleChangeDate(e.target.value)} style={{ padding: '10px', border: '1px solid #ddd', borderRadius: 8 }} />
          <input type="text" placeholder="City (optional)" value={city} onChange={(e) => handleChangeCity(e.target.value)} style={{ padding: '10px', border: '1px solid #ddd', borderRadius: 8 }} />
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(['All','Morning','Afternoon','Evening','Night'] as const).map((s) => (
              <button key={s} onClick={() => setSlot(s)} style={{ padding: '8px 12px', borderRadius: 20, border: '1px solid #ddd', background: slot === s ? '#e50914' : 'white', color: slot === s ? 'white' : '#666', cursor: 'pointer' }}>{s}</button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setViewMode('list')} style={{ padding: '8px 12px', borderRadius: 20, border: '1px solid #ddd', background: viewMode === 'list' ? '#e50914' : 'white', color: viewMode === 'list' ? 'white' : '#666', cursor: 'pointer' }}>List</button>
            <button onClick={() => setViewMode('calendar')} style={{ padding: '8px 12px', borderRadius: 20, border: '1px solid #ddd', background: viewMode === 'calendar' ? '#e50914' : 'white', color: viewMode === 'calendar' ? 'white' : '#666', cursor: 'pointer' }}>Calendar</button>
          </div>
        </div>
      </div>

      {viewMode === 'list' && (
        groups.length === 0 ? (
          <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>😔</div>
            <div>No showtimes available for the selected date/city.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {groups.map((g) => (
              <div key={g.theater._id} className="card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '18px' }}>{g.theater.name}</div>
                    <div style={{ color: '#666', fontSize: '12px' }}>{g.theater.address?.city}{g.theater.address?.state ? `, ${g.theater.address.state}` : ''}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {g.showtimes
                    .filter((st) => slotPredicate(st.time))
                    .map((st) => (
                      <button
                        key={st._id}
                        onClick={() => {
                          if (st._id.startsWith('dummy-')) {
                            // For dummy showtimes, pass movie data as URL parameters
                            const params = new URLSearchParams({
                              title: movie?.title || dummyTitle,
                              poster: movie?.poster || dummyPoster,
                              rating: movie?.rating || 'PG-13'
                            });
                            navigate(`/showtimes/${st._id}?${params.toString()}`);
                          } else {
                            navigate(`/showtimes/${st._id}`);
                          }
                        }}
                        title={`Ends ${st.endTime}`}
                        style={{
                          background: 'white',
                          border: '1px solid #ddd',
                          padding: '10px 14px',
                          borderRadius: 10,
                          cursor: 'pointer',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>{st.time}</div>
                        <div style={{ color: '#666', fontSize: '11px' }}>from ₹{st.price.regular}</div>
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {viewMode === 'calendar' && (
        <div className="card" style={{ padding: '16px' }}>
          {calendarLoading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>Loading calendar…</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
              {calendarDays.map((d) => (
                <div key={d.date} style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, background: 'white' }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>
                    {new Date(d.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </div>
                  {d.groups.length === 0 ? (
                    <div style={{ color: '#999', fontSize: 12 }}>No showtimes</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {d.groups.map((g) => (
                        <div key={g.theater._id} style={{ borderTop: '1px dashed #eee', paddingTop: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{g.theater.name}</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {g.showtimes
                              .filter((st) => slotPredicate(st.time))
                              .map((st) => (
                                <button
                                  key={st._id}
                                  onClick={() => {
                                    if (st._id.startsWith('dummy-')) {
                                      // For dummy showtimes, pass movie data as URL parameters
                                      const params = new URLSearchParams({
                                        title: movie?.title || dummyTitle,
                                        poster: movie?.poster || dummyPoster,
                                        rating: movie?.rating || 'PG-13'
                                      });
                                      navigate(`/showtimes/${st._id}?${params.toString()}`);
                                    } else {
                                      navigate(`/showtimes/${st._id}`);
                                    }
                                  }}
                                  style={{ background: '#f7f7f8', border: '1px solid #e6e6e6', padding: '6px 10px', borderRadius: 8, cursor: 'pointer' }}
                                  title={`Ends ${st.endTime}`}
                                >
                                  {st.time}
                                </button>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Showtimes;


