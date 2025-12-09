import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabase';
import Navbar from '../Navbar/Navbar';
import './OrderTracking.css';

const GOOGLE_MAPS_API_KEY = "AIzaSyCwunFlQtMKPeJ2chyXPm1AKF07SvvqUX0";

const normalizeStatus = (status) => {
  if (!status) return 'processing';
  const statusMap = {
    'accessing': 'processing', 'processing': 'processing', 'confirmed': 'processing',
    'paid': 'processing', 'shipped': 'shipped', 'delivered': 'delivered', 'cancelled': 'cancelled'
  };
  return statusMap[status.toLowerCase()] || 'processing';
};

// Helper function to determine payment status
const getPaymentStatus = (order) => {
  const paymentMethod = order.payment_method?.toLowerCase();
  const paymentCompleted = order.payment_completed_at;
  const razorpayPaymentId = order.razorpay_payment_id;
  const cashCollected = order.cash_collected;
  
  // For online payments
  if (paymentMethod === 'online' || paymentMethod === 'card' || paymentMethod === 'upi' || paymentMethod === 'wallet') {
    if (paymentCompleted && razorpayPaymentId) {
      return {
        status: 'paid',
        label: 'Paid Online',
        details: `ID: ${razorpayPaymentId.slice(0, 8)}...`,
        time: order.payment_completed_at
      };
    } else if (razorpayPaymentId && !paymentCompleted) {
      return {
        status: 'pending',
        label: 'Pending',
        details: 'Payment initiated',
        time: null
      };
    } else {
      return {
        status: 'failed',
        label: 'Failed',
        details: 'Payment not completed',
        time: null
      };
    }
  }
  
  // For cash on delivery
  if (paymentMethod === 'cash' || paymentMethod === 'cod') {
    if (cashCollected) {
      return {
        status: 'cash',
        label: 'COD - Paid',
        details: `₹${order.cash_collected_amount || order.total_amount} collected`,
        time: order.cash_collected_at
      };
    } else {
      return {
        status: 'cod',
        label: 'COD - Pending',
        details: `₹${order.total_amount} to collect`,
        time: null
      };
    }
  }
  
  // Default fallback
  return {
    status: 'unknown',
    label: paymentMethod || 'Unknown',
    details: '',
    time: null
  };
};

// Get payment status badge class
const getPaymentStatusClass = (status) => {
  switch(status) {
    case 'paid': return 'order-tracking-payment-paid';
    case 'pending': return 'order-tracking-payment-pending';
    case 'failed': return 'order-tracking-payment-failed';
    case 'cash': return 'order-tracking-payment-cash';
    case 'cod': return 'order-tracking-payment-cod';
    default: return 'order-tracking-payment-pending';
  }
};

// Get driver status badge class
const getDriverStatusClass = (status) => {
  if (!status) return 'order-tracking-driver-status-default';
  
  const statusMap = {
    'order_placed': 'order-tracking-driver-status-order-placed',
    'partner_accepted': 'order-tracking-driver-status-partner-accepted',
    'reached_pickup_location': 'order-tracking-driver-status-reached-pickup',
    'pickup_completed': 'order-tracking-driver-status-pickup-completed',
    'item_not_available': 'order-tracking-driver-status-item-not-available',
    'restaurant_closed': 'order-tracking-driver-status-restaurant-closed',
    'reached_customer_location': 'order-tracking-driver-status-reached-customer',
    'cash_collected': 'order-tracking-driver-status-cash-collected',
    'paid_by_qr': 'order-tracking-driver-status-paid-by-qr',
    'already_paid': 'order-tracking-driver-status-already-paid',
    'order_completed': 'order-tracking-driver-status-order-completed',
    'cancelled': 'order-tracking-driver-status-cancelled'
  };
  
  return statusMap[status] || 'order-tracking-driver-status-default';
};

// Format driver status for display
const formatDriverStatus = (status) => {
  if (!status) return 'Not Started';
  
  const statusMap = {
    'order_placed': 'Order Placed',
    'partner_accepted': 'Driver Accepted',
    'reached_pickup_location': 'Reached Pickup',
    'pickup_completed': 'Pickup Completed',
    'item_not_available': 'Item Not Available',
    'restaurant_closed': 'Restaurant Closed',
    'reached_customer_location': 'Reached Customer',
    'cash_collected': 'Cash Collected',
    'paid_by_qr': 'Paid by QR',
    'already_paid': 'Already Paid',
    'order_completed': 'Order Completed',
    'cancelled': 'Cancelled'
  };
  
  return statusMap[status] || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const safeParseItems = (itemsData) => {
  if (Array.isArray(itemsData)) return itemsData;
  if (typeof itemsData === 'string') {
    try { return JSON.parse(itemsData); } catch { return []; }
  }
  return [];
};

// Get current IST date in YYYY-MM-DD format
const getCurrentISTDate = () => {
  const now = new Date();
  return now.toLocaleDateString('en-CA', {
    timeZone: 'Asia/Kolkata'
  });
};

// Get IST date from UTC timestamp
const getISTDate = (utcDateString) => {
  try {
    const date = new Date(utcDateString);
    if (isNaN(date.getTime())) {
      return null;
    }
    
    // Convert to IST and return date part only (YYYY-MM-DD)
    const istDateString = date.toLocaleDateString('en-CA', {
      timeZone: 'Asia/Kolkata'
    });
    
    return istDateString;
  } catch (error) {
    console.error('Error converting to IST date:', error);
    return null;
  }
};

// Get IST time from UTC timestamp
const getISTTime = (utcDateString) => {
  try {
    const date = new Date(utcDateString);
    if (isNaN(date.getTime())) {
      return null;
    }
    
    // Convert to IST and return time in 24-hour format
    const istTimeString = date.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    return istTimeString;
  } catch (error) {
    console.error('Error converting to IST time:', error);
    return null;
  }
};

// Check if time is after 12 AM IST
const isAfter12AM = (utcDateString) => {
  try {
    const istTime = getISTTime(utcDateString);
    if (!istTime) return false;
    
    // Parse hours and minutes from IST time (format: "HH:MM")
    const [hours, minutes] = istTime.split(':').map(Number);
    
    // Check if time is 00:00 or later (after 12 AM)
    return hours >= 0 && minutes >= 0;
  } catch (error) {
    console.error('Error checking if after 12 AM:', error);
    return false;
  }
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric', 
    month: 'short', 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true
  });
};

