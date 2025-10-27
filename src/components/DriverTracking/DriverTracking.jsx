import React, { useState, useEffect, useRef } from 'react';
import Navbar from '../Navbar/Navbar';
import { supabase } from "../../../supabase";
import "./DriverTracking.css";

const GOOGLE_MAPS_API_KEY = "AIzaSyCwunFlQtMKPeJ2chyXPm1AKF07SvvqUX0";

// Manapparai coordinates (approx center)
const MANAPPARAI_CENTER = {
  lat: 10.6070,
  lng: 78.4255
};

const SERVICE_RADIUS_KM = 10;

const DriverTracking = () => {
  const [drivers, setDrivers] = useState([]);
  const [currentDriver, setCurrentDriver] = useState(null);
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState({});
  const [serviceCircle, setServiceCircle] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isAutoUpdating, setIsAutoUpdating] = useState(true);
  const mapRef = useRef(null);
  const timerRef = useRef(null);
  const locationTimerRef = useRef(null);
  const countdownRef = useRef(null);

  // Initialize map with Manapparai center
  useEffect(() => {
    const initMap = () => {
      const mapInstance = new window.google.maps.Map(mapRef.current, {
        zoom: 12,
        center: MANAPPARAI_CENTER,
        styles: [
          {
            featureType: "all",
            elementType: "geometry",
            stylers: [{ color: "#f5f5f5" }]
          },
          {
            featureType: "all",
            elementType: "labels.text.fill",
            stylers: [{ color: "#333333" }]
          },
          {
            featureType: "water",
            elementType: "geometry",
            stylers: [{ color: "#a0d6ff" }]
          },
          {
            featureType: "road",
            elementType: "geometry",
            stylers: [{ color: "#ffffff" }]
          },
          {
            featureType: "road",
            elementType: "labels.text.fill",
            stylers: [{ color: "#333333" }]
          }
        ],
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true
      });

      // Create service area circle
      const circle = new window.google.maps.Circle({
        strokeColor: '#ffcc00',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#ffcc00',
        fillOpacity: 0.1,
        map: mapInstance,
        center: MANAPPARAI_CENTER,
        radius: SERVICE_RADIUS_KM * 1000, // Convert to meters
      });

      setServiceCircle(circle);
      setMap(mapInstance);
    };

    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
      script.async = true;
      script.defer = true;
      script.onload = initMap;
      document.head.appendChild(script);
    } else {
      initMap();
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (locationTimerRef.current) {
        clearInterval(locationTimerRef.current);
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  // Countdown timer
  useEffect(() => {
    if (isAutoUpdating) {
      countdownRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            fetchDrivers();
            return 60;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    }

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [isAutoUpdating]);

  // Auto location update for current driver
  useEffect(() => {
    if (currentDriver && currentDriver.status === 'online' && isAutoUpdating) {
      // Update location immediately
      getCurrentLocation();
      
      // Set up interval for auto location updates
      locationTimerRef.current = setInterval(() => {
        getCurrentLocation();
      }, 60000);

      return () => {
        if (locationTimerRef.current) {
          clearInterval(locationTimerRef.current);
        }
      };
    }
  }, [currentDriver, isAutoUpdating]);

  // Fetch current driver info
  useEffect(() => {
    const fetchCurrentDriver = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: driver } = await supabase
          .from('driver')
          .select('*')
          .eq('id', user.id)
          .single();
        setCurrentDriver(driver);
      }
    };
    fetchCurrentDriver();
  }, []);

  // Check if driver is within service area
  const isWithinServiceArea = (lat, lng) => {
    const distance = calculateDistance(
      lat,
      lng,
      MANAPPARAI_CENTER.lat,
      MANAPPARAI_CENTER.lng
    );
    return distance <= SERVICE_RADIUS_KM;
  };

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Fetch all drivers
  const fetchDrivers = async () => {
    const { data: driversData, error } = await supabase
      .from('driver')
      .select('*')
      .eq('status', 'online');

    if (error) {
      console.error('Error fetching drivers:', error);
      return;
    }

    if (driversData) {
      setDrivers(driversData);
      updateMarkers(driversData);
    }
  };

  // Fetch all drivers and update every minute
  useEffect(() => {
    // Fetch immediately
    fetchDrivers();

    // Set up interval for updates
    timerRef.current = setInterval(fetchDrivers, 60000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [map]);

  const updateMarkers = (driversData) => {
    if (!map) return;

    const newMarkers = { ...markers };

    driversData.forEach(driver => {
      if (driver.latitude && driver.longitude) {
        const position = { lat: driver.latitude, lng: driver.longitude };
        const withinServiceArea = isWithinServiceArea(driver.latitude, driver.longitude);

        if (newMarkers[driver.id]) {
          // Update existing marker position
          newMarkers[driver.id].setPosition(position);
          
          // Update marker color based on service area
          newMarkers[driver.id].setIcon({
            url: '/bike.png',
            scaledSize: new window.google.maps.Size(32, 32),
            anchor: new window.google.maps.Point(16, 16)
          });
        } else {
          // Create new marker
          const marker = new window.google.maps.Marker({
            position: position,
            map: map,
            title: `${driver.driver_name} ${withinServiceArea ? '(In Service Area)' : '(Outside Service Area)'}`,
            icon: {
              url: '/bike.png',
              scaledSize: new window.google.maps.Size(32, 32),
              anchor: new window.google.maps.Point(16, 16)
            },
            animation: window.google.maps.Animation.DROP
          });

          // Add info window
          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div class="driver-info-window">
                <h3>${driver.driver_name}</h3>
                <p>Phone: ${driver.driver_phone}</p>
                <p>Status: ${driver.status}</p>
                <p class="service-area ${withinServiceArea ? 'within-area' : 'outside-area'}">
                  ${withinServiceArea ? '✓ Within Service Area' : '✗ Outside Service Area'}
                </p>
                <p>Distance from center: ${calculateDistance(driver.latitude, driver.longitude, MANAPPARAI_CENTER.lat, MANAPPARAI_CENTER.lng).toFixed(1)} km</p>
                ${driver.logined_at ? `<p>Last Active: ${new Date(driver.logined_at).toLocaleTimeString()}</p>` : ''}
                <button onclick="window.driverCardClick(${driver.id})" class="view-details-btn">View Details</button>
              </div>
            `
          });

          marker.addListener('click', () => {
            infoWindow.open(map, marker);
          });

          newMarkers[driver.id] = marker;
        }
      }
    });

    // Remove markers for drivers that are no longer online
    Object.keys(newMarkers).forEach(driverId => {
      if (!driversData.find(driver => driver.id.toString() === driverId)) {
        newMarkers[driverId].setMap(null);
        delete newMarkers[driverId];
      }
    });

    setMarkers(newMarkers);
  };

  // Add global function for button click in info window
  useEffect(() => {
    window.driverCardClick = (driverId) => {
      const driver = drivers.find(d => d.id === driverId);
      if (driver) {
        setSelectedDriver(driver);
        setShowDriverModal(true);
      }
    };

    return () => {
      window.driverCardClick = undefined;
    };
  }, [drivers]);

  const updateDriverLocation = async (latitude, longitude) => {
    if (!currentDriver) return;

    const withinServiceArea = isWithinServiceArea(latitude, longitude);

    const { error } = await supabase
      .from('driver')
      .update({
        latitude: latitude,
        longitude: longitude,
        updated_at: new Date().toISOString(),
        logined_at: new Date().toISOString(),
        status: 'online'
      })
      .eq('id', currentDriver.id);

    if (error) {
      console.error('Error updating location:', error);
    } else {
      // Update current driver state
      setCurrentDriver(prev => ({
        ...prev,
        latitude,
        longitude,
        updated_at: new Date().toISOString()
      }));
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          updateDriverLocation(latitude, longitude);
          
          // Center map on current location
          if (map) {
            map.setCenter({ lat: latitude, lng: longitude });
            map.setZoom(14);
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          alert('Unable to get your current location. Please ensure location services are enabled.');
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    }
  };

  const toggleOnlineStatus = async () => {
    if (!currentDriver) return;

    const newStatus = currentDriver.status === 'online' ? 'offline' : 'online';
    
    const { error } = await supabase
      .from('driver')
      .update({
        status: newStatus,
        logged_out: newStatus === 'offline' ? new Date().toISOString() : null,
        logined_at: newStatus === 'online' ? new Date().toISOString() : currentDriver.logined_at
      })
      .eq('id', currentDriver.id);

    if (!error) {
      setCurrentDriver(prev => ({ ...prev, status: newStatus }));
      if (newStatus === 'online') {
        getCurrentLocation();
      }
    }
  };

  const centerOnManapparai = () => {
    if (map) {
      map.setCenter(MANAPPARAI_CENTER);
      map.setZoom(12);
    }
  };

  const handleRefresh = () => {
    fetchDrivers();
    setTimeLeft(60);
    if (currentDriver?.status === 'online') {
      getCurrentLocation();
    }
  };

  const toggleAutoUpdate = () => {
    setIsAutoUpdating(!isAutoUpdating);
    if (!isAutoUpdating) {
      setTimeLeft(60);
    }
  };

  const handleDriverCardClick = (driver) => {
    setSelectedDriver(driver);
    setShowDriverModal(true);
  };

  const formatTime = (seconds) => {
    return `${seconds}s`;
  };

  return (
    <>
      <Navbar />
      <div className="driver-tracking-container">
        <div className="tracking-header">
          <div className="header-left">
            <h1>Manapparai Driver Tracking</h1>
            <p className="service-area-info">Service Area: 10 km radius around Manapparai</p>
          </div>
          <div className="driver-controls">
            {currentDriver && (
              <>
                <div className="driver-status">
                  <span className="status-label">Status:</span>
                  <span className={`status-badge ${currentDriver.status}`}>
                    {currentDriver.status}
                  </span>
                </div>
                <button 
                  className={`status-toggle-btn ${currentDriver.status}`}
                  onClick={toggleOnlineStatus}
                >
                  Go {currentDriver.status === 'online' ? 'Offline' : 'Online'}
                </button>
                <button 
                  className="update-location-btn"
                  onClick={getCurrentLocation}
                  disabled={currentDriver.status !== 'online'}
                >
                  Update My Location
                </button>
                <button 
                  className="center-map-btn"
                  onClick={centerOnManapparai}
                >
                  Center Map
                </button>
              </>
            )}
            <div className="refresh-controls">
              <button 
                className={`refresh-btn ${isAutoUpdating ? 'auto-updating' : ''}`}
                onClick={handleRefresh}
              >
                Refresh Now
              </button>
              <div className="timer-display">
                <span className="timer-label">Next update:</span>
                <span className="timer-value">{formatTime(timeLeft)}</span>
              </div>
              <button 
                className={`auto-update-btn ${isAutoUpdating ? 'active' : ''}`}
                onClick={toggleAutoUpdate}
              >
                Auto: {isAutoUpdating ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>

        <div className="map-container">
          <div ref={mapRef} className="google-map" />
          <div className="map-overlay">
            <div className="service-area-indicator">
              <div className="area-circle"></div>
              <span>10km Service Area</span>
            </div>
            <div className="update-status">
              Auto-update: <span className={isAutoUpdating ? 'status-on' : 'status-off'}>
                {isAutoUpdating ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>
        </div>

        <div className="drivers-list">
          <div className="list-header">
            <h3>Online Drivers in Manapparai Area ({drivers.filter(d => d.status === 'online' && d.latitude && d.longitude && isWithinServiceArea(d.latitude, d.longitude)).length})</h3>
            <div className="total-drivers">
              Total Online: {drivers.filter(d => d.status === 'online').length}
            </div>
          </div>
          <div className="drivers-grid">
            {drivers
              .filter(driver => driver.status === 'online')
              .map(driver => {
                const withinServiceArea = driver.latitude && driver.longitude && 
                  isWithinServiceArea(driver.latitude, driver.longitude);
                const distance = driver.latitude && driver.longitude ? 
                  calculateDistance(driver.latitude, driver.longitude, MANAPPARAI_CENTER.lat, MANAPPARAI_CENTER.lng) : null;

                return (
                  <div key={driver.id} className={`driver-card ${withinServiceArea ? 'within-area' : 'outside-area'}`}>
                    <div className="driver-avatar">
                      <img src="/bike.png" alt="Driver" />
                    </div>
                    <div className="driver-info">
                      <h4 
                        className="driver-name-clickable"
                        onClick={() => handleDriverCardClick(driver)}
                      >
                        {driver.driver_name}
                      </h4>
                      <p>{driver.driver_phone}</p>
                      <div className="location-info">
                        {driver.latitude && driver.longitude ? (
                          <span className={`location-status ${withinServiceArea ? 'within-area' : 'outside-area'}`}>
                            {withinServiceArea ? '✓ In Service Area' : '✗ Outside Area'}
                          </span>
                        ) : (
                          <span className="location-unavailable">No Location</span>
                        )}
                      </div>
                      {distance && (
                        <div className="distance-info">
                          {distance.toFixed(1)} km from center
                        </div>
                      )}
                      <div className="last-active">
                        Last update: {driver.updated_at ? new Date(driver.updated_at).toLocaleTimeString() : 'Never'}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Driver Info Modal */}
        {showDriverModal && selectedDriver && (
          <div className="modal-overlay" onClick={() => setShowDriverModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Driver Details</h2>
                <button 
                  className="modal-close-btn"
                  onClick={() => setShowDriverModal(false)}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <div className="driver-details">
                  <div className="detail-row">
                    <span className="detail-label">Name:</span>
                    <span className="detail-value">{selectedDriver.driver_name}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Phone:</span>
                    <span className="detail-value">{selectedDriver.driver_phone}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Status:</span>
                    <span className={`detail-value status-${selectedDriver.status}`}>
                      {selectedDriver.status}
                    </span>
                  </div>
                  {selectedDriver.latitude && selectedDriver.longitude && (
                    <>
                      <div className="detail-row">
                        <span className="detail-label">Location:</span>
                        <span className="detail-value">
                          {selectedDriver.latitude.toFixed(6)}, {selectedDriver.longitude.toFixed(6)}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Service Area:</span>
                        <span className={`detail-value ${isWithinServiceArea(selectedDriver.latitude, selectedDriver.longitude) ? 'within-area' : 'outside-area'}`}>
                          {isWithinServiceArea(selectedDriver.latitude, selectedDriver.longitude) ? 'Within 20km' : 'Outside 20km'}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Distance from Center:</span>
                        <span className="detail-value">
                          {calculateDistance(selectedDriver.latitude, selectedDriver.longitude, MANAPPARAI_CENTER.lat, MANAPPARAI_CENTER.lng).toFixed(1)} km
                        </span>
                      </div>
                    </>
                  )}
                  <div className="detail-row">
                    <span className="detail-label">Last Login:</span>
                    <span className="detail-value">
                      {selectedDriver.logined_at ? new Date(selectedDriver.logined_at).toLocaleString() : 'Never'}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Last Update:</span>
                    <span className="detail-value">
                      {selectedDriver.updated_at ? new Date(selectedDriver.updated_at).toLocaleString() : 'Never'}
                    </span>
                  </div>
                  {selectedDriver.logged_out && (
                    <div className="detail-row">
                      <span className="detail-label">Last Logout:</span>
                      <span className="detail-value">
                        {new Date(selectedDriver.logged_out).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  className="modal-close-button"
                  onClick={() => setShowDriverModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default DriverTracking;