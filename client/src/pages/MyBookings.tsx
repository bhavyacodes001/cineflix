import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

type Booking = {
  _id: string;
  bookingNumber: string;
  totalAmount: number;
  tickets: Array<{
    seat: {
      row: string;
      number: number;
      type: string;
      price: number;
    };
    ticketId: string;
  }>;
  movie: {
    title: string;
    poster: string;
    duration: number;
  };
  theater: {
    name: string;
    address: string;
  };
  showDate: string;
  showTime: string;
  status: string;
  payment: {
    status: string;
    paidAt: string;
    transactionId: string;
  };
  bookingDate: string;
  cancellation: {
    isCancelled: boolean;
    cancelledAt?: string;
    refundAmount: number;
    refundStatus: string;
  };
};

const MyBookings: React.FC = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past' | 'cancelled'>('all');

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        setLoading(true);
        const response = await api.get('/bookings');
        setBookings(response.data.bookings);
      } catch (err: any) {
        if (err.response?.status === 401) {
          navigate('/login');
        } else {
          setError(err.response?.data?.message || 'Failed to load bookings');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [navigate]);

  const filteredBookings = bookings.filter(booking => {
    const now = new Date();
    const showDateTime = new Date(booking.showDate);
    const [hours, minutes] = booking.showTime.split(':');
    showDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    switch (filter) {
      case 'upcoming':
        return !booking.cancellation.isCancelled && showDateTime > now;
      case 'past':
        return !booking.cancellation.isCancelled && showDateTime <= now;
      case 'cancelled':
        return booking.cancellation.isCancelled;
      default:
        return true;
    }
  });

  const getStatusColor = (status: string, isCancelled: boolean) => {
    if (isCancelled) return '#dc3545';
    switch (status) {
      case 'confirmed': return '#28a745';
      case 'pending': return '#ffc107';
      case 'completed': return '#17a2b8';
      default: return '#6c757d';
    }
  };

  const getStatusText = (booking: Booking) => {
    if (booking.cancellation.isCancelled) return 'Cancelled';
    return booking.status.charAt(0).toUpperCase() + booking.status.slice(1);
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) {
      return;
    }

    try {
      await api.put(`/bookings/${bookingId}/cancel`);
      // Refresh bookings
      const response = await api.get('/bookings');
      setBookings(response.data.bookings);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to cancel booking');
    }
  };

  const handleViewBooking = (bookingId: string) => {
    navigate(`/booking-success?bookingId=${bookingId}`);
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px',
        flexDirection: 'column'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>🎫</div>
        <div>Loading your bookings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px',
        flexDirection: 'column'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>❌</div>
        <div style={{ color: '#e50914', marginBottom: '20px' }}>{error}</div>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#e50914',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ 
          fontSize: '32px', 
          fontWeight: 'bold', 
          margin: '0 0 10px 0',
          color: '#333'
        }}>
          🎫 My Bookings
        </h1>
        <p style={{ color: '#666', fontSize: '16px' }}>
          Manage your movie ticket bookings
        </p>
      </div>

      {/* Filter Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '30px',
        flexWrap: 'wrap'
      }}>
        {[
          { key: 'all', label: 'All Bookings', count: bookings.length },
          { key: 'upcoming', label: 'Upcoming', count: bookings.filter(b => {
            if (b.cancellation.isCancelled) return false;
            const d = new Date(b.showDate);
            const [h, m] = b.showTime.split(':');
            d.setHours(parseInt(h), parseInt(m), 0, 0);
            return d > new Date();
          }).length },
          { key: 'past', label: 'Past', count: bookings.filter(b => {
            if (b.cancellation.isCancelled) return false;
            const d = new Date(b.showDate);
            const [h, m] = b.showTime.split(':');
            d.setHours(parseInt(h), parseInt(m), 0, 0);
            return d <= new Date();
          }).length },
          { key: 'cancelled', label: 'Cancelled', count: bookings.filter(b => b.cancellation.isCancelled).length }
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key as any)}
            style={{
              padding: '10px 20px',
              border: '1px solid #ddd',
              borderRadius: '25px',
              background: filter === key ? '#e50914' : 'white',
              color: filter === key ? 'white' : '#666',
              fontSize: '14px',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {label}
            <span style={{
              backgroundColor: filter === key ? 'rgba(255,255,255,0.2)' : '#f0f0f0',
              color: filter === key ? 'white' : '#666',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <div className="card" style={{ 
          padding: '60px', 
          textAlign: 'center',
          backgroundColor: '#f8f9fa'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>🎬</div>
          <h3 style={{ color: '#333', marginBottom: '15px' }}>
            {filter === 'all' ? 'No bookings found' : `No ${filter} bookings`}
          </h3>
          <p style={{ color: '#666', marginBottom: '25px' }}>
            {filter === 'all' 
              ? "You haven't made any bookings yet. Start exploring movies!"
              : `You don't have any ${filter} bookings at the moment.`
            }
          </p>
          <button
            onClick={() => navigate('/movies')}
            style={{
              padding: '12px 24px',
              backgroundColor: '#e50914',
              color: 'white',
              border: 'none',
              borderRadius: '25px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Browse Movies
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          {filteredBookings.map((booking) => {
            const showDateTime = new Date(booking.showDate);
            const [hours, minutes] = booking.showTime.split(':');
            showDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            const isUpcoming = showDateTime > new Date();
            const canCancel = isUpcoming && !booking.cancellation.isCancelled;

            return (
              <div key={booking._id} className="card" style={{ padding: '25px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '20px', alignItems: 'start' }}>
                  {/* Movie Poster */}
                  <img 
                    src={booking.movie.poster} 
                    alt={booking.movie.title}
                    style={{ 
                      width: '100px', 
                      height: '150px', 
                      objectFit: 'cover',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                  />

                  {/* Booking Details */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
                      <h3 style={{ 
                        margin: 0, 
                        fontSize: '20px',
                        fontWeight: 'bold',
                        color: '#333'
                      }}>
                        {booking.movie.title}
                      </h3>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '15px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        backgroundColor: getStatusColor(booking.status, booking.cancellation.isCancelled),
                        color: 'white'
                      }}>
                        {getStatusText(booking)}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gap: '6px', marginBottom: '15px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px' }}>🏢</span>
                        <span style={{ fontWeight: '500' }}>{booking.theater.name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px' }}>📅</span>
                        <span>{new Date(booking.showDate).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px' }}>🕐</span>
                        <span>{booking.showTime}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px' }}>🎫</span>
                        <span>{booking.tickets.map(t => `${t.seat.row}${t.seat.number}`).join(', ')}</span>
                      </div>
                    </div>

                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '15px',
                      fontSize: '14px',
                      color: '#666'
                    }}>
                      <span>Booking #{booking.bookingNumber}</span>
                      <span>•</span>
                      <span>Booked on {new Date(booking.bookingDate).toLocaleDateString()}</span>
                      {booking.payment.paidAt && (
                        <>
                          <span>•</span>
                          <span>Paid on {new Date(booking.payment.paidAt).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
                    <div style={{ 
                      fontSize: '20px', 
                      fontWeight: 'bold', 
                      color: '#e50914',
                      textAlign: 'right'
                    }}>
                      ₹{booking.totalAmount}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleViewBooking(booking._id)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        View Details
                      </button>
                      
                      {canCancel && (
                        <button
                          onClick={() => handleCancelBooking(booking._id)}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyBookings;
