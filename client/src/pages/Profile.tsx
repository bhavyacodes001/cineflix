import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

type UserProfile = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  createdAt: string;
  role: string;
};

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await api.get('/auth/profile');
        setProfile(response.data.user);
        setFormData({
          firstName: response.data.user.firstName,
          lastName: response.data.user.lastName,
          email: response.data.user.email,
          phone: response.data.user.phone
        });
      } catch (err: any) {
        if (err.response?.status === 401) {
          navigate('/login');
        } else {
          setError(err.response?.data?.message || 'Failed to load profile');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    try {
      const response = await api.put('/auth/profile', formData);
      setProfile(response.data.user);
      setMessage('✅ Profile updated successfully!');
      setEditing(false);
    } catch (err: any) {
      setMessage(`❌ Error: ${err.response?.data?.message || 'Failed to update profile'}`);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentPassword = (e.target as any).currentPassword.value;
    const newPassword = (e.target as any).newPassword.value;
    const confirmPassword = (e.target as any).confirmPassword.value;

    if (newPassword !== confirmPassword) {
      setMessage('❌ New passwords do not match');
      return;
    }

    try {
      await api.put('/auth/change-password', {
        currentPassword,
        newPassword
      });
      setMessage('✅ Password changed successfully!');
      (e.target as any).reset();
    } catch (err: any) {
      setMessage(`❌ Error: ${err.response?.data?.message || 'Failed to change password'}`);
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
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>👤</div>
        <div>Loading profile...</div>
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
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ 
        marginBottom: '30px',
        background: 'white',
        padding: '25px',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <button 
          onClick={() => navigate(-1)}
          style={{ 
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            border: 'none', 
            fontSize: '16px', 
            cursor: 'pointer',
            marginBottom: '20px',
            padding: '10px 20px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '500'
          }}
        >
          ← Back
        </button>
        <h1 style={{ 
          fontSize: '32px', 
          fontWeight: 'bold', 
          margin: '0 0 10px 0',
          color: '#1e293b',
          background: 'linear-gradient(135deg, #667eea, #764ba2)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          👤 Profile Settings
        </h1>
        <p style={{ color: '#64748b', fontSize: '16px', fontWeight: '500' }}>
          Manage your account information and preferences
        </p>
      </div>

      {/* Message Display */}
      {message && (
        <div style={{
          padding: '15px',
          backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da',
          border: `1px solid ${message.includes('✅') ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '8px',
          marginBottom: '20px',
          textAlign: 'center',
          fontWeight: 'bold'
        }}>
          {message}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
        {/* Profile Information */}
        <div style={{ 
          background: 'white',
          padding: '25px',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ 
              margin: 0, 
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#333'
            }}>
              Personal Information
            </h2>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Edit
              </button>
            )}
          </div>

          {editing ? (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  First Name
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  Last Name
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setFormData({
                      firstName: profile?.firstName || '',
                      lastName: profile?.lastName || '',
                      email: profile?.email || '',
                      phone: profile?.phone || ''
                    });
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div style={{ display: 'grid', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#666' }}>
                  First Name
                </label>
                <div style={{ 
                  padding: '10px', 
                  backgroundColor: '#f8f9fa',
                  borderRadius: '6px',
                  border: '1px solid #e9ecef'
                }}>
                  {profile?.firstName}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#666' }}>
                  Last Name
                </label>
                <div style={{ 
                  padding: '10px', 
                  backgroundColor: '#f8f9fa',
                  borderRadius: '6px',
                  border: '1px solid #e9ecef'
                }}>
                  {profile?.lastName}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#666' }}>
                  Email
                </label>
                <div style={{ 
                  padding: '10px', 
                  backgroundColor: '#f8f9fa',
                  borderRadius: '6px',
                  border: '1px solid #e9ecef'
                }}>
                  {profile?.email}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#666' }}>
                  Phone
                </label>
                <div style={{ 
                  padding: '10px', 
                  backgroundColor: '#f8f9fa',
                  borderRadius: '6px',
                  border: '1px solid #e9ecef'
                }}>
                  {profile?.phone}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#666' }}>
                  Member Since
                </label>
                <div style={{ 
                  padding: '10px', 
                  backgroundColor: '#f8f9fa',
                  borderRadius: '6px',
                  border: '1px solid #e9ecef'
                }}>
                  {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : 'N/A'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Change Password */}
        <div style={{ 
          background: 'white',
          padding: '25px',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{ 
            margin: '0 0 20px 0', 
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#333'
          }}>
            🔒 Change Password
          </h2>

          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                Current Password
              </label>
              <input
                type="password"
                name="currentPassword"
                required
                style={{ 
                  width: '100%', 
                  padding: '10px', 
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                New Password
              </label>
              <input
                type="password"
                name="newPassword"
                required
                minLength={6}
                style={{ 
                  width: '100%', 
                  padding: '10px', 
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                Confirm New Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                required
                minLength={6}
                style={{ 
                  width: '100%', 
                  padding: '10px', 
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                padding: '10px 20px',
                backgroundColor: '#e50914',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                marginTop: '10px'
              }}
            >
              Change Password
            </button>
          </form>
        </div>
      </div>

      {/* Account Actions */}
      <div style={{ 
        background: 'white',
        padding: '25px', 
        marginTop: '30px',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 style={{ 
          margin: '0 0 20px 0', 
          fontSize: '20px',
          fontWeight: 'bold',
          color: '#333'
        }}>
          ⚙️ Account Actions
        </h2>

        <div style={{ display: 'grid', gap: '15px' }}>
          <button
            onClick={() => navigate('/bookings')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '15px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500',
              textAlign: 'left'
            }}
          >
            <span>🎫</span>
            <span>View My Bookings</span>
          </button>

          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                // TODO: Implement account deletion
                alert('Account deletion feature coming soon!');
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '15px 20px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500',
              textAlign: 'left'
            }}
          >
            <span>🗑️</span>
            <span>Delete Account</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
