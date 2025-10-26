import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../../supabase';
import './OrderAssign.css';
import Navbar from '../Navbar/Navbar';

const OrderAssign = () => {
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isItemsModalOpen, setIsItemsModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [lastChecked, setLastChecked] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  
  const audioRef = useRef(null);
  const pollingRef = useRef(null);
  const isFirstLoadRef = useRef(true);
  const soundTimeoutRef = useRef(null);
  const mapRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  const GOOGLE_MAPS_API_KEY = "AIzaSyCwunFlQtMKPeJ2chyXPm1AKF07SvvqUX0";

  const loadGoogleMaps = useCallback(() => {
    if (window.google && window.google.maps) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry`;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }, [GOOGLE_MAPS_API_KEY]);

  const initMap = useCallback((order) => {
    if (!mapRef.current || !order.customer_lat || !order.customer_lon) return;

    const customerLocation = {
      lat: order.customer_lat,
      lng: order.customer_lon
    };

    const googleMap = new window.google.maps.Map(mapRef.current, {
      zoom: 15,
      center: customerLocation,
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true,
    });

    const customerMarker = new window.google.maps.Marker({
      position: customerLocation,
      map: googleMap,
      title: `Order #${order.id} - ${order.customer_name}`,
      icon: {
        url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDNy41ODYgMiA0IDUuNTg2IDQgMTBDNCAxNC40MTQgNy41ODYgMTggMTIgMThDMTYuNDE0IDE4IDIwIDE0LjQxNCAyMCAxMEMyMCA1LjU4NiAxNi40MTQgMiAxMiAyWk0xMiAxMkMxMC44OTcgMTIgMTAgMTEuMTAzIDEwIDEwQzEwIDguODk3IDEwLjg5NyA4IDEyIDhDMTMuMTAzIDggMTQgOC44OTcgMTQgMTBDMTQgMTEuMTAzIDEzLjEwMyAxMiAxMiAxMloiIGZpbGw9IiNGRjBDMDAiLz4KPHBhdGggZD0iTTEyIDIyQzE2LjQxNCAyMiAyMCAxOC40MTQgMjAgMTRDMTQgMTQgMTIgMjIgMTIgMjJaIiBmaWxsPSIjRkYwQzAwIiBmaWxsLW9wYWNpdHk9IjAuNiIvPgo8L3N2Zz4K',
        scaledSize: new window.google.maps.Size(32, 32),
      }
    });

    const availableDrivers = drivers.filter(driver => driver.status === 'online' && driver.latitude && driver.longitude);
    const driverMarkers = [];

    availableDrivers.forEach(driver => {
      const driverMarker = new window.google.maps.Marker({
        position: { lat: driver.latitude, lng: driver.longitude },
        map: googleMap,
        title: `Driver: ${driver.driver_name}`,
        icon: {
          url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE5IDdIMTZDMTUgNCAxMiAyIDEyIDJDMTIgMiA5IDQgOCA3SDVDMy45IDcgMyA3LjkgMyA5VjE4QzMgMTkuMSAzLjkgMjAgNSAyMEgxOUMxMC4xIDIwIDIxIDE5LjEgMjEgMThWOUMyMSA3LjkgMjAuMSA3IDE5IDdaTTggMTguNUM3LjIgMTguNSA2LjUgMTcuOCA2LjUgMTdDNi41IDE2LjIgNy4yIDE1LjUgOCAxNS41QzguOCAxNS41IDkuNSAxNi4yIDkuNSAxN0M5LjUgMTcuOCA4LjggMTguNSA4IDE4LjVaTTE1LjUgMTUuNUgxMC41VjE0SDE1LjVWMTUuNVpNMTggMTguNUMxNy4yIDE4LjUgMTYuNSAxNy44IDE2LjUgMTdDMTYuNSAxNi4yIDE3LjIgMTUuNSAxOCAxNS41QzE4LjggMTUuNSAxOS41IDE2LjIgMTkuNSAxN0MxOS41IDE3LjggMTguOCAxOC41IDE4IDE4LjVaIiBmaWxsPSIjMzQ5OEZCIi8+Cjwvc3ZnPgo=',
          scaledSize: new window.google.maps.Size(28, 28),
        }
      });

      driverMarkers.push(driverMarker);
    });

    setMap(googleMap);
    setMarkers([customerMarker, ...driverMarkers]);

  }, [drivers]);

  const cleanupMap = useCallback(() => {
    if (markers.length > 0) {
      markers.forEach(marker => marker.setMap(null));
    }
    setMarkers([]);
    setMap(null);
  }, [markers]);

  const openLocationModal = useCallback(async (order) => {
    if (!order.customer_lat || !order.customer_lon) {
      alert('Location data not available for this order');
      return;
    }

    try {
      setSelectedOrder(order);
      setIsLocationModalOpen(true);
      
      await loadGoogleMaps();
      
      setTimeout(() => {
        if (mapRef.current) {
          initMap(order);
        }
      }, 100);
    } catch (error) {
      console.error('Error loading Google Maps:', error);
      setError('Failed to load map. Please try again.');
    }
  }, [loadGoogleMaps, initMap]);

  const closeLocationModal = useCallback(() => {
    cleanupMap();
    setIsLocationModalOpen(false);
    setSelectedOrder(null);
  }, [cleanupMap]);

  const playNotificationSound = useCallback((orderCount = 1) => {
    if (!isAudioEnabled) return;
    
    try {
      if (audioRef.current) {
        audioRef.current.volume = 1.0;
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(console.log);
      }
    } catch (error) {
      console.log('Audio error:', error);
    }
  }, [isAudioEnabled]);

  const parseItems = useCallback((items) => {
    try {
      if (typeof items === 'string') {
        return JSON.parse(items);
      }
      return items || [];
    } catch (error) {
      return [];
    }
  }, []);

  const shouldShowOrder = useCallback((order) => {
    if (order.status === 'cancelled') {
      return false;
    }

    const hasDriverName = order.driver_name && order.driver_name.trim() !== '';
    const hasDriverMobile = order.driver_mobile && order.driver_mobile.trim() !== '';
    
    if (hasDriverName || hasDriverMobile) {
      return false;
    }

    if (order.status === 'paid' && order.payment_method !== 'Online Payment') {
      return false;
    }

    return order.status === 'confirmed' || order.status === 'paid';
  }, []);

  const getDisplayName = useCallback((item) => {
    if (item.restaurant_name) {
      return item.restaurant_name;
    }
    if (item.product_name) {
      return item.product_name;
    }
    return 'Unknown Item';
  }, []);

  const validateOrderForAssignment = useCallback((order) => {
    if (!['confirmed', 'paid'].includes(order.status)) {
      throw new Error('Order is not in assignable status');
    }
    
    const hasDriverName = order.driver_name && order.driver_name.trim() !== '';
    const hasDriverMobile = order.driver_mobile && order.driver_mobile.trim() !== '';
    
    if (hasDriverName || hasDriverMobile) {
      throw new Error('Order already has a driver assigned');
    }

    if (order.status === 'paid' && order.payment_method !== 'Online Payment') {
      throw new Error('Paid orders must be online payments');
    }
  }, []);

  const isScheduledOrder = useCallback((order) => {
    return order.delivery_time && new Date(order.delivery_time) > new Date();
  }, []);

  const formatDeliveryTime = useCallback((deliveryTime) => {
    if (!deliveryTime) return null;
    
    const deliveryDate = new Date(deliveryTime);
    const now = new Date();
    const isToday = deliveryDate.toDateString() === now.toDateString();
    
    if (isToday) {
      return deliveryDate.toLocaleString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } else {
      return deliveryDate.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    }
  }, []);

  const getTimeUntilDelivery = useCallback((deliveryTime) => {
    if (!deliveryTime) return null;
    
    const deliveryDate = new Date(deliveryTime);
    const now = new Date();
    const diffMs = deliveryDate - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    } else {
      return `${diffMinutes}m`;
    }
  }, []);

  const fetchDrivers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('driver')
        .select('*')
        .order('driver_name', { ascending: true });

      if (error) throw error;

      const driversWithVehicle = (data || []).map(driver => ({
        ...driver,
        // Add vehicle type based on your business logic
        vehicle: 'Bike', // Default to Bike, you can modify this based on your data
        available: driver.status === 'online'
      }));

      setDrivers(driversWithVehicle);
    } catch (error) {
      console.error('Error fetching drivers:', error);
      setError('Failed to load drivers. Please try again.');
    }
  }, []);

  const fetchOrders = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setLoading(true);
      }
      
      setError(null);

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['confirmed', 'paid'])
        .or('driver_name.is.null,driver_name.eq.""')
        .or('driver_mobile.is.null,driver_mobile.eq.""')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const filteredData = (data || []).filter(order => {
        const hasDriverName = order.driver_name && order.driver_name.trim() !== '';
        const hasDriverMobile = order.driver_mobile && order.driver_mobile.trim() !== '';
        
        if (hasDriverName || hasDriverMobile) {
          return false;
        }
        
        if (order.status === 'paid' && order.payment_method !== 'Online Payment') {
          return false;
        }
        
        return shouldShowOrder(order);
      });
      
      setOrders(prevOrders => {
        const previousOrderIds = new Set(prevOrders.map(order => order.id));
        const newOrders = filteredData.filter(order => !previousOrderIds.has(order.id));
        
        if (newOrders.length > 0 && !isFirstLoadRef.current && !isManualRefresh) {
          console.log(`New orders: ${newOrders.length}`);
          playNotificationSound(Math.min(newOrders.length, 2));
        }
        
        if (isFirstLoadRef.current) {
          isFirstLoadRef.current = false;
        }
        
        return filteredData;
      });

      setLastChecked(new Date());
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError('Failed to load orders. Please try again.');
    } finally {
      if (isManualRefresh) {
        setLoading(false);
      }
    }
  }, [shouldShowOrder, playNotificationSound]);

  const testSound = useCallback(() => {
    if (!isAudioEnabled) return;
    playNotificationSound(1);
  }, [playNotificationSound, isAudioEnabled]);

  const toggleAudio = useCallback(() => {
    setIsAudioEnabled(prev => !prev);
  }, []);

  const handleSearch = useCallback((value) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      setSearchTerm(value);
    }, 400);
  }, []);

  const assignDriverToOrder = async () => {
    if (!selectedOrder || !selectedDriver) return;

    try {
      setAssigning(true);
      setError(null);
      
      validateOrderForAssignment(selectedOrder);
      
      const driver = drivers.find(d => d.id === parseInt(selectedDriver));
      if (!driver) {
        throw new Error('Selected driver not found');
      }
      
      const { error } = await supabase
        .from('orders')
        .update({
          driver_name: driver.driver_name,
          driver_mobile: driver.driver_phone,
          status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedOrder.id)
        .eq('status', selectedOrder.status)
        .is('driver_name', null);

      if (error) throw error;

      setOrders(prev => prev.filter(order => order.id !== selectedOrder.id));
      setIsModalOpen(false);
      setSelectedOrder(null);
      setSelectedDriver('');
      
      alert(`Order #${selectedOrder.id} assigned to ${driver.driver_name} successfully!`);
    } catch (error) {
      console.error('Error assigning driver:', error);
      setError(error.message || 'Failed to assign driver. Please try again.');
      
      if (error.message.includes('concurrently') || error.message.includes('not available')) {
        fetchOrders(true);
      }
    } finally {
      setAssigning(false);
    }
  };

  const cancelOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to cancel this order?')) {
      return;
    }

    try {
      setError(null);
      
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      setOrders(prev => prev.filter(order => order.id !== orderId));
      alert('Order cancelled successfully');
    } catch (error) {
      console.error('Error cancelling order:', error);
      setError('Failed to cancel order. Please try again.');
    }
  };

  const openAssignModal = useCallback((order) => {
    setSelectedOrder(order);
    setSelectedDriver('');
    setIsModalOpen(true);
  }, []);

  const openItemsModal = useCallback((order) => {
    setSelectedOrder(order);
    setIsItemsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setIsItemsModalOpen(false);
    setSelectedOrder(null);
    setSelectedDriver('');
  }, []);

  const getOrderItems = useCallback((order) => {
    return parseItems(order.items);
  }, [parseItems]);

  const getItemNames = useCallback((order) => {
    const items = getOrderItems(order);
    return items.map(item => getDisplayName(item)).join(', ');
  }, [getOrderItems, getDisplayName]);

  const getTotalItemsQuantity = useCallback((items) => {
    return items.reduce((total, item) => total + (item.quantity || 1), 0);
  }, []);

  const getOrderAge = useCallback((createdAt) => {
    const created = new Date(createdAt);
    const now = new Date();
    return Math.floor((now - created) / (1000 * 60));
  }, []);

  const getSubtotal = useCallback((order) => {
    const deliveryCharges = parseFloat(order.delivery_charges) || 0;
    const totalAmount = parseFloat(order.total_amount) || 0;
    return totalAmount - deliveryCharges;
  }, []);

  const getDeliveryCharges = useCallback((order) => {
    return parseFloat(order.delivery_charges) || 0;
  }, []);

  const getTotalAmount = useCallback((order) => {
    return parseFloat(order.total_amount) || 0;
  }, []);

  const filteredOrders = useMemo(() => {
    let filtered = orders;
    
    if (activeTab === 'scheduled') {
      filtered = filtered.filter(order => isScheduledOrder(order));
    }

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(order => {
        return (
          order.customer_name?.toLowerCase().includes(searchLower) ||
          order.customer_phone?.includes(searchTerm) ||
          order.id?.toString().includes(searchTerm) ||
          order.delivery_address?.toLowerCase().includes(searchLower)
        );
      });
    }

    return filtered.sort((a, b) => {
      if (isScheduledOrder(a) && isScheduledOrder(b)) {
        return new Date(a.delivery_time) - new Date(b.delivery_time);
      } else if (isScheduledOrder(a)) {
        return -1;
      } else if (isScheduledOrder(b)) {
        return 1;
      } else {
        return new Date(a.created_at) - new Date(b.created_at);
      }
    });
  }, [orders, searchTerm, activeTab, isScheduledOrder]);

  const availableDrivers = useMemo(() => 
    drivers.filter(driver => driver.status === 'online'), 
    [drivers]
  );

  const stats = useMemo(() => {
    const scheduledOrders = orders.filter(o => isScheduledOrder(o)).length;

    return {
      total: orders.length,
      scheduledOrders,
      availableDrivers: availableDrivers.length
    };
  }, [orders, availableDrivers.length, isScheduledOrder]);

  const formatDate = useCallback((dateString) => {
    return new Date(dateString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  const OrderStatusBadge = ({ status, paymentMethod }) => {
    const getStatusDisplay = () => {
      if (status === 'paid' && paymentMethod === 'Online Payment') {
        return { text: 'Paid Online', className: 'status-paid-online' };
      }
      if (status === 'confirmed') {
        return { text: 'Confirmed', className: 'status-confirmed' };
      }
      return { text: status, className: `status-${status}` };
    };

    const statusInfo = getStatusDisplay();
    
    return (
      <span className={`status-badge ${statusInfo.className}`}>
        {statusInfo.text}
      </span>
    );
  };

  useEffect(() => {
    console.log('🚀 INITIALIZING ORDER ASSIGN COMPONENT');
    
    fetchDrivers();
    fetchOrders();

    pollingRef.current = setInterval(() => {
      fetchOrders();
      fetchDrivers(); // Also refresh drivers periodically
    }, 60000);

    return () => {
      console.log('🧹 CLEANING UP ORDER ASSIGN COMPONENT');
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      if (soundTimeoutRef.current) {
        clearTimeout(soundTimeoutRef.current);
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      cleanupMap();
    };
  }, []);

  const handleManualRefresh = useCallback(() => {
    fetchOrders(true);
    fetchDrivers();
  }, [fetchOrders, fetchDrivers]);

  const handleOverlayClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      closeModal();
      closeLocationModal();
    }
  }, [closeModal, closeLocationModal]);

  return (
    <>
      <Navbar />
      <div className="order-assign-container">
        <audio ref={audioRef} preload="auto">
          <source src="/notification.mp3" type="audio/mpeg" />
          <source src="/notification.wav" type="audio/wav" />
        </audio>

        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        {/* Header Section */}
        <div className="dashboard-header">
          <div className="header-content">
            <div className="header-title-section">
              <div className="title-with-badge">
                <h1>Order Assignment</h1>
                <span className="orders-count-badge">{stats.total}</span>
              </div>
              <p className="subtitle">Manage and assign drivers to new orders</p>
            </div>
            <div className="header-actions">
              <input
                type="text"
                placeholder="Search orders..."
                defaultValue={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="search-input"
              />
              <div className="action-buttons-header">
                <button 
                  className={`audio-toggle-btn ${isAudioEnabled ? 'enabled' : 'disabled'}`}
                  onClick={toggleAudio}
                  title={isAudioEnabled ? 'Mute notifications' : 'Unmute notifications'}
                >
                  {isAudioEnabled ? '🔊' : '🔇'}
                </button>
                <button 
                  className="test-sound-btn"
                  onClick={testSound}
                  title="Test notification sound"
                >
                  Test Sound
                </button>
                <button 
                  className="refresh-btn-primary"
                  onClick={handleManualRefresh}
                  disabled={loading}
                >
                  <span className="refresh-icon">🔄</span>
                  {loading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div>
          </div>
          <div className="header-footer">
            <span className="last-checked">
              Last checked: {lastChecked.toLocaleTimeString()}
            </span>
            <div className="driver-status">
              <span className="driver-count">{stats.availableDrivers}</span>
              <span>Drivers Available</span>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="stats-section">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">📦</div>
              <div className="stat-content">
                <h3>Total Orders</h3>
                <span className="stat-number">{stats.total}</span>
                <p>Waiting for assignment</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">⏰</div>
              <div className="stat-content">
                <h3>Scheduled Orders</h3>
                <span className="stat-number">{stats.scheduledOrders}</span>
                <p>Future deliveries</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🚗</div>
              <div className="stat-content">
                <h3>Available Drivers</h3>
                <span className="stat-number">{stats.availableDrivers}</span>
                <p>Ready for assignment</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Orders Table Section */}
        <div className="orders-main-section">
          <div className="section-tabs">
            <button 
              className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All Orders ({stats.total})
            </button>
            <button 
              className={`tab-btn ${activeTab === 'scheduled' ? 'active' : ''}`}
              onClick={() => setActiveTab('scheduled')}
            >
              Scheduled ({stats.scheduledOrders})
            </button>
          </div>

          <div className="orders-table-container">
            {loading && filteredOrders.length === 0 ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Loading new orders...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📦</div>
                <h3>No orders found</h3>
                <p>New confirmed orders will appear here automatically.</p>
              </div>
            ) : (
              <table className="orders-table">
                <thead className="orders-table-header">
                  <tr>
                    <th>Order Info</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody className="orders-table-body">
                  {filteredOrders.map((order) => {
                    const items = getOrderItems(order);
                    const orderAge = getOrderAge(order.created_at);
                    const totalItems = getTotalItemsQuantity(items);
                    const hasLocation = order.customer_lat && order.customer_lon;
                    const deliveryCharges = getDeliveryCharges(order);
                    const subtotal = getSubtotal(order);
                    const totalAmount = getTotalAmount(order);
                    const isScheduled = isScheduledOrder(order);
                    const deliveryTimeDisplay = formatDeliveryTime(order.delivery_time);
                    const timeUntilDelivery = getTimeUntilDelivery(order.delivery_time);
                    
                    return (
                      <tr key={order.id} className={`order-row ${isScheduled ? 'scheduled-order' : ''}`}>
                        <td className="order-info">
                          <div className="order-id">#{order.id}</div>
                          <div className="order-receipt">{order.receipt_reference}</div>
                          <div className="order-date">{formatDate(order.created_at)}</div>
                          {isScheduled && (
                            <div className="scheduled-badge">
                              <span className="scheduled-icon">⏰</span>
                              Scheduled
                            </div>
                          )}
                        </td>
                        
                        <td className="customer-info">
                          <div className="customer-name">{order.customer_name}</div>
                          <div className="customer-phone">{order.customer_phone}</div>
                          <div className="customer-address">{order.delivery_address}</div>
                          {isScheduled && deliveryTimeDisplay && (
                            <div className="delivery-time-info">
                              <div className="delivery-time">
                                <strong>Delivery:</strong> {deliveryTimeDisplay}
                              </div>
                              {timeUntilDelivery && (
                                <div className="time-until-delivery">
                                  <strong>In:</strong> {timeUntilDelivery}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        
                        <td className="order-items">
                          <div className="items-count">{totalItems} items</div>
                          <div className="items-list-preview" title={getItemNames(order)}>
                            {getItemNames(order)}
                          </div>
                        </td>
                        
                        <td className="order-amount">
                          <div className="amount-breakdown">
                            <div className="amount-row">
                              <span className="amount-label">Order:</span>
                              <span className="amount-value">₹{subtotal.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="amount-row delivery-row">
                              <span className="amount-label">🚚 Delivery:</span>
                              <span className="amount-value delivery-charge">
                                + ₹{deliveryCharges.toLocaleString('en-IN')}
                              </span>
                            </div>
                            <div className="amount-row">
                              <span className="amount-label">Total:</span>
                              <span className="amount-value total-amount">
                                ₹{totalAmount.toLocaleString('en-IN')}
                              </span>
                            </div>
                          </div>
                        </td>
                        
                        <td className="order-status">
                          <div className="order-age">{orderAge}m ago</div>
                          <OrderStatusBadge 
                            status={order.status} 
                            paymentMethod={order.payment_method} 
                          />
                          {isScheduled && timeUntilDelivery && (
                            <div className="delivery-countdown">
                              ⏱️ {timeUntilDelivery}
                            </div>
                          )}
                        </td>
                        
                        <td className="order-actions">
                          <button
                            className="btn-primary"
                            onClick={() => openAssignModal(order)}
                            disabled={assigning}
                          >
                            <span className="btn-icon">👤</span>
                            Assign Driver
                          </button>
                          <button
                            className="btn-secondary"
                            onClick={() => openItemsModal(order)}
                          >
                            <span className="btn-icon">📦</span>
                            Items
                          </button>
                          {hasLocation && (
                            <button
                              className="btn-secondary"
                              onClick={() => openLocationModal(order)}
                            >
                              <span className="btn-icon">📍</span>
                              Map
                            </button>
                          )}
                          <button
                            className="btn-danger"
                            onClick={() => cancelOrder(order.id)}
                            disabled={assigning}
                          >
                            <span className="btn-icon">×</span>
                            Cancel
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Assign Driver Modal */}
        {isModalOpen && (
          <div className="modal-overlay" onClick={handleOverlayClick}>
            <div className="modal">
              <div className="modal-header">
                <h2>Assign Driver</h2>
                <button 
                  className="close-btn"
                  onClick={closeModal}
                  disabled={assigning}
                >
                  ×
                </button>
              </div>
              
              <div className="modal-content">
                <div className="order-summary">
                  <h4>Order #{selectedOrder?.id}</h4>
                  {isScheduledOrder(selectedOrder) && (
                    <div className="scheduled-order-alert">
                      <span className="scheduled-icon-large">⏰</span>
                      <div>
                        <strong>Scheduled Order</strong>
                        <p>Delivery Time: {formatDeliveryTime(selectedOrder?.delivery_time)}</p>
                        <p>Time Until Delivery: {getTimeUntilDelivery(selectedOrder?.delivery_time)}</p>
                      </div>
                    </div>
                  )}
                  <div className="summary-grid">
                    <div className="summary-item">
                      <label>Customer</label>
                      <span>{selectedOrder?.customer_name}</span>
                    </div>
                    <div className="summary-item">
                      <label>Phone</label>
                      <span>{selectedOrder?.customer_phone}</span>
                    </div>
                    <div className="summary-item full-width">
                      <label>Address</label>
                      <span>{selectedOrder?.delivery_address}</span>
                    </div>
                    
                    <div className="summary-item full-width">
                      <label>Amount Breakdown</label>
                      <div className="modal-amount-breakdown">
                        <div className="modal-breakdown-row">
                          <span>Order Value:</span>
                          <span>₹{getSubtotal(selectedOrder).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="modal-breakdown-row delivery-row">
                          <span>
                            <span className="delivery-icon">🚚</span>
                            Delivery Fee:
                          </span>
                          <span className="delivery-charge-amount">
                            + ₹{getDeliveryCharges(selectedOrder).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="modal-breakdown-row total-row">
                          <span>Total Amount:</span>
                          <span className="total-amount-final">
                            ₹{getTotalAmount(selectedOrder).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="summary-item">
                      <label>Age</label>
                      <span>{getOrderAge(selectedOrder?.created_at)} minutes</span>
                    </div>
                  </div>
                </div>

                <div className="driver-selection">
                  <label className="selection-label">Select Driver</label>
                  <select
                    value={selectedDriver}
                    onChange={(e) => setSelectedDriver(e.target.value)}
                    className="driver-select"
                    disabled={assigning}
                  >
                    <option value="">Choose a driver</option>
                    {availableDrivers.map(driver => (
                      <option key={driver.id} value={driver.id}>
                        {driver.driver_name} ({driver.driver_phone}) - {driver.vehicle}
                      </option>
                    ))}
                  </select>
                  <div className="available-count">
                    {availableDrivers.length} drivers available
                  </div>
                </div>

                {availableDrivers.length === 0 && (
                  <div className="warning-message">
                    ⚠️ No drivers available at the moment
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button
                  className="btn-cancel"
                  onClick={closeModal}
                  disabled={assigning}
                >
                  Cancel
                </button>
                <button
                  className="btn-confirm"
                  onClick={assignDriverToOrder}
                  disabled={!selectedDriver || assigning}
                >
                  {assigning ? 'Assigning...' : 'Assign Driver'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Items Modal */}
        {isItemsModalOpen && selectedOrder && (
          <div className="modal-overlay" onClick={handleOverlayClick}>
            <div className="modal">
              <div className="modal-header">
                <h2>Order Items - #{selectedOrder.id}</h2>
                <button 
                  className="close-btn"
                  onClick={closeModal}
                >
                  ×
                </button>
              </div>
              
              <div className="modal-content">
                <div className="order-summary">
                  <h4>Order Total: ₹{getTotalAmount(selectedOrder).toLocaleString('en-IN')}</h4>
                  {isScheduledOrder(selectedOrder) && (
                    <div className="scheduled-order-alert">
                      <span className="scheduled-icon-large">⏰</span>
                      <div>
                        <strong>Scheduled Order</strong>
                        <p>Delivery Time: {formatDeliveryTime(selectedOrder.delivery_time)}</p>
                        <p>Time Until Delivery: {getTimeUntilDelivery(selectedOrder.delivery_time)}</p>
                      </div>
                    </div>
                  )}
                  <div className="modal-amount-breakdown">
                    <div className="modal-breakdown-row">
                      <span>Order Value:</span>
                      <span>₹{getSubtotal(selectedOrder).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="modal-breakdown-row delivery-row">
                      <span>Delivery Fee:</span>
                      <span className="delivery-charge-amount">
                        ₹{getDeliveryCharges(selectedOrder).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="modal-breakdown-row total-row">
                      <span>Total Amount:</span>
                      <span className="total-amount-final">
                        ₹{getTotalAmount(selectedOrder).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="items-list">
                  {getOrderItems(selectedOrder).map((item, index) => (
                    <div key={index} className="item-card">
                      <div className="item-header">
                        <span className="item-name">{getDisplayName(item)}</span>
                        <span className="item-quantity">Qty: {item.quantity || 1}</span>
                      </div>
                      {item.product_name && item.product_name !== getDisplayName(item) && (
                        <div className="item-detail">
                          <span>Product:</span>
                          <span>{item.product_name}</span>
                        </div>
                      )}
                      {item.variants && (
                        <div className="item-detail">
                          <span>Variants:</span>
                          <span>{item.variants}</span>
                        </div>
                      )}
                      {item.price && (
                        <div className="item-price">
                          ₹{parseFloat(item.price || 0).toLocaleString('en-IN')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  className="btn-cancel"
                  onClick={closeModal}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Location Map Modal */}
        {isLocationModalOpen && selectedOrder && (
          <div className="modal-overlay" onClick={handleOverlayClick}>
            <div className="modal">
              <div className="modal-header">
                <h2>Order Location - #{selectedOrder.id}</h2>
                <button 
                  className="close-btn"
                  onClick={closeLocationModal}
                >
                  ×
                </button>
              </div>
              
              <div className="modal-content">
                <div className="map-container">
                  <div 
                    ref={mapRef} 
                    className="map"
                    style={{ height: '300px', width: '100%', borderRadius: '8px' }}
                  >
                    <div className="map-loading">
                      Loading map...
                    </div>
                  </div>
                </div>

                <div className="location-details">
                  <h4>Customer Location</h4>
                  <p><strong>Name:</strong> {selectedOrder.customer_name}</p>
                  <p><strong>Address:</strong> {selectedOrder.delivery_address}</p>
                  {isScheduledOrder(selectedOrder) && (
                    <>
                      <p><strong>Delivery Time:</strong> {formatDeliveryTime(selectedOrder.delivery_time)}</p>
                      <p><strong>Time Until Delivery:</strong> {getTimeUntilDelivery(selectedOrder.delivery_time)}</p>
                    </>
                  )}
                  <div className="delivery-fee-display">
                    <strong>Delivery Fee:</strong> 
                    <span className="delivery-fee-amount">
                      ₹{getDeliveryCharges(selectedOrder).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  className="btn-cancel"
                  onClick={closeLocationModal}
                >
                  Close
                </button>
                <button
                  className="btn-confirm"
                  onClick={() => {
                    closeLocationModal();
                    openAssignModal(selectedOrder);
                  }}
                >
                  Assign Driver
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default OrderAssign;