const formatCurrency = (amount) => {
  const num = parseFloat(amount || 0);
  return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

// Tamil Nadu timezone formatting
const getTamilNaduDay = (dateString) => {
  try {
    const date = new Date(dateString + 'T00:00:00+05:30');
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting day:', error);
    return 'Error';
  }
};

// Driver Assignment Modal Component
const DriverAssignmentModal = ({ order, drivers, onClose, onAssignDriver, onUnassignDriver }) => {
  const [selectedDriverId, setSelectedDriverId] = useState(order.driver_phone || '');
  const [assigning, setAssigning] = useState(false);
  const [unassigning, setUnassigning] = useState(false);

  const handleAssignDriver = async () => {
    if (!selectedDriverId) {
      alert('Please select a driver');
      return;
    }

    const selectedDriver = drivers.find(d => d.driver_phone === selectedDriverId);
    if (!selectedDriver) {
      alert('Selected driver not found');
      return;
    }

    setAssigning(true);
    try {
      await onAssignDriver(order.id, selectedDriver);
      onClose();
    } catch (error) {
      console.error('Error assigning driver:', error);
      alert('Failed to assign driver');
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassignDriver = async () => {
    if (!order.driver_name) {
      alert('No driver assigned to this order');
      return;
    }

    if (!window.confirm(`Are you sure you want to unassign ${order.driver_name} from this order?`)) {
      return;
    }

    setUnassigning(true);
    try {
      await onUnassignDriver(order.id);
      onClose();
    } catch (error) {
      console.error('Error unassigning driver:', error);
      alert('Failed to unassign driver');
    } finally {
      setUnassigning(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Filter online drivers
  const onlineDrivers = drivers.filter(driver => driver.status === 'online');
  const offlineDrivers = drivers.filter(driver => driver.status !== 'online');

  return (
    <div className="driver-assignment-modal-backdrop" onClick={handleBackdropClick}>
      <div className="driver-assignment-modal-content">
        <div className="driver-assignment-modal-header">
          <h2>Assign Driver to Order #{order.receipt_reference}</h2>
          <button className="driver-assignment-close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="driver-assignment-modal-body">
          {/* Order Information */}
          <div className="driver-assignment-order-info">
            <div className="driver-assignment-order-details">
              <div><strong>Customer:</strong> {order.customer_name}</div>
              <div><strong>Restaurant:</strong> {order.restaurant_name || 'N/A'}</div>
              <div><strong>Delivery Address:</strong> {order.delivery_address}</div>
              {order.delivery_distance_km && (
                <div><strong>Distance:</strong> {order.delivery_distance_km} km</div>
              )}
            </div>
            
            {order.driver_name && (
              <div className="driver-assignment-current-driver">
                <h4>Currently Assigned Driver</h4>
                <div className="current-driver-details">
                  <span className="current-driver-name">{order.driver_name}</span>
                  <span className="current-driver-phone">{order.driver_mobile}</span>
                  <span className={`current-driver-status ${order.driver_status ? getDriverStatusClass(order.driver_status) : ''}`}>
                    {order.driver_status ? formatDriverStatus(order.driver_status) : 'No Status'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Driver Selection */}
          <div className="driver-assignment-selection">
            <h3>Select a Driver</h3>
            
            {/* Online Drivers */}
            {onlineDrivers.length > 0 && (
              <div className="driver-category">
                <h4 className="driver-category-title online">🟢 Online Drivers ({onlineDrivers.length})</h4>
                <div className="driver-list">
                  {onlineDrivers.map(driver => (
                    <div 
                      key={driver.id}
                      className={`driver-item ${selectedDriverId === driver.driver_phone ? 'selected' : ''}`}
                      onClick={() => setSelectedDriverId(driver.driver_phone)}
                    >
                      <div className="driver-info">
                        <span className="driver-name">{driver.driver_name}</span>
                        <span className="driver-phone">{driver.driver_phone}</span>
                      </div>
                      <div className="driver-meta">
                        <span className="driver-status online">Online</span>
                        {driver.last_active && (
                          <span className="driver-last-active">
                            Active: {getISTTime(driver.last_active)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Offline Drivers */}
            {offlineDrivers.length > 0 && (
              <div className="driver-category">
                <h4 className="driver-category-title offline">⚫ Offline/Other Drivers ({offlineDrivers.length})</h4>
                <div className="driver-list">
                  {offlineDrivers.map(driver => (
                    <div 
                      key={driver.id}
                      className={`driver-item ${selectedDriverId === driver.driver_phone ? 'selected' : ''}`}
                      onClick={() => setSelectedDriverId(driver.driver_phone)}
                    >
                      <div className="driver-info">
                        <span className="driver-name">{driver.driver_name}</span>
                        <span className="driver-phone">{driver.driver_phone}</span>
                      </div>
                      <div className="driver-meta">
                        <span className={`driver-status ${driver.status || 'offline'}`}>
                          {driver.status ? driver.status.charAt(0).toUpperCase() + driver.status.slice(1) : 'Offline'}
                        </span>
                        {driver.last_active && (
                          <span className="driver-last-active">
                            Last Active: {formatDate(driver.last_active)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {drivers.length === 0 && (
              <div className="no-drivers-available">
                <div className="no-drivers-icon">🚫</div>
                <p>No drivers available</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="driver-assignment-modal-actions">
            {order.driver_name && (
              <button 
                onClick={handleUnassignDriver}
                className="driver-assignment-btn driver-assignment-unassign"
                disabled={unassigning}
              >
                {unassigning ? 'Unassigning...' : `Unassign ${order.driver_name}`}
              </button>
            )}
            
            <div className="driver-assignment-action-group">
              <button 
                onClick={onClose}
                className="driver-assignment-btn driver-assignment-cancel"
              >
                Cancel
              </button>
              <button 
                onClick={handleAssignDriver}
                className="driver-assignment-btn driver-assignment-confirm"
                disabled={assigning || !selectedDriverId}
              >
                {assigning ? 'Assigning...' : 'Assign Selected Driver'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Change Restaurant Modal Component
const ChangeRestaurantModal = ({ order, restaurants, onClose, onUpdateRestaurant }) => {
  const [selectedRestaurant, setSelectedRestaurant] = useState(order.restaurant_name || '');
  const [updating, setUpdating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleUpdateRestaurant = async () => {
    if (!selectedRestaurant) {
      alert('Please select a restaurant');
      return;
    }

    if (selectedRestaurant === order.restaurant_name) {
      alert('Restaurant is already the same');
      return;
    }

    setUpdating(true);
    try {
      await onUpdateRestaurant(order.id, selectedRestaurant);
      onClose();
    } catch (error) {
      console.error('Error updating restaurant:', error);
      alert('Failed to update restaurant');
    } finally {
      setUpdating(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Filter restaurants based on search term
  const filteredRestaurants = restaurants.filter(restaurant =>
    restaurant.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="change-restaurant-modal-backdrop" onClick={handleBackdropClick}>
      <div className="change-restaurant-modal-content">
        <div className="change-restaurant-modal-header">
          <h2>Change Restaurant for Order #{order.receipt_reference}</h2>
          <button className="change-restaurant-close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="change-restaurant-modal-body">
          {/* Order Information */}
          <div className="change-restaurant-order-info">
            <div className="change-restaurant-order-details">
              <div><strong>Customer:</strong> {order.customer_name}</div>
              <div><strong>Current Restaurant:</strong> {order.restaurant_name || 'N/A'}</div>
              <div><strong>Order Type:</strong> {order.order_type || 'Food'}</div>
              <div><strong>Items:</strong> {order.items?.length || 0} items</div>
            </div>
          </div>

          {/* Restaurant Selection */}
          <div className="change-restaurant-selection">
            <h3>Select New Restaurant</h3>
            
            {/* Search Box */}
            <div className="change-restaurant-search">
              <input
                type="text"
                placeholder="Search restaurants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="change-restaurant-search-input"
              />
              <span className="change-restaurant-search-icon">🔍</span>
            </div>
            
            {/* Restaurant List */}
            <div className="restaurant-list-container">
              {filteredRestaurants.length > 0 ? (
                <div className="restaurant-list">
                  {filteredRestaurants.map(restaurant => (
                    <div 
                      key={restaurant.id}
                      className={`restaurant-item ${selectedRestaurant === restaurant.name ? 'selected' : ''}`}
                      onClick={() => setSelectedRestaurant(restaurant.name)}
                    >
                      <div className="restaurant-info">
                        <span className="restaurant-name">{restaurant.name}</span>
                        <span className="restaurant-category">{restaurant.category || 'Uncategorized'}</span>
                      </div>
                      <div className="restaurant-meta">
                        <span className={`restaurant-status ${restaurant.hotel_status || 'unknown'}`}>
                          {restaurant.hotel_status === 'open' ? '🟢 Open' : '🔴 Closed'}
                        </span>
                        {restaurant.delivery_time && (
                          <span className="restaurant-delivery-time">
                            {restaurant.delivery_time} delivery
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-restaurants-found">
                  <div className="no-restaurants-icon">🏪</div>
                  <p>No restaurants found</p>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="change-restaurant-modal-actions">
            <div className="change-restaurant-action-group">
              <button 
                onClick={onClose}
                className="change-restaurant-btn change-restaurant-cancel"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdateRestaurant}
                className="change-restaurant-btn change-restaurant-confirm"
                disabled={updating || !selectedRestaurant || selectedRestaurant === order.restaurant_name}
              >
                {updating ? 'Updating...' : 'Change Restaurant'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Map Modal Component
const MapModal = ({ order, onClose }) => {
  const mapRef = React.useRef(null);
  const [map, setMap] = useState(null);
  const [marker, setMarker] = useState(null);

  useEffect(() => {
    if (!window.google || !order.customer_lat || !order.customer_lon) {
      return;
    }

    const initializeMap = () => {
      const location = {
        lat: parseFloat(order.customer_lat),
        lng: parseFloat(order.customer_lon)
      };

      const mapInstance = new window.google.maps.Map(mapRef.current, {
        center: location,
        zoom: 15,
        streetViewControl: false,
        mapTypeControl: true,
        fullscreenControl: true,
        zoomControl: true,
        styles: [
          {
            featureType: "all",
            elementType: "geometry",
            stylers: [{ color: "#f5f5f5" }]
          },
          {
            featureType: "all",
            elementType: "labels.text.fill",
            stylers: [{ color: "#616161" }]
          }
        ]
      });

      const markerInstance = new window.google.maps.Marker({
        position: location,
        map: mapInstance,
        title: `${order.customer_name}'s Location`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#4285F4",
          fillOpacity: 1,
          strokeColor: "#FFFFFF",
          strokeWeight: 2,
        },
        animation: window.google.maps.Animation.DROP
      });

      // Add info window
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 10px;">
            <h3 style="margin: 0 0 8px 0; color: #1a73e8;">${order.customer_name}</h3>
            <p style="margin: 0 0 4px 0; color: #5f6368;">${order.delivery_address}</p>
            <p style="margin: 0; color: #5f6368; font-size: 12px;">
              📱 ${order.customer_phone || 'N/A'}
            </p>
            <p style="margin: 8px 0 0 0; color: #5f6368; font-size: 12px;">
              📍 ${order.customer_lat.toFixed(6)}, ${order.customer_lon.toFixed(6)}
            </p>
          </div>
        `
      });

      markerInstance.addListener('click', () => {
        infoWindow.open(mapInstance, markerInstance);
      });

      // Open info window by default
      infoWindow.open(mapInstance, markerInstance);

      setMap(mapInstance);
      setMarker(markerInstance);
    };

    initializeMap();

    return () => {
      if (marker) {
        marker.setMap(null);
      }
    };
  }, [order.customer_lat, order.customer_lon]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getGoogleMapsLink = () => {
    if (!order.customer_lat || !order.customer_lon) return '#';
    return `https://www.google.com/maps?q=${order.customer_lat},${order.customer_lon}`;
  };

  const handleOpenInGoogleMaps = () => {
    window.open(getGoogleMapsLink(), '_blank');
  };

  const handleCopyCoordinates = () => {
    const coordinates = `${order.customer_lat}, ${order.customer_lon}`;
    navigator.clipboard.writeText(coordinates)
      .then(() => {
        alert('Coordinates copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy coordinates:', err);
      });
  };

  return (
    <div className="order-tracking-modal-backdrop" onClick={handleBackdropClick}>
      <div className="order-tracking-modal-content map-modal">
        <div className="order-tracking-modal-header">
          <h2>
            <span className="map-modal-title-icon">📍</span>
            Location for Order #{order.receipt_reference}
          </h2>
          <button className="order-tracking-close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="order-tracking-modal-body">
          {/* Customer Info Summary */}
          <div className="map-customer-info">
            <div className="map-customer-info-grid">
              <div className="map-customer-info-item">
                <strong>Customer:</strong> {order.customer_name}
              </div>
              <div className="map-customer-info-item">
                <strong>Phone:</strong> {order.customer_phone || 'N/A'}
              </div>
              <div className="map-customer-info-item">
                <strong>Coordinates:</strong> 
                <span className="map-coordinates">
                  {order.customer_lat?.toFixed(6)}, {order.customer_lon?.toFixed(6)}
                </span>
                <button 
                  onClick={handleCopyCoordinates}
                  className="map-copy-btn"
                  title="Copy coordinates"
                >
                  📋
                </button>
              </div>
            </div>
            
            <div className="map-address-section">
              <strong>Delivery Address:</strong>
              <p className="map-address-text">{order.delivery_address}</p>
            </div>
          </div>

          {/* Map Container */}
          <div className="map-container-wrapper">
            {order.customer_lat && order.customer_lon ? (
              <>
                <div 
                  ref={mapRef} 
                  className="map-container"
                  style={{ height: '500px', width: '100%' }}
                />
                <div className="map-controls">
                  <button 
                    onClick={handleOpenInGoogleMaps}
                    className="map-control-btn map-control-google"
                  >
                    <span className="map-control-icon">🌐</span>
                    Open in Google Maps
                  </button>
                  <button 
                    onClick={() => {
                      if (map) {
                        map.setZoom(map.getZoom() + 1);
                      }
                    }}
                    className="map-control-btn map-control-zoom"
                  >
                    <span className="map-control-icon">➕</span>
                    Zoom In
                  </button>
                  <button 
                    onClick={() => {
                      if (map) {
                        map.setZoom(map.getZoom() - 1);
                      }
                    }}
                    className="map-control-btn map-control-zoom"
                  >
                    <span className="map-control-icon">➖</span>
                    Zoom Out
                  </button>
                </div>
              </>
            ) : (
              <div className="map-no-location">
                <div className="map-no-location-icon">📍</div>
                <h3>Location Not Available</h3>
                <p>This order does not have location coordinates.</p>
                <button 
                  onClick={handleBackdropClick}
                  className="map-close-btn"
                >
                  Close
                </button>
              </div>
            )}
          </div>

          {/* Additional Information */}
          <div className="map-additional-info">
            <div className="map-info-card">
              <h4>Delivery Information</h4>
              <div className="map-info-content">
                {order.delivery_distance_km && (
                  <div className="map-info-item">
                    <span className="map-info-label">Distance:</span>
                    <span className="map-info-value">{order.delivery_distance_km} km</span>
                  </div>
                )}
                {order.driver_name && (
                  <div className="map-info-item">
                    <span className="map-info-label">Assigned Driver:</span>
                    <span className="map-info-value">{order.driver_name} ({order.driver_mobile})</span>
                  </div>
                )}
                {order.restaurant_name && (
                  <div className="map-info-item">
                    <span className="map-info-label">Restaurant:</span>
                    <span className="map-info-value">{order.restaurant_name}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="map-actions">
              <button 
                onClick={handleOpenInGoogleMaps}
                className="order-tracking-action-btn order-tracking-primary"
                disabled={!order.customer_lat || !order.customer_lon}
              >
                <span style={{ marginRight: '8px' }}>🌐</span>
                Open in Google Maps
              </button>
              <button 
                onClick={onClose}
                className="order-tracking-action-btn order-tracking-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Calendar Component
const CalendarPicker = ({ selectedDate, onDateSelect, onClose }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Get days in month
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  // Get first day of month
  const getFirstDayOfMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  // Navigate months
  const navigateMonth = (direction) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(currentMonth.getMonth() + direction);
    setCurrentMonth(newMonth);
  };

  // Check if date is today
  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Check if date is selected
  const isSelected = (date) => {
    if (!selectedDate) return false;
    const selected = new Date(selectedDate + 'T00:00:00');
    return date.toDateString() === selected.toDateString();
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      days.push(date);
    }

    return days;
  };

  const days = generateCalendarDays();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="calendar-picker-backdrop" onClick={onClose}>
      <div className="calendar-picker" onClick={(e) => e.stopPropagation()}>
        <div className="calendar-picker-header">
          <button className="calendar-nav-btn" onClick={() => navigateMonth(-1)}>←</button>
          <h3>{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</h3>
          <button className="calendar-nav-btn" onClick={() => navigateMonth(1)}>→</button>
        </div>
        
        <div className="calendar-grid">
          {dayNames.map(day => (
            <div key={day} className="calendar-day-header">{day}</div>
          ))}
          
          {days.map((date, index) => (
            <button
              key={index}
              className={`calendar-day ${
                !date ? 'calendar-empty' : ''
              } ${
                date && isToday(date) ? 'calendar-today' : ''
              } ${
                date && isSelected(date) ? 'calendar-selected' : ''
              }`}
              onClick={() => date && onDateSelect(date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }))}
              disabled={!date}
            >
              {date ? date.getDate() : ''}
            </button>
          ))}
        </div>
        
        <div className="calendar-picker-actions">
          <button 
            className="calendar-today-btn"
            onClick={() => {
              const today = new Date();
              onDateSelect(today.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
            }}
          >
            Today
          </button>
          <button className="calendar-close-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Order Modal Component
const OrderModal = ({ order, onClose, onStatusUpdate, normalizeStatus, formatCurrency, formatDate, onShowMap, onAssignDriver, onChangeRestaurant }) => {
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Get payment status
  const paymentStatus = getPaymentStatus(order);

  return (
    <div className="order-tracking-modal-backdrop" onClick={handleBackdropClick}>
      <div className="order-tracking-modal-content">
        <div className="order-tracking-modal-header">
          <h2>Order Details</h2>
          <button className="order-tracking-close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="order-tracking-modal-body">
          {/* Order Header */}
          <div className="order-tracking-order-header">
            <div className="order-tracking-order-id">
              <strong>#{order.receipt_reference}</strong>
              <span className={`order-tracking-status-badge order-tracking-status-${normalizeStatus(order.status)}`}>
                {normalizeStatus(order.status).toUpperCase()}
              </span>
              <span className={`order-tracking-payment-status ${getPaymentStatusClass(paymentStatus.status)}`}>
                {paymentStatus.label}
              </span>
            </div>
            <div className="order-tracking-order-meta">
              <div>Placed on: {formatDate(order.created_at)}</div>
              {order.delivery_time && (
                <div>Delivery by: {formatDate(order.delivery_time)}</div>
              )}
            </div>
          </div>

          {/* Customer & Restaurant Info */}
          <div className="order-tracking-info-grid">
            <div className="order-tracking-info-card">
              <h3>Customer Information</h3>
              <div className="order-tracking-info-item">
                <strong>Name:</strong> {order.customer_name}
              </div>
              <div className="order-tracking-info-item">
                <strong>Phone:</strong> {order.customer_phone}
              </div>
              <div className="order-tracking-info-item">
                <strong>Address:</strong> {order.delivery_address}
              </div>
              {order.customer_lat && order.customer_lon && (
                <div className="order-tracking-info-item order-tracking-location-item">
                  <strong>Location:</strong> 
                  <span className="order-tracking-coordinates">
                    {order.customer_lat.toFixed(6)}, {order.customer_lon.toFixed(6)}
                  </span>
                  <button 
                    onClick={() => onShowMap(order)}
                    className="order-tracking-map-btn"
                    title="View on map"
                  >
                    <span className="order-tracking-map-icon">📍</span>
                    View Map
                  </button>
                </div>
              )}
            </div>

            <div className="order-tracking-info-card">
              <h3>Restaurant & Delivery</h3>
              <div className="order-tracking-info-item">
                <strong>Restaurant:</strong> {order.restaurant_name || 'N/A'}
              </div>
              
              {order.driver_name && (
                <div className="order-tracking-info-item">
                  <strong>Driver:</strong> {order.driver_name} ({order.driver_mobile})
                </div>
              )}
              
              {order.delivery_distance_km && (
                <div className="order-tracking-info-item">
                  <strong>Distance:</strong> {order.delivery_distance_km} km
                </div>
              )}
              
              {/* Driver Status in Modal */}
              {order.driver_status && (
                <div className="order-tracking-info-item">
                  <strong>Driver Status:</strong>
                  <span className={`order-tracking-driver-status-badge ${getDriverStatusClass(order.driver_status)}`}>
                    {formatDriverStatus(order.driver_status)}
                  </span>
                </div>
              )}
              
              {order.otp && normalizeStatus(order.status) !== 'delivered' && (
                <div className="order-tracking-info-item order-tracking-otp-highlight">
                  <strong>Delivery OTP:</strong> {order.otp}
                </div>
              )}
            </div>
          </div>

          {/* Payment Information Section */}
          <div className="order-tracking-info-card" style={{ marginBottom: '24px' }}>
            <h3>Payment Information</h3>
            <div className="order-tracking-info-item">
              <strong>Method:</strong> {order.payment_method}
            </div>
            <div className="order-tracking-info-item">
              <strong>Status:</strong>
              <span className={`order-tracking-payment-status ${getPaymentStatusClass(paymentStatus.status)}`}>
                {paymentStatus.label}
              </span>
            </div>
            
            {paymentStatus.details && (
              <div className="order-tracking-info-item">
                <strong>Details:</strong> {paymentStatus.details}
              </div>
            )}
            
            {paymentStatus.time && (
              <div className="order-tracking-info-item">
                <strong>Payment Time:</strong> {formatDate(paymentStatus.time)}
              </div>
            )}
            
            {order.razorpay_payment_id && (
              <div className="order-tracking-info-item">
                <strong>Payment ID:</strong> {order.razorpay_payment_id}
              </div>
            )}
            
            {order.razorpay_order_id && (
              <div className="order-tracking-info-item">
                <strong>Order ID:</strong> {order.razorpay_order_id}
              </div>
            )}
          </div>

          {/* Order Items */}
          <div className="order-tracking-items-section">
            <h3>Order Items ({order.items?.length || 0})</h3>
            <div className="order-tracking-items-list">
              {order.items?.map((item, index) => (
                <div key={index} className="order-tracking-item-card">
                  <img 
                    src={item.product_image} 
                    alt={item.product_name}
                    className="order-tracking-item-image"
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/60x60?text=No+Image';
                    }}
                  />
                  <div className="order-tracking-item-details">
                    <div className="order-tracking-item-name">{item.product_name}</div>
                    <div className="order-tracking-item-meta">
                      <span className="order-tracking-item-quantity">Qty: {item.quantity}</span>
                      <span className="order-tracking-item-price">{formatCurrency(item.price)}</span>
                    </div>
                    {item.original_price && item.original_price > item.price && (
                      <div className="order-tracking-item-discount">
                        <span className="order-tracking-original-price">{formatCurrency(item.original_price)}</span>
                        <span className="order-tracking-discount-badge">
                          Save {formatCurrency(item.original_price - item.price)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Summary */}
          <div className="order-summary-items">
            <h3>Order Summary</h3>
            <div className="order-summary-list">
              <div className="order-summary-item">
                <span className="order-summary-item-label">Subtotal:</span>
                <span className="order-summary-item-value">{formatCurrency(order.total_amount - (order.delivery_charges || 0))}</span>
              </div>
              {order.delivery_charges && order.delivery_charges > 0 && (
                <div className="order-summary-item">
                  <span className="order-summary-item-label">Delivery Charges:</span>
                  <span className="order-summary-item-value">{formatCurrency(order.delivery_charges)}</span>
                </div>
              )}
              {order.promo_code && (
                <div className="order-summary-item">
                  <span className="order-summary-item-label">Promo Code:</span>
                  <span className="order-summary-item-value">{order.promo_code}</span>
                </div>
              )}
              <div className="order-summary-total">
                <span>Total Amount:</span>
                <span>{formatCurrency(order.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="order-tracking-modal-actions">
            {order.customer_lat && order.customer_lon && (
              <button 
                onClick={() => onShowMap(order)}
                className="order-tracking-action-btn order-tracking-warning"
              >
                <span style={{ marginRight: '8px' }}>📍</span>
                View Map
              </button>
            )}
            
            {/* Change Restaurant Button */}
            <button 
              onClick={() => onChangeRestaurant(order)}
              className="order-tracking-action-btn order-tracking-restaurant-change"
            >
              <span style={{ marginRight: '8px' }}>🏪</span>
              Change Restaurant
            </button>
            
            {/* Driver Assignment Button */}
            <button 
              onClick={() => onAssignDriver(order)}
              className="order-tracking-action-btn order-tracking-driver-assign"
            >
              <span style={{ marginRight: '8px' }}>🚗</span>
              {order.driver_name ? 'Change Driver' : 'Assign Driver'}
            </button>
            
            {(normalizeStatus(order.status) === 'processing' || normalizeStatus(order.status) === 'shipped') && (
              <button 
                onClick={() => {
                  if (window.confirm('Are you sure you want to cancel this order?')) {
                    onStatusUpdate(order.id, 'cancelled');
                    onClose();
                  }
                }}
                className="order-tracking-action-btn order-tracking-danger"
              >
                <span style={{ marginRight: '8px' }}>❌</span>
                Cancel Order
              </button>
            )}
            <button onClick={onClose} className="order-tracking-action-btn order-tracking-secondary">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main OrderTracking Component
const OrderTracking = () => {
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [viewMode, setViewMode] = useState('calendar');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDriverAssignmentModal, setShowDriverAssignmentModal] = useState(false);
  const [showChangeRestaurantModal, setShowChangeRestaurantModal] = useState(false);
  const [selectedOrderForAction, setSelectedOrderForAction] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [restaurantFilter, setRestaurantFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [driverStatusFilter, setDriverStatusFilter] = useState('all');
  const [driverFilter, setDriverFilter] = useState('all');
  const [showCalendar, setShowCalendar] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapOrder, setMapOrder] = useState(null);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);

  // Load Google Maps API
  useEffect(() => {
    const scriptId = 'google-maps-script';
    if (document.getElementById(scriptId)) {
      setGoogleMapsLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setGoogleMapsLoaded(true);
    };
    script.onerror = () => {
      console.error('Failed to load Google Maps API');
      setError('Failed to load maps. Please check your internet connection.');
    };
    
    document.head.appendChild(script);
  }, []);

  // Initialize selectedDate with current IST date FIRST, then fetch orders
  useEffect(() => {
    const currentISTDate = getCurrentISTDate();
    setSelectedDate(currentISTDate);
  }, []);

  // Fetch orders, drivers, and restaurants only after date is set
  useEffect(() => {
    if (selectedDate) {
      fetchOrders();
      fetchDrivers();
      fetchRestaurants();
      const subscription = subscribeToOrders();
      const driverSubscription = subscribeToDrivers();
      return () => {
        subscription?.unsubscribe();
        driverSubscription?.unsubscribe();
      };
    }
  }, [selectedDate]);

  const calculateStats = (ordersData, date) => {
    if (!date) return { total: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
    
    const filteredOrders = ordersData.filter(order => {
      const istDate = getISTDate(order.created_at);
      const isAfterMidnight = isAfter12AM(order.created_at);
      
      return istDate === date && isAfterMidnight;
    });

    return {
      total: filteredOrders.length,
      processing: filteredOrders.filter(o => normalizeStatus(o.status) === 'processing').length,
      shipped: filteredOrders.filter(o => normalizeStatus(o.status) === 'shipped').length,
      delivered: filteredOrders.filter(o => normalizeStatus(o.status) === 'delivered').length,
      cancelled: filteredOrders.filter(o => normalizeStatus(o.status) === 'cancelled').length,
    };
  };

  const stats = useMemo(() => calculateStats(orders, selectedDate), [orders, selectedDate]);

  // Get unique restaurants for filter
  const uniqueRestaurants = useMemo(() => {
    const restaurants = [...new Set(orders.map(order => order.restaurant_name).filter(Boolean))];
    return restaurants.sort();
  }, [orders]);

  // Get unique payment methods for filter
  const paymentMethods = useMemo(() => {
    const uniqueMethods = [...new Set(orders
      .map(order => order.payment_method)
      .filter(Boolean)
      .map(method => {
        // Normalize payment method names
        const lowerMethod = method.toLowerCase();
        if (lowerMethod.includes('online') || lowerMethod.includes('card') || lowerMethod.includes('upi') || lowerMethod.includes('wallet')) {
          return 'Online Payment';
        } else if (lowerMethod.includes('cash') || lowerMethod.includes('cod')) {
          return 'Cash on Delivery';
        }
        return method;
      })
    )];
    
    // Remove duplicates and sort
    return [...new Set(uniqueMethods)].sort();
  }, [orders]);

  // Get unique driver statuses for filter
  const driverStatuses = useMemo(() => {
    const uniqueStatuses = [...new Set(orders
      .map(order => order.driver_status)
      .filter(Boolean)
      .map(status => formatDriverStatus(status))
    )];
    
    // Remove duplicates and sort
    return ['All Driver Status', ...new Set(uniqueStatuses)].sort();
  }, [orders]);

  // Get unique drivers for filter
  const uniqueDrivers = useMemo(() => {
    const driversWithOrders = orders
      .filter(order => order.driver_name)
      .map(order => ({
        name: order.driver_name,
        phone: order.driver_mobile
      }));
    
    // Remove duplicates
    const unique = Array.from(
      new Map(driversWithOrders.map(item => [item.phone, item])).values()
    );
    
    return unique.sort((a, b) => a.name.localeCompare(b.name));
  }, [orders]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const processedOrders = (data || []).map(order => ({
        ...order,
        items: safeParseItems(order.items),
        status: normalizeStatus(order.status)
      }));
      
      setOrders(processedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from('driver')
        .select('*')
        .order('driver_name', { ascending: true });

      if (error) throw error;
      
      setDrivers(data || []);
    } catch (error) {
      console.error('Error fetching drivers:', error);
      setError('Failed to load drivers');
    }
  };

  const fetchRestaurants = async () => {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      
      setRestaurants(data || []);
    } catch (error) {
      console.error('Error fetching restaurants:', error);
      setError('Failed to load restaurants');
    }
  };

  const subscribeToOrders = () => {
    try {
      return supabase
        .channel('orders-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
        .subscribe();
    } catch (error) {
      console.error('Error setting up subscription:', error);
      return null;
    }
  };

  const subscribeToDrivers = () => {
    try {
      return supabase
        .channel('drivers-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'driver' }, fetchDrivers)
        .subscribe();
    } catch (error) {
      console.error('Error setting up driver subscription:', error);
      return null;
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw error;
      
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );
    } catch (error) {
      console.error('Error updating order status:', error);
      setError('Failed to update status');
    }
  };

  const assignDriverToOrder = async (orderId, driver) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          driver_name: driver.driver_name,
          driver_mobile: driver.driver_phone,
          driver_status: 'partner_accepted', // Default status when assigned
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;
      
      // Update local state
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId 
            ? { 
                ...order, 
                driver_name: driver.driver_name,
                driver_mobile: driver.driver_phone,
                driver_status: 'partner_accepted'
              } 
            : order
        )
      );
      
      return { success: true };
    } catch (error) {
      console.error('Error assigning driver:', error);
      throw error;
    }
  };

  const unassignDriverFromOrder = async (orderId) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          driver_name: null,
          driver_mobile: null,
          driver_status: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;
      
      // Update local state
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId 
            ? { 
                ...order, 
                driver_name: null,
                driver_mobile: null,
                driver_status: null
              } 
            : order
        )
      );
      
      return { success: true };
    } catch (error) {
      console.error('Error unassigning driver:', error);
      throw error;
    }
  };

  const updateRestaurantForOrder = async (orderId, restaurantName) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          restaurant_name: restaurantName,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;
      
      // Update local state
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId 
            ? { 
                ...order, 
                restaurant_name: restaurantName
              } 
            : order
        )
      );
      
      return { success: true };
    } catch (error) {
      console.error('Error updating restaurant:', error);
      throw error;
    }
  };

  const openOrderDetails = (order) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  const closeOrderDetails = () => {
    setIsModalOpen(false);
    setSelectedOrder(null);
  };

  const openMapModal = (order) => {
    setMapOrder(order);
    setShowMapModal(true);
  };

  const closeMapModal = () => {
    setShowMapModal(false);
    setMapOrder(null);
  };

  const openDriverAssignmentModal = (order) => {
    setSelectedOrderForAction(order);
    setShowDriverAssignmentModal(true);
  };

  const closeDriverAssignmentModal = () => {
    setShowDriverAssignmentModal(false);
    setSelectedOrderForAction(null);
  };

  const openChangeRestaurantModal = (order) => {
    setSelectedOrderForAction(order);
    setShowChangeRestaurantModal(true);
  };

  const closeChangeRestaurantModal = () => {
    setShowChangeRestaurantModal(false);
    setSelectedOrderForAction(null);
  };

  const getOrdersForSelectedDate = () => {
    if (!selectedDate) return [];
    return orders.filter(order => {
      const istDate = getISTDate(order.created_at);
      const isAfterMidnight = isAfter12AM(order.created_at);
      
      return istDate === selectedDate && isAfterMidnight;
    });
  };

  const navigateDate = (days) => {
    if (!selectedDate) return;
    
    const currentDate = new Date(selectedDate + 'T00:00:00+05:30');
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + days);
    
    const newDateStr = newDate.toLocaleDateString('en-CA', {
      timeZone: 'Asia/Kolkata'
    });
    setSelectedDate(newDateStr);
  };

  const goToToday = () => {
    const currentISTDate = getCurrentISTDate();
    setSelectedDate(currentISTDate);
  };

  const isToday = (dateStr) => {
    const currentISTDate = getCurrentISTDate();
    return dateStr === currentISTDate;
  };

  const handleCalendarDateSelect = (date) => {
    setSelectedDate(date);
    setShowCalendar(false);
  };

  // Filter orders based on search and filters
  const filteredOrders = useMemo(() => {
    let filtered = viewMode === 'calendar' ? getOrdersForSelectedDate() : orders;
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(order => 
        order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.receipt_reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_phone?.includes(searchTerm) ||
        order.driver_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => normalizeStatus(order.status) === statusFilter);
    }
    
    // Apply restaurant filter
    if (restaurantFilter !== 'all') {
      filtered = filtered.filter(order => order.restaurant_name === restaurantFilter);
    }
    
    // Apply payment method filter
    if (paymentMethodFilter !== 'all') {
      filtered = filtered.filter(order => {
        const paymentMethod = order.payment_method?.toLowerCase();
        if (paymentMethodFilter === 'Online Payment') {
          return paymentMethod.includes('online') || 
                 paymentMethod.includes('card') || 
                 paymentMethod.includes('upi') || 
                 paymentMethod.includes('wallet');
        } else if (paymentMethodFilter === 'Cash on Delivery') {
          return paymentMethod.includes('cash') || 
                 paymentMethod.includes('cod');
        }
        return order.payment_method === paymentMethodFilter;
      });
    }
    
    // Apply driver status filter
    if (driverStatusFilter !== 'all' && driverStatusFilter !== 'All Driver Status') {
      filtered = filtered.filter(order => {
        const formattedDriverStatus = formatDriverStatus(order.driver_status);
        return formattedDriverStatus === driverStatusFilter;
      });
    }
    
    // Apply driver filter
    if (driverFilter !== 'all') {
      const [driverName, driverPhone] = driverFilter.split('|');
      filtered = filtered.filter(order => 
        order.driver_name === driverName && order.driver_mobile === driverPhone
      );
    }
    
    return filtered;
  }, [viewMode, orders, selectedDate, searchTerm, statusFilter, restaurantFilter, paymentMethodFilter, driverStatusFilter, driverFilter]);

  const DateNavigation = () => {
    if (!selectedDate) return null;
    
    return (
      <div className="order-tracking-date-navigation">
        <div className="order-tracking-date-nav-header">
          <button onClick={() => navigateDate(-1)} className="order-tracking-nav-btn" title="Previous day">←</button>
          
          <div className="order-tracking-date-display">
            <span className="order-tracking-selected-date">
              {getTamilNaduDay(selectedDate)}
              {isToday(selectedDate) && <span className="order-tracking-today-badge">Today</span>}
            </span>
            <button 
              onClick={() => setShowCalendar(true)}
              className="order-tracking-calendar-btn"
              title="Open calendar"
            >
              📅
            </button>
          </div>
          
          <button onClick={() => navigateDate(1)} className="order-tracking-nav-btn" title="Next day">→</button>
        </div>
        <div className="order-tracking-date-stats">
          <div className="order-tracking-date-stat">Total: {stats.total}</div>
          <div className="order-tracking-date-stat">Processing: {stats.processing}</div>
          <div className="order-tracking-date-stat">Shipped: {stats.shipped}</div>
          <div className="order-tracking-date-stat">Delivered: {stats.delivered}</div>
          <div className="order-tracking-date-stat">Cancelled: {stats.cancelled}</div>
        </div>
      </div>
    );
  };

  const renderPaymentStatus = (order) => {
    const paymentStatus = getPaymentStatus(order);
    return (
      <div className="order-tracking-payment-info-cell">
        <span className={`order-tracking-payment-status ${getPaymentStatusClass(paymentStatus.status)}`}>
          {paymentStatus.label}
        </span>
        {paymentStatus.time && (
          <div className="order-tracking-payment-time">
            {formatDate(paymentStatus.time).split(',')[1]}
          </div>
        )}
        {paymentStatus.details && order.payment_method?.toLowerCase() === 'online' && (
          <div className="online-payment-details">
            <div>{paymentStatus.details}</div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="order-tracking-loading-container">
          <div className="order-tracking-loading-spinner"></div>
          <p>Loading orders...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="order-tracking">
        {error && (
          <div className="order-tracking-error-banner">
            {error}
            <button onClick={() => setError(null)} className="order-tracking-close-error">×</button>
          </div>
        )}

        <div className="order-tracking-header">
          <h1 className="order-tracking-header-title">Order Tracking</h1>
          <div className="order-tracking-header-controls">
            <div className="order-tracking-view-toggle">
              <button 
                className={`order-tracking-toggle-btn ${viewMode === 'list' ? 'order-tracking-active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                All Orders
              </button>
              <button 
                className={`order-tracking-toggle-btn ${viewMode === 'calendar' ? 'order-tracking-active' : ''}`}
                onClick={() => setViewMode('calendar')}
              >
                Day View
              </button>
            </div>
            {viewMode === 'calendar' && (
              <button onClick={goToToday} className="order-tracking-toggle-btn order-tracking-today-btn">
                Today
              </button>
            )}
          </div>
        </div>

        {/* Enhanced Filters */}
        <div className="order-tracking-filters-section">
          <div className="order-tracking-search-box">
            <input
              type="text"
              placeholder="Search by name, order ID, phone, or driver..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="order-tracking-search-input"
            />
            <span className="order-tracking-search-icon">🔍</span>
          </div>
          
          <div className="order-tracking-filter-controls">
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="order-tracking-filter-select"
            >
              <option value="all">All Status</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
            
            <select 
              value={restaurantFilter} 
              onChange={(e) => setRestaurantFilter(e.target.value)}
              className="order-tracking-filter-select"
            >
              <option value="all">All Restaurants</option>
              {uniqueRestaurants.map(restaurant => (
                <option key={restaurant} value={restaurant}>{restaurant}</option>
              ))}
            </select>
            
            {/* Payment Method Filter */}
            <select 
              value={paymentMethodFilter} 
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="order-tracking-filter-select"
            >
              <option value="all">All Payment Types</option>
              {paymentMethods.map(method => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
            
            {/* Driver Status Filter */}
            <select 
              value={driverStatusFilter} 
              onChange={(e) => setDriverStatusFilter(e.target.value)}
              className="order-tracking-filter-select"
            >
              <option value="all">All Driver Status</option>
              {driverStatuses.slice(1).map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            
            {/* Driver Filter */}
            <select 
              value={driverFilter} 
              onChange={(e) => setDriverFilter(e.target.value)}
              className="order-tracking-filter-select"
            >
              <option value="all">All Drivers</option>
              {uniqueDrivers.map(driver => (
                <option key={`${driver.name}|${driver.phone}`} value={`${driver.name}|${driver.phone}`}>
                  {driver.name} ({driver.phone})
                </option>
              ))}
            </select>
          </div>
        </div>

        {viewMode === 'calendar' && <DateNavigation />}

        {/* Stats Grid - Only show in calendar view */}
        {viewMode === 'calendar' && (
          <div className="order-tracking-stats-grid">
            <div className="order-tracking-stat-card order-tracking-total">
              <div className="order-tracking-stat-number">{stats.total}</div>
              <div className="order-tracking-stat-label">Total Orders</div>
            </div>
            <div className="order-tracking-stat-card order-tracking-processing">
              <div className="order-tracking-stat-number">{stats.processing}</div>
              <div className="order-tracking-stat-label">Processing</div>
            </div>
            <div className="order-tracking-stat-card order-tracking-shipped">
              <div className="order-tracking-stat-number">{stats.shipped}</div>
              <div className="order-tracking-stat-label">Shipped</div>
            </div>
            <div className="order-tracking-stat-card order-tracking-delivered">
              <div className="order-tracking-stat-number">{stats.delivered}</div>
              <div className="order-tracking-stat-label">Delivered</div>
            </div>
            <div className="order-tracking-stat-card order-tracking-cancelled">
              <div className="order-tracking-stat-number">{stats.cancelled}</div>
              <div className="order-tracking-stat-label">Cancelled</div>
            </div>
          </div>
        )}

        {/* Orders Table */}
        <div className="order-tracking-orders-table-container">
          <div className="order-tracking-table-header">
            <h3>
              {viewMode === 'calendar' 
                ? `Orders for ${getTamilNaduDay(selectedDate)}`
                : 'All Orders'
              }
              <span className="order-tracking-orders-count"> ({filteredOrders.length})</span>
            </h3>
          </div>
          
          <table className="order-tracking-orders-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Restaurant</th>
                <th>Driver</th>
                <th>Payment Type</th>
                <th>Driver Status</th>
                <th>Amount</th>
                <th>Payment Status</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                // Determine payment type for display
                const paymentMethod = order.payment_method?.toLowerCase();
                let paymentType = order.payment_method || 'Unknown';
                
                if (paymentMethod?.includes('online') || paymentMethod?.includes('card') || paymentMethod?.includes('upi') || paymentMethod?.includes('wallet')) {
                  paymentType = 'Online Payment';
                } else if (paymentMethod?.includes('cash') || paymentMethod?.includes('cod')) {
                  paymentType = 'Cash on Delivery';
                }
                
                return (
                  <tr key={order.id} className="order-tracking-order-row" onClick={() => openOrderDetails(order)}>
                    <td>
                      <strong>#{order.id}</strong>
                      <div className="order-tracking-order-meta">
                        <span className={`order-tracking-payment-method order-tracking-payment-${paymentMethod?.replace(' ', '-')}`}>
                          {paymentType}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="order-tracking-customer-info">
                        <span className="order-tracking-customer-name">{order.customer_name}</span>
                        <span className="order-tracking-customer-phone">{order.customer_phone}</span>
                        {order.customer_lat && order.customer_lon && (
                          <div className="order-tracking-location-info">
                            <span className="order-tracking-location-coords">
                              📍 {order.customer_lat.toFixed(4)}, {order.customer_lon.toFixed(4)}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="order-tracking-restaurant-info">
                        <span className="order-tracking-restaurant-name">{order.restaurant_name || 'N/A'}</span>
                        {order.delivery_distance_km && (
                          <span className="order-tracking-distance">{order.delivery_distance_km} km</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="order-tracking-driver-info">
                        {order.driver_name ? (
                          <>
                            <span className="order-tracking-driver-name">{order.driver_name}</span>
                            <span className="order-tracking-driver-phone">{order.driver_mobile}</span>
                          </>
                        ) : (
                          <span className="order-tracking-no-driver">Not assigned</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="order-tracking-payment-type-info">
                        <span className={`payment-type-badge payment-type-${paymentType.toLowerCase().replace(' ', '-')}`}>
                          {paymentType}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="order-tracking-driver-status-cell">
                        <span className={`order-tracking-driver-status-badge ${getDriverStatusClass(order.driver_status)}`}>
                          {formatDriverStatus(order.driver_status)}
                        </span>
                        {order.pickup_proof_timestamp && (
                          <div className="order-tracking-pickup-proof-time">
                            📸 {getISTTime(order.pickup_proof_timestamp)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="order-tracking-amount">
                      {formatCurrency(order.total_amount)}
                      {order.delivery_charges && (
                        <div className="order-tracking-delivery-charge">+₹{order.delivery_charges} delivery</div>
                      )}
                    </td>
                    <td>
                      {renderPaymentStatus(order)}
                    </td>
                    <td>
                      <span className={`order-tracking-status-badge order-tracking-status-${normalizeStatus(order.status)}`}>
                        {normalizeStatus(order.status).toUpperCase()}
                      </span>
                      {order.otp && normalizeStatus(order.status) !== 'delivered' && (
                        <div className="order-tracking-otp-badge">OTP: {order.otp}</div>
                      )}
                    </td>
                    <td>
                      {formatDate(order.created_at)}
                      {order.delivery_time && (
                        <div className="order-tracking-delivery-time">
                          Deliver by: {formatDate(order.delivery_time)}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredOrders.length === 0 && (
            <div className="order-tracking-no-orders">
              <div className="order-tracking-no-orders-icon">📭</div>
              <p>
                {viewMode === 'calendar' && selectedDate
                  ? `No orders for ${getTamilNaduDay(selectedDate)}`
                  : 'No orders found'
                }
              </p>
              {(searchTerm || statusFilter !== 'all' || restaurantFilter !== 'all' || paymentMethodFilter !== 'all' || driverStatusFilter !== 'all' || driverFilter !== 'all') && (
                <button 
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setRestaurantFilter('all');
                    setPaymentMethodFilter('all');
                    setDriverStatusFilter('all');
                    setDriverFilter('all');
                  }}
                  className="order-tracking-clear-filters-btn"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Calendar Picker */}
        {showCalendar && (
          <CalendarPicker
            selectedDate={selectedDate}
            onDateSelect={handleCalendarDateSelect}
            onClose={() => setShowCalendar(false)}
          />
        )}

        {/* Order Details Modal */}
        {isModalOpen && selectedOrder && (
          <OrderModal
            order={selectedOrder}
            onClose={closeOrderDetails}
            onStatusUpdate={updateOrderStatus}
            normalizeStatus={normalizeStatus}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            onShowMap={openMapModal}
            onAssignDriver={openDriverAssignmentModal}
            onChangeRestaurant={openChangeRestaurantModal}
          />
        )}

        {/* Driver Assignment Modal */}
        {showDriverAssignmentModal && selectedOrderForAction && (
          <DriverAssignmentModal
            order={selectedOrderForAction}
            drivers={drivers}
            onClose={closeDriverAssignmentModal}
            onAssignDriver={assignDriverToOrder}
            onUnassignDriver={unassignDriverFromOrder}
          />
        )}

        {/* Change Restaurant Modal */}
        {showChangeRestaurantModal && selectedOrderForAction && (
          <ChangeRestaurantModal
            order={selectedOrderForAction}
            restaurants={restaurants}
            onClose={closeChangeRestaurantModal}
            onUpdateRestaurant={updateRestaurantForOrder}
          />
        )}

        {/* Map Modal */}
        {showMapModal && mapOrder && googleMapsLoaded && (
          <MapModal
            order={mapOrder}
            onClose={closeMapModal}
          />
        )}
      </div>
    </>
  );
};

export default OrderTracking;