import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../utils/api';

type BookingDetails = {
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
};

const BookingSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('bookingId');
  
  const [bookingDetails, setBookingDetails] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!bookingId) {
      setError('No booking ID provided');
      setLoading(false);
      return;
    }

    const fetchBookingDetails = async () => {
      try {
        const response = await api.get(`/bookings/${bookingId}`);
        setBookingDetails(response.data.booking);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load booking details');
      } finally {
        setLoading(false);
      }
    };

    fetchBookingDetails();
  }, [bookingId]);

  const handleDownloadTicket = () => {
    // Generate and download ticket PDF
    const ticketData = {
      bookingNumber: bookingDetails?.bookingNumber,
      movie: bookingDetails?.movie.title,
      theater: bookingDetails?.theater.name,
      showDate: bookingDetails?.showDate,
      showTime: bookingDetails?.showTime,
      seats: bookingDetails?.tickets.map(t => `${t.seat.row}${t.seat.number}`).join(', '),
      totalAmount: bookingDetails?.totalAmount
    };
    
    // For now, we'll just show an alert. In a real app, you'd generate a PDF
    alert(`Ticket downloaded for booking #${ticketData.bookingNumber}`);
  };

  const handleShareBooking = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Movie Ticket Booking',
        text: `I've booked tickets for ${bookingDetails?.movie.title} at ${bookingDetails?.theater.name}`,
        url: window.location.href
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert('Booking link copied to clipboard!');
    }
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
        <div>Loading booking details...</div>
      </div>
    );
  }

  if (error || !bookingDetails) {
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
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      {/* Success Header */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{ 
          fontSize: '80px', 
          marginBottom: '20px',
          animation: 'bounce 1s infinite'
        }}>
          ✅
        </div>
        <h1 style={{ 
          fontSize: '36px', 
          fontWeight: 'bold', 
          margin: '0 0 10px 0',
          color: '#28a745'
        }}>
          Payment Successful!
        </h1>
        <p style={{ 
          fontSize: '18px', 
          color: '#666',
          margin: '0 0 20px 0'
        }}>
          Your tickets have been booked successfully
        </p>
        <div style={{
          display: 'inline-block',
          padding: '10px 20px',
          backgroundColor: '#e50914',
          color: 'white',
          borderRadius: '25px',
          fontSize: '16px',
          fontWeight: 'bold'
        }}>
          Booking #{bookingDetails.bookingNumber}
        </div>
      </div>

      {/* Booking Details Card */}
      <div className="card" style={{ padding: '30px', marginBottom: '30px' }}>
        <h2 style={{ 
          marginBottom: '25px', 
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#333',
          textAlign: 'center'
        }}>
          🎬 Booking Details
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '25px', marginBottom: '25px' }}>
          <img 
            src={bookingDetails.movie.poster} 
            alt={bookingDetails.movie.title}
            style={{ 
              width: '100%', 
              height: '200px', 
              objectFit: 'cover',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          />
          <div>
            <h3 style={{ 
              margin: '0 0 15px 0', 
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#333'
            }}>
              {bookingDetails.movie.title}
            </h3>
            <div style={{ display: 'grid', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '16px' }}>🏢</span>
                <span style={{ fontWeight: '500' }}>{bookingDetails.theater.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '16px' }}>📍</span>
                <span>{bookingDetails.theater.address}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '16px' }}>📅</span>
                <span>{new Date(bookingDetails.showDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '16px' }}>🕐</span>
                <span>{bookingDetails.showTime}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '16px' }}>⏱️</span>
                <span>{bookingDetails.movie.duration} minutes</span>
              </div>
            </div>
          </div>
        </div>

        {/* Seats Information */}
        <div style={{ 
          borderTop: '1px solid #eee', 
          paddingTop: '25px',
          marginBottom: '25px'
        }}>
          <h4 style={{ 
            marginBottom: '15px', 
            fontSize: '18px', 
            fontWeight: '600',
            color: '#333'
          }}>
            🎫 Your Seats
          </h4>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
            gap: '10px' 
          }}>
            {bookingDetails.tickets.map((ticket, index) => (
              <div key={index} style={{
                padding: '12px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                textAlign: 'center',
                border: '2px solid #e50914'
              }}>
                <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '4px' }}>
                  {ticket.seat.row}{ticket.seat.number}
                </div>
                <div style={{ fontSize: '12px', color: '#666', textTransform: 'capitalize' }}>
                  {ticket.seat.type}
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#e50914', marginTop: '4px' }}>
                  ₹{ticket.seat.price}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Information */}
        <div style={{ 
          borderTop: '1px solid #eee', 
          paddingTop: '25px',
          marginBottom: '25px'
        }}>
          <h4 style={{ 
            marginBottom: '15px', 
            fontSize: '18px', 
            fontWeight: '600',
            color: '#333'
          }}>
            💳 Payment Information
          </h4>
          <div style={{ display: 'grid', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Transaction ID:</span>
              <span style={{ fontWeight: '500' }}>{bookingDetails.payment.transactionId}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Payment Status:</span>
              <span style={{ 
                color: '#28a745', 
                fontWeight: '600',
                textTransform: 'uppercase'
              }}>
                {bookingDetails.payment.status}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Paid At:</span>
              <span style={{ fontWeight: '500' }}>
                {new Date(bookingDetails.payment.paidAt).toLocaleString()}
              </span>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              padding: '15px',
              backgroundColor: '#e50914',
              color: 'white',
              borderRadius: '8px',
              marginTop: '10px',
              fontSize: '18px',
              fontWeight: 'bold'
            }}>
              <span>Total Paid:</span>
              <span>₹{bookingDetails.totalAmount}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '15px',
          marginTop: '30px'
        }}>
          <button
            onClick={handleDownloadTicket}
            style={{
              padding: '15px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#218838'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
          >
            📥 Download Ticket
          </button>
          
          <button
            onClick={handleShareBooking}
            style={{
              padding: '15px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0056b3'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#007bff'}
          >
            📤 Share Booking
          </button>
          
          <button
            onClick={() => navigate('/bookings')}
            style={{
              padding: '15px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#545b62'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6c757d'}
          >
            📋 My Bookings
          </button>
          
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '15px 20px',
              backgroundColor: '#e50914',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b20710'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e50914'}
          >
            🏠 Book More Movies
          </button>
        </div>
      </div>

      {/* Important Information */}
      <div className="card" style={{ 
        padding: '20px', 
        backgroundColor: '#fff3cd',
        border: '1px solid #ffeaa7'
      }}>
        <h3 style={{ 
          marginBottom: '15px', 
          fontSize: '18px',
          fontWeight: '600',
          color: '#856404'
        }}>
          ⚠️ Important Information
        </h3>
        <ul style={{ 
          margin: 0, 
          paddingLeft: '20px',
          color: '#856404',
          lineHeight: '1.6'
        }}>
          <li>Please arrive at the theater at least 15 minutes before the show time</li>
          <li>Bring a valid ID for verification</li>
          <li>Show your booking confirmation or ticket at the entrance</li>
          <li>Seats are non-transferable and non-refundable</li>
          <li>For any queries, contact our customer support</li>
        </ul>
      </div>

      {/* Add some CSS for the bounce animation */}
      <style>
        {`
          @keyframes bounce {
            0%, 20%, 50%, 80%, 100% {
              transform: translateY(0);
            }
            40% {
              transform: translateY(-10px);
            }
            60% {
              transform: translateY(-5px);
            }
          }
        `}
      </style>
    </div>
  );
};

export default BookingSuccess;
