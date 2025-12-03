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
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'normal', 'scheduled'
  const [driverOrders, setDriverOrders] = useState({});
  const [isMultiAssignModalOpen, setIsMultiAssignModalOpen] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [selectedOrdersMap, setSelectedOrdersMap] = useState(new Set());
  
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
        url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDNy41ODYgMiA0IDUuNTg2IDQgMTBDNCAxNC40MTQgNy41ODYgMTggMTIgMThDMTYuNDE0IDE4IDIwIDE0LjQxNCAyMCAxMEMyMCA1LjU4NiAxNi40MTQgMiAxMiAyWk0xMiAxMkMxMC44OTcgMTIgMTAgMTEuMTAzIDEwIDEwQzEwIDguODk3IDEwLjg5NyA4IDEyIDhDMTMuMTAzIDggMTQgOC44OTcgMTQgMTBDMTQgMTEuMTAzIDEzLjEwMyAxMiAxMiAxMloiIGZpbGw9IiNGRkNDMDAiLz4KPHBhdGggZD0iTTEyIDIyQzE2LjQxNCAyMiAyMCAxOC40MTQgMjAgMTRDMTQgMTQgMTIgMjIgMTIgMjJaIiBmaWxsPSIjRkZDQzAwIiBmaWxsLW9wYWNpdHk9IjAuNiIvPgo8L3N2Zz4K',
        scaledSize: new window.google.maps.Size(32, 32),
      }
    });

    const availableDrivers = drivers.filter(driver => driver.status === 'online' && driver.latitude && driver.longitude);
    const driverMarkers = [];

    availableDrivers.forEach(driver => {
      const driverMarker = new window.google.maps.Marker({
        position: { lat: driver.latitude, lng: driver.longitude },
        map: googleMap,
        title: `Driver: ${driver.driver_name} (${getDriverOrderCount(driver.id)} orders)`,
        icon: {
          url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE5IDdIMTZDMTUgNCAxMiAyIDEyIDJDMTIgMiA5IDQgOCA3SDVDMy45IDcgMyA3LjkgMyA5VjE4QzMgMTkuMSAzLjkgMjAgNSAyMEgxOUMxMC4xIDIwIDIxIDE5LjEgMjEgMThWOUMyMSA3LjkgMjAuMSA3IDE5IDdaTTggMTguNUM3LjIgMTguNSA2LjUgMTcuOCA2LjUgMTdDNi41IDE2LjIgNy4yIDE1LjUgOCAxNS41QzguOCAxUy41IDkuNSAxNi4yIDkuNSAxN0M5LjUgMTcuOCA4LjggMTguNSA4IDE4LjVaTTE1LjUgMTUuNUgxMC41VjE0SDE1LjVWMTUuNVpNMTggMTguNUMxNy4yIDE4LjUgMTYuNSAxNy44IDE2LjUgMTdDMTYuNSAxNi4yIDE3LjIgMTUuNSAxOCAxNS41QzE4LjggMTUuNSAxOS41IDE2LjIgMTkuNSAxN0MxOS41IDE3LjggMTguOCAxOC41IDE4IDE4LjVaIiBmaWxsPSIjMzQ5OEZCIi8+Cjwvc3ZnPgo=',
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

  const isNormalOrder = useCallback((order) => {
    return !isScheduledOrder(order);
  }, [isScheduledOrder]);

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

  const makeCall = useCallback((phoneNumber) => {
    if (!phoneNumber) {
      alert('Phone number not available');
      return;
    }
    
    const confirmed = window.confirm(`Call ${phoneNumber}?`);
    if (confirmed) {
      window.location.href = `tel:${phoneNumber}`;
    }
  }, []);

  const sendSMS = useCallback((phoneNumber) => {
    if (!phoneNumber) {
      alert('Phone number not available');
      return;
    }
    
    const message = encodeURIComponent(`Your order has been confirmed. We will deliver it soon.`);
    window.location.href = `sms:${phoneNumber}?body=${message}`;
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
        vehicle: 'Bike',
        available: driver.status === 'online'
      }));

      setDrivers(driversWithVehicle);
      
      fetchDriverOrders(data || []);
    } catch (error) {
      console.error('Error fetching drivers:', error);
      setError('Failed to load drivers. Please try again.');
    }
  }, []);

  const fetchDriverOrders = async (driversList) => {
    try {
      const ordersByDriver = {};
      
      for (const driver of driversList) {
        const { data, error } = await supabase
          .from('orders')
          .select('id, status')
          .eq('driver_name', driver.driver_name)
          .in('status', ['processing', 'out_for_delivery', 'delivered'])
          .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        if (!error && data) {
          ordersByDriver[driver.id] = data;
        }
      }
      
      setDriverOrders(ordersByDriver);
    } catch (error) {
      console.error('Error fetching driver orders:', error);
    }
  };

  const getDriverOrderCount = useCallback((driverId) => {
    return driverOrders[driverId]?.length || 0;
  }, [driverOrders]);

  const getDriverStatusBadge = useCallback((driver) => {
    const orderCount = getDriverOrderCount(driver.id);
    const isProcessing = orderCount > 0;
    
    if (driver.status === 'offline') {
      return { text: 'Offline', className: 'status-offline', icon: '🔴' };
    }
    
    if (isProcessing) {
      return { 
        text: `Processing (${orderCount})`, 
        className: 'status-processing', 
        icon: '🟡' 
      };
    }
    
    return { text: 'Available', className: 'status-available', icon: '🟢' };
  }, [getDriverOrderCount]);

  const getPaymentMethodBadge = useCallback((paymentMethod) => {
    if (paymentMethod === 'Online Payment') {
      return { text: 'Online', className: 'payment-online', icon: '💳' };
    } else if (paymentMethod === 'Cash on Delivery') {
      return { text: 'COD', className: 'payment-cod', icon: '💰' };
    }
    return { text: paymentMethod || 'Unknown', className: 'payment-other', icon: '❓' };
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

  const toggleOrderSelection = useCallback((orderId) => {
    setSelectedOrdersMap(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  }, []);

  const openMultiAssignModal = useCallback(() => {
    const selected = Array.from(selectedOrdersMap).map(id => 
      orders.find(order => order.id === id)
    ).filter(order => order);
    
    if (selected.length === 0) {
      alert('Please select orders to assign');
      return;
    }
    
    setSelectedOrders(selected);
    setIsMultiAssignModalOpen(true);
  }, [selectedOrdersMap, orders]);

  const assignDriverToOrder = async (orderIds, driverId) => {
    if (!orderIds || !driverId) return;

    try {
      setAssigning(true);
      setError(null);
      
      const driver = drivers.find(d => d.id === parseInt(driverId));
      if (!driver) {
        throw new Error('Selected driver not found');
      }

      const ordersToAssign = orders.filter(order => orderIds.includes(order.id));
      for (const order of ordersToAssign) {
        validateOrderForAssignment(order);
      }

      const updates = orderIds.map(orderId => 
        supabase
          .from('orders')
          .update({
            driver_name: driver.driver_name,
            driver_mobile: driver.driver_phone,
            status: 'processing',
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId)
          .eq('status', orders.find(o => o.id === orderId)?.status)
          .is('driver_name', null)
      );

      const results = await Promise.all(updates);
      
      const hasError = results.some(result => result.error);
      if (hasError) {
        throw new Error('Failed to assign some orders');
      }

      setOrders(prev => prev.filter(order => !orderIds.includes(order.id)));
      setSelectedOrdersMap(new Set());
      
      if (selectedOrder) {
        setIsModalOpen(false);
        setSelectedOrder(null);
      }
      if (selectedOrders.length > 0) {
        setIsMultiAssignModalOpen(false);
        setSelectedOrders([]);
      }
      setSelectedDriver('');
      
      fetchDriverOrders(drivers);
      
      alert(`Successfully assigned ${orderIds.length} order(s) to ${driver.driver_name}!`);
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

  const assignDriverToSingleOrder = async () => {
    if (!selectedOrder || !selectedDriver) return;
    await assignDriverToOrder([selectedOrder.id], selectedDriver);
  };

  const assignDriverToMultipleOrders = async () => {
    if (!selectedDriver || selectedOrders.length === 0) return;
    const orderIds = selectedOrders.map(order => order.id);
    await assignDriverToOrder(orderIds, selectedDriver);
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

  const closeMultiAssignModal = useCallback(() => {
    setIsMultiAssignModalOpen(false);
    setSelectedOrders([]);
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
    
    // Apply tab filter
    if (activeTab === 'normal') {
      filtered = filtered.filter(order => isNormalOrder(order));
    } else if (activeTab === 'scheduled') {
      filtered = filtered.filter(order => isScheduledOrder(order));
    }
    // 'all' shows all orders

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(order => {
        return (
          order.customer_name?.toLowerCase().includes(searchLower) ||
          order.customer_phone?.includes(searchTerm) ||
          order.id?.toString().includes(searchTerm) ||
          order.delivery_address?.toLowerCase().includes(searchLower) ||
          order.payment_method?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Sort orders
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
  }, [orders, searchTerm, activeTab, isScheduledOrder, isNormalOrder]);

  const allDrivers = useMemo(() => 
    drivers.map(driver => ({
      ...driver,
      orderCount: getDriverOrderCount(driver.id),
      statusBadge: getDriverStatusBadge(driver)
    })).sort((a, b) => {
      if (a.status === 'online' && b.status !== 'online') return -1;
      if (a.status !== 'online' && b.status === 'online') return 1;
      return a.orderCount - b.orderCount;
    }), 
    [drivers, getDriverOrderCount, getDriverStatusBadge]
  );

  const availableDrivers = useMemo(() => 
    allDrivers.filter(driver => driver.status === 'online'), 
    [allDrivers]
  );

  const stats = useMemo(() => {
    const scheduledOrders = orders.filter(o => isScheduledOrder(o)).length;
    const normalOrders = orders.filter(o => isNormalOrder(o)).length;
    const selectedCount = selectedOrdersMap.size;
    const onlinePayments = orders.filter(o => o.payment_method === 'Online Payment').length;
    const codPayments = orders.filter(o => o.payment_method === 'Cash on Delivery').length;

    return {
      total: orders.length,
      normalOrders,
      scheduledOrders,
      availableDrivers: availableDrivers.length,
      selectedCount,
      onlinePayments,
      codPayments
    };
  }, [orders, availableDrivers.length, isScheduledOrder, isNormalOrder, selectedOrdersMap]);

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
        return { text: 'Paid Online', className: 'status-paid-online', icon: '💳' };
      }
      if (status === 'confirmed') {
        return { text: 'Confirmed', className: 'status-confirmed', icon: '✅' };
      }
      return { text: status, className: `status-${status}`, icon: '📦' };
    };

    const statusInfo = getStatusDisplay();
    
    return (
      <span className={`status-badge ${statusInfo.className}`}>
        {statusInfo.icon} {statusInfo.text}
      </span>
    );
  };

  const PaymentMethodBadge = ({ paymentMethod }) => {
    const paymentInfo = getPaymentMethodBadge(paymentMethod);
    
    return (
      <span className={`payment-badge ${paymentInfo.className}`}>
        {paymentInfo.icon} {paymentInfo.text}
      </span>
    );
  };

  useEffect(() => {
    console.log('🚀 INITIALIZING ORDER ASSIGN COMPONENT');
    
    fetchDrivers();
    fetchOrders();

    pollingRef.current = setInterval(() => {
      fetchOrders();
      fetchDrivers();
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
      closeMultiAssignModal();
    }
  }, [closeModal, closeLocationModal, closeMultiAssignModal]);

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
                {stats.selectedCount > 0 && (
                  <button 
                    className="btn-primary multi-assign-btn"
                    onClick={openMultiAssignModal}
                  >
                    <span className="btn-icon">👥</span>
                    Assign {stats.selectedCount} Orders
                  </button>
                )}
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
              <span className="driver-count">{allDrivers.length}</span>
              <span>Total Drivers ({availableDrivers.length} available)</span>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="stats-section">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">📦</div>
              <div className="stat-content">
                <h3>All Orders</h3>
                <span className="stat-number">{stats.total}</span>
                <p>All pending orders</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🚚</div>
              <div className="stat-content">
                <h3>Normal Orders</h3>
                <span className="stat-number">{stats.normalOrders}</span>
                <p>Immediate delivery</p>
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
            <div className="stat-card">
              <div className="stat-icon">💳</div>
              <div className="stat-content">
                <h3>Online Payments</h3>
                <span className="stat-number">{stats.onlinePayments}</span>
                <p>Prepaid orders</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">💰</div>
              <div className="stat-content">
                <h3>COD Orders</h3>
                <span className="stat-number">{stats.codPayments}</span>
                <p>Cash on delivery</p>
              </div>
            </div>
            {stats.selectedCount > 0 && (
              <div className="stat-card selected-orders">
                <div className="stat-icon">✓</div>
                <div className="stat-content">
                  <h3>Selected Orders</h3>
                  <span className="stat-number">{stats.selectedCount}</span>
                  <p>Ready for bulk assignment</p>
                </div>
              </div>
            )}
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
              className={`tab-btn ${activeTab === 'normal' ? 'active' : ''}`}
              onClick={() => setActiveTab('normal')}
            >
              Normal Orders ({stats.normalOrders})
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
                    <th style={{ width: '50px' }}>
                      <input 
                        type="checkbox"
                        checked={filteredOrders.length > 0 && filteredOrders.every(order => selectedOrdersMap.has(order.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const allIds = filteredOrders.map(order => order.id);
                            setSelectedOrdersMap(new Set(allIds));
                          } else {
                            setSelectedOrdersMap(new Set());
                          }
                        }}
                        className="bulk-select-checkbox"
                      />
                    </th>
                    <th>Order Info</th>
                    <th>Customer</th>
                    <th>Contact</th>
                    <th>Items</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Payment</th>
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
                    const isSelected = selectedOrdersMap.has(order.id);
                    
                    return (
                      <tr key={order.id} className={`order-row ${isScheduled ? 'scheduled-order' : ''} ${isSelected ? 'selected-row' : ''}`}>
                        <td className="order-select">
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOrderSelection(order.id)}
                            className="order-checkbox"
                          />
                        </td>
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
                        
                        <td className="customer-contact">
                          <div className="contact-buttons">
                            <button 
                              className="btn-call"
                              onClick={() => makeCall(order.customer_phone)}
                              title="Call customer"
                            >
                              📞 Call
                            </button>
                            <button 
                              className="btn-sms"
                              onClick={() => sendSMS(order.customer_phone)}
                              title="Send SMS"
                            >
                              💬 SMS
                            </button>
                            <div className="phone-display">
                              {order.customer_phone}
                            </div>
                          </div>
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

                        <td className="payment-method">
                          <PaymentMethodBadge paymentMethod={order.payment_method} />
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

        {/* Assign Driver Modal (Single Order) */}
        {isModalOpen && selectedOrder && (
          <div className="modal-overlay" onClick={handleOverlayClick}>
            <div className="modal">
              <div className="modal-header">
                <h2>Assign Driver to Order #{selectedOrder.id}</h2>
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
                  <div className="order-header-info">
                    <h4>Order #{selectedOrder.id}</h4>
                    <div className="header-badges">
                      <OrderStatusBadge 
                        status={selectedOrder.status} 
                        paymentMethod={selectedOrder.payment_method} 
                      />
                      <PaymentMethodBadge paymentMethod={selectedOrder.payment_method} />
                    </div>
                  </div>
                  
                  <div className="customer-contact-modal">
                    <button 
                      className="btn-call-modal"
                      onClick={() => makeCall(selectedOrder.customer_phone)}
                    >
                      📞 Call Customer
                    </button>
                    <button 
                      className="btn-sms-modal"
                      onClick={() => sendSMS(selectedOrder.customer_phone)}
                    >
                      💬 Send SMS
                    </button>
                    <span className="customer-phone-modal">
                      {selectedOrder.customer_phone}
                    </span>
                  </div>
                  
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
                  
                  <div className="summary-grid">
                    <div className="summary-item">
                      <label>Customer</label>
                      <span>{selectedOrder.customer_name}</span>
                    </div>
                    <div className="summary-item">
                      <label>Payment</label>
                      <PaymentMethodBadge paymentMethod={selectedOrder.payment_method} />
                    </div>
                    <div className="summary-item">
                      <label>Age</label>
                      <span>{getOrderAge(selectedOrder.created_at)} minutes</span>
                    </div>
                    <div className="summary-item full-width">
                      <label>Address</label>
                      <span>{selectedOrder.delivery_address}</span>
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
                    {allDrivers.map(driver => {
                      const statusBadge = getDriverStatusBadge(driver);
                      return (
                        <option key={driver.id} value={driver.id} disabled={driver.status === 'offline'}>
                          {statusBadge.icon} {driver.driver_name} ({driver.driver_phone}) - 
                          {statusBadge.text} - {driver.orderCount} orders
                        </option>
                      );
                    })}
                  </select>
                  <div className="available-count">
                    {availableDrivers.length} drivers available out of {allDrivers.length} total
                  </div>
                  <div className="driver-status-info">
                    🟢 Available | 🟡 Processing | 🔴 Offline
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
                  onClick={assignDriverToSingleOrder}
                  disabled={!selectedDriver || assigning}
                >
                  {assigning ? 'Assigning...' : 'Assign Driver'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Multi-Assign Driver Modal */}
        {isMultiAssignModalOpen && selectedOrders.length > 0 && (
          <div className="modal-overlay" onClick={handleOverlayClick}>
            <div className="modal">
              <div className="modal-header">
                <h2>Assign Multiple Orders ({selectedOrders.length})</h2>
                <button 
                  className="close-btn"
                  onClick={closeMultiAssignModal}
                  disabled={assigning}
                >
                  ×
                </button>
              </div>
              
              <div className="modal-content">
                <div className="order-summary">
                  <h4>Selected Orders</h4>
                  <div className="selected-orders-list">
                    {selectedOrders.map(order => (
                      <div key={order.id} className="selected-order-item">
                        <div className="selected-order-header">
                          <div className="selected-order-id">Order #{order.id}</div>
                          <div className="selected-order-badges">
                            <OrderStatusBadge 
                              status={order.status} 
                              paymentMethod={order.payment_method} 
                            />
                            <PaymentMethodBadge paymentMethod={order.payment_method} />
                          </div>
                        </div>
                        <div className="selected-order-info">
                          <span>{order.customer_name}</span>
                          <span className="customer-phone-small">{order.customer_phone}</span>
                          <span>₹{getTotalAmount(order).toLocaleString('en-IN')}</span>
                        </div>
                        {isScheduledOrder(order) && (
                          <div className="selected-order-scheduled">
                            ⏰ {formatDeliveryTime(order.delivery_time)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <div className="total-amount-summary">
                    <div className="total-amount-row">
                      <span>Total Orders:</span>
                      <span>{selectedOrders.length}</span>
                    </div>
                    <div className="total-amount-row">
                      <span>Normal Orders:</span>
                      <span>{selectedOrders.filter(o => isNormalOrder(o)).length}</span>
                    </div>
                    <div className="total-amount-row">
                      <span>Scheduled Orders:</span>
                      <span>{selectedOrders.filter(o => isScheduledOrder(o)).length}</span>
                    </div>
                    <div className="total-amount-row">
                      <span>Online Payments:</span>
                      <span>{selectedOrders.filter(o => o.payment_method === 'Online Payment').length}</span>
                    </div>
                    <div className="total-amount-row">
                      <span>COD Orders:</span>
                      <span>{selectedOrders.filter(o => o.payment_method === 'Cash on Delivery').length}</span>
                    </div>
                    <div className="total-amount-row total-row">
                      <span>Total Amount:</span>
                      <span className="total-amount-final">
                        ₹{selectedOrders.reduce((sum, order) => sum + getTotalAmount(order), 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="driver-selection">
                  <label className="selection-label">Select Driver for all {selectedOrders.length} orders</label>
                  <select
                    value={selectedDriver}
                    onChange={(e) => setSelectedDriver(e.target.value)}
                    className="driver-select"
                    disabled={assigning}
                  >
                    <option value="">Choose a driver</option>
                    {allDrivers.map(driver => {
                      const statusBadge = getDriverStatusBadge(driver);
                      return (
                        <option key={driver.id} value={driver.id} disabled={driver.status === 'offline'}>
                          {statusBadge.icon} {driver.driver_name} ({driver.driver_phone}) - 
                          {statusBadge.text} - {driver.orderCount} orders
                        </option>
                      );
                    })}
                  </select>
                  <div className="available-count">
                    {availableDrivers.length} drivers available out of {allDrivers.length} total
                  </div>
                  <div className="driver-status-info">
                    🟢 Available | 🟡 Processing | 🔴 Offline
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
                  onClick={closeMultiAssignModal}
                  disabled={assigning}
                >
                  Cancel
                </button>
                <button
                  className="btn-confirm"
                  onClick={assignDriverToMultipleOrders}
                  disabled={!selectedDriver || assigning}
                >
                  {assigning ? 'Assigning...' : `Assign ${selectedOrders.length} Orders`}
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
                  <div className="order-header-info">
                    <h4>Order Total: ₹{getTotalAmount(selectedOrder).toLocaleString('en-IN')}</h4>
                    <div className="header-badges">
                      <OrderStatusBadge 
                        status={selectedOrder.status} 
                        paymentMethod={selectedOrder.payment_method} 
                      />
                      <PaymentMethodBadge paymentMethod={selectedOrder.payment_method} />
                    </div>
                  </div>
                  
                  <div className="customer-contact-modal">
                    <button 
                      className="btn-call-modal"
                      onClick={() => makeCall(selectedOrder.customer_phone)}
                    >
                      📞 Call Customer
                    </button>
                    <button 
                      className="btn-sms-modal"
                      onClick={() => sendSMS(selectedOrder.customer_phone)}
                    >
                      💬 Send SMS
                    </button>
                    <span className="customer-phone-modal">
                      {selectedOrder.customer_phone}
                    </span>
                  </div>
                  
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
                  <div className="customer-contact-modal">
                    <button 
                      className="btn-call-modal"
                      onClick={() => makeCall(selectedOrder.customer_phone)}
                    >
                      📞 Call Customer
                    </button>
                    <button 
                      className="btn-sms-modal"
                      onClick={() => sendSMS(selectedOrder.customer_phone)}
                    >
                      💬 Send SMS
                    </button>
                    <span className="customer-phone-modal">
                      {selectedOrder.customer_phone}
                    </span>
                  </div>
                  <p><strong>Name:</strong> {selectedOrder.customer_name}</p>
                  <p><strong>Address:</strong> {selectedOrder.delivery_address}</p>
                  <p><strong>Payment:</strong> <PaymentMethodBadge paymentMethod={selectedOrder.payment_method} /></p>
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