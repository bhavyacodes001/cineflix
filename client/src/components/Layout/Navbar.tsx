import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const Navbar: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [selectedCity, setSelectedCity] = useState('Detecting...');
  const [isDetecting, setIsDetecting] = useState(true);
  const navigate = useNavigate();
  const isLoggedIn = localStorage.getItem('token');
  const locationDropdownRef = useRef<HTMLDivElement>(null);

  const cities = useMemo(() => [
    { name: 'Mumbai', state: 'Maharashtra' },
    { name: 'Delhi', state: 'Delhi' },
    { name: 'Bangalore', state: 'Karnataka' },
    { name: 'Hyderabad', state: 'Telangana' },
    { name: 'Chennai', state: 'Tamil Nadu' },
    { name: 'Pune', state: 'Maharashtra' },
    { name: 'Kolkata', state: 'West Bengal' },
    { name: 'Ahmedabad', state: 'Gujarat' },
    { name: 'Jaipur', state: 'Rajasthan' },
    { name: 'Surat', state: 'Gujarat' },
    { name: 'Lucknow', state: 'Uttar Pradesh' },
    { name: 'Kanpur', state: 'Uttar Pradesh' },
    { name: 'Nagpur', state: 'Maharashtra' },
    { name: 'Indore', state: 'Madhya Pradesh' },
    { name: 'Thane', state: 'Maharashtra' },
    { name: 'Bhopal', state: 'Madhya Pradesh' },
    { name: 'Visakhapatnam', state: 'Andhra Pradesh' },
    { name: 'Patna', state: 'Bihar' },
    { name: 'Vadodara', state: 'Gujarat' },
    { name: 'Ghaziabad', state: 'Uttar Pradesh' }
  ], []);

  const currentCity = cities.find(city => city.name === selectedCity) || { name: selectedCity, state: '' };

  // Detect user's location on component mount
  useEffect(() => {
    const detectLocation = async () => {
      // Check if location is already saved and not expired
      const savedCity = localStorage.getItem('selectedCity');
      const locationTimestamp = localStorage.getItem('locationTimestamp');
      const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
      
      // If we have a saved city and it's less than 1 hour old, use it
      if (savedCity && savedCity !== 'Detecting...' && locationTimestamp) {
        const timeDiff = Date.now() - parseInt(locationTimestamp);
        if (timeDiff < oneHour) {
          setSelectedCity(savedCity);
          setIsDetecting(false);
          return;
        }
      }

      // Try to get user's location
      if ('geolocation' in navigator) {
        setSelectedCity('Detecting...');
        setIsDetecting(true);
        
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 15000,
              enableHighAccuracy: false, // Faster detection
              maximumAge: 300000 // 5 minutes cache
            });
          });

          const { latitude, longitude } = position.coords;
          console.log(`📍 GPS Coordinates: ${latitude}, ${longitude}`);
          
          // Reverse geocoding using a free API
          try {
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );
            const data = await response.json();
            console.log('🌍 Geocoding result:', data);
            
            const detectedCity = data.city || data.locality || data.principalSubdivision || data.countryName;
            
            // Check if detected city is in our list
            const matchedCity = cities.find(city => 
              city.name.toLowerCase().includes(detectedCity.toLowerCase()) ||
              detectedCity.toLowerCase().includes(city.name.toLowerCase())
            );
            
            if (matchedCity) {
              setSelectedCity(matchedCity.name);
              localStorage.setItem('selectedCity', matchedCity.name);
              localStorage.setItem('locationTimestamp', Date.now().toString());
              console.log(`✅ Matched city: ${matchedCity.name}`);
            } else {
              // If not in list, add it as a custom location
              setSelectedCity(detectedCity || 'Mumbai');
              localStorage.setItem('selectedCity', detectedCity || 'Mumbai');
              localStorage.setItem('locationTimestamp', Date.now().toString());
              console.log(`📍 Custom location: ${detectedCity}`);
            }
          } catch (geocodeError) {
            console.log('Reverse geocoding failed:', geocodeError);
            setSelectedCity('Mumbai'); // Default fallback
            localStorage.setItem('selectedCity', 'Mumbai');
            localStorage.setItem('locationTimestamp', Date.now().toString());
          }
        } catch (locationError: any) {
          console.log('Location detection failed:', locationError.message);
          setSelectedCity('Mumbai'); // Default fallback
          localStorage.setItem('selectedCity', 'Mumbai');
          localStorage.setItem('locationTimestamp', Date.now().toString());
        }
      } else {
        setSelectedCity('Mumbai'); // Default fallback
        localStorage.setItem('selectedCity', 'Mumbai');
        localStorage.setItem('locationTimestamp', Date.now().toString());
      }
      
      setIsDetecting(false);
    };

    detectLocation();
  }, [cities]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(event.target as Node)) {
        setShowLocationDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/movies?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/';
  };

  return (
    <nav style={{
      background: 'white',
      padding: '12px 0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      position: 'sticky',
      top: 0,
      zIndex: 1000
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px'
      }}>
        {/* Logo */}
        <a href="/" style={{ textDecoration: 'none' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #e50914, #b20710)',
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(229,9,20,0.3)'
            }}>
              <span style={{ 
                color: 'white',
                fontSize: '20px',
                fontWeight: 'bold'
              }}>
                🎬
              </span>
            </div>
            <div>
              <div style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#000',
                letterSpacing: '-0.5px'
              }}>
                CinePlex
              </div>
              <div style={{
                fontSize: '10px',
                color: '#666',
                letterSpacing: '1px',
                textTransform: 'uppercase'
              }}>
                Movie Experience
              </div>
            </div>
          </div>
        </a>

        {/* Location Selector */}
        <div ref={locationDropdownRef} style={{ position: 'relative' }}>
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#666',
              fontSize: '14px',
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: '8px',
              transition: 'background-color 0.2s',
              backgroundColor: showLocationDropdown ? '#f5f5f5' : 'transparent'
            }}
            onClick={() => setShowLocationDropdown(!showLocationDropdown)}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = showLocationDropdown ? '#f5f5f5' : 'transparent'}
          >
            <span style={{ fontSize: '16px' }}>📍</span>
            <div>
              <div style={{ fontWeight: 'bold', color: '#000' }}>
                {isDetecting ? 'Detecting...' : currentCity.name}
              </div>
              <div style={{ fontSize: '12px' }}>
                {isDetecting ? 'GPS Location' : (currentCity.state || 'Select City')}
              </div>
            </div>
            <span style={{ 
              color: '#999', 
              fontSize: '12px',
              transform: showLocationDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s'
            }}>
              ▼
            </span>
          </div>

          {/* Dropdown */}
          {showLocationDropdown && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: 'white',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 1000,
              maxHeight: '300px',
              overflowY: 'auto',
              marginTop: '4px',
              minWidth: '250px'
            }}>
              <div style={{ 
                padding: '12px 16px', 
                borderBottom: '1px solid #f0f0f0',
                fontWeight: 'bold',
                color: '#333',
                fontSize: '14px'
              }}>
                Select Your City
              </div>
              
              {/* Detect Location Button */}
              <div
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f0f0f0',
                  transition: 'background-color 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#e50914',
                  fontWeight: '500'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                onClick={async () => {
                  setIsDetecting(true);
                  setSelectedCity('Detecting...');
                  setShowLocationDropdown(false);
                  
                  // Clear saved location to force re-detection
                  localStorage.removeItem('selectedCity');
                  localStorage.removeItem('locationTimestamp');
                  
                  // Trigger location detection again
                  if ('geolocation' in navigator) {
                    try {
                      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                          timeout: 15000,
                          enableHighAccuracy: true, // More accurate for manual detection
                          maximumAge: 0 // Force fresh location
                        });
                      });

                      const { latitude, longitude } = position.coords;
                      console.log(`📍 Manual GPS: ${latitude}, ${longitude}`);
                      
                      try {
                        const response = await fetch(
                          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
                        );
                        const data = await response.json();
                        
                        const detectedCity = data.city || data.locality || data.principalSubdivision;
                        
                        const matchedCity = cities.find(city => 
                          city.name.toLowerCase().includes(detectedCity.toLowerCase()) ||
                          detectedCity.toLowerCase().includes(city.name.toLowerCase())
                        );
                        
                        if (matchedCity) {
                          setSelectedCity(matchedCity.name);
                          localStorage.setItem('selectedCity', matchedCity.name);
                          localStorage.setItem('locationTimestamp', Date.now().toString());
                        } else {
                          setSelectedCity(detectedCity || 'Mumbai');
                          localStorage.setItem('selectedCity', detectedCity || 'Mumbai');
                          localStorage.setItem('locationTimestamp', Date.now().toString());
                        }
                      } catch (geocodeError) {
                        setSelectedCity('Mumbai');
                        localStorage.setItem('selectedCity', 'Mumbai');
                        localStorage.setItem('locationTimestamp', Date.now().toString());
                      }
                    } catch (locationError: any) {
                      console.log('Manual location detection failed:', locationError);
                      setSelectedCity('Mumbai');
                      localStorage.setItem('selectedCity', 'Mumbai');
                      localStorage.setItem('locationTimestamp', Date.now().toString());
                    }
                  }
                  
                  setIsDetecting(false);
                }}
              >
                <span>🎯</span>
                <span>{isDetecting ? 'Detecting Location...' : 'Detect My Location'}</span>
              </div>
              {cities.map((city) => (
                <div
                  key={city.name}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #f8f8f8',
                    transition: 'background-color 0.2s',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => {
                    setSelectedCity(city.name);
                    setShowLocationDropdown(false);
                    localStorage.setItem('selectedCity', city.name);
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '500', color: '#000', fontSize: '14px' }}>
                      {city.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {city.state}
                    </div>
                  </div>
                  {selectedCity === city.name && (
                    <span style={{ color: '#e50914', fontSize: '16px' }}>✓</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
          <a href="/" style={{
            color: window.location.pathname === '/' ? '#e50914' : '#666',
            textDecoration: 'none',
            fontSize: '16px',
            fontWeight: '600',
            borderBottom: window.location.pathname === '/' ? '2px solid #e50914' : 'none',
            paddingBottom: '4px',
            transition: 'color 0.2s'
          }}>
            Home
          </a>
          <a href="/movies" style={{
            color: window.location.pathname === '/movies' ? '#e50914' : '#666',
            textDecoration: 'none',
            fontSize: '16px',
            fontWeight: '600',
            borderBottom: window.location.pathname === '/movies' ? '2px solid #e50914' : 'none',
            paddingBottom: '4px',
            transition: 'color 0.2s'
          }}>
            Movies
          </a>
          {isLoggedIn && (
            <a href="/bookings" style={{
              color: window.location.pathname === '/bookings' ? '#e50914' : '#666',
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: '600',
              borderBottom: window.location.pathname === '/bookings' ? '2px solid #e50914' : 'none',
              paddingBottom: '4px',
              transition: 'color 0.2s'
            }}>
              My Bookings
            </a>
          )}
          
        </div>

        {/* Search and Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <form onSubmit={handleSearch} style={{
            position: 'relative',
            width: '300px'
          }}>
            <input
              type="text"
              placeholder="Search for movies, theaters and showtimes"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 40px 10px 16px',
                borderRadius: '20px',
                border: '1px solid #e0e0e0',
                fontSize: '14px',
                background: '#f5f5f5',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#666',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              🔍
            </button>
          </form>

          {isLoggedIn && (
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #e50914, #b20710)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(229,9,20,0.3)'
            }} onClick={handleLogout}>
              U
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
