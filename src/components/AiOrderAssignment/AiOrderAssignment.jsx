import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../supabase';
import Navbar from '../Navbar/Navbar';
import './AiOrderAssignment.css';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const AiOrderAssignment = () => {
    const [orders, setOrders] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [restaurants, setRestaurants] = useState([]); // Add restaurants state
    const [loading, setLoading] = useState(true);
    const [isAutoMode, setIsAutoMode] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [assignmentStatus, setAssignmentStatus] = useState(null);
    const [processingOrders, setProcessingOrders] = useState(new Set());
    const isFirstLoadRef = useRef(true);
    const audioRef = useRef(null);

    // Fetch Restaurants (for coordinates)
    const fetchRestaurants = async () => {
        try {
            const { data, error } = await supabase
                .from('restaurants')
                .select('*');
            if (error) throw error;
            setRestaurants(data || []);
        } catch (error) {
            // console.error('Error fetching restaurants:', error);
            // Non-blocking error if table doesn't exist yet
        }
    };

    // Fetch Orders based on Active Tab
    const fetchUnassignedOrders = async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            let query = supabase
                .from('orders')
                .select('*')
                .or('driver_name.is.null,driver_name.eq.""')
                .or('driver_mobile.is.null,driver_mobile.eq.""')
                .in('status', ['confirmed', 'paid', 'processing', 'prepared', 'ready_for_pickup'])
                .neq('status', 'cancelled')
                .neq('status', 'delivered');

            query = query.order('created_at', { ascending: false });

            const { data, error } = await query;
            if (error) throw error;

            // Notification sound logic (same as ManualOrderAssign)
            if (data && data.length > 0 && !isFirstLoadRef.current) {
                const previousOrderIds = new Set(orders.map(o => o.id));
                const newOrders = data.filter(order => !previousOrderIds.has(order.id));

                if (newOrders.length > 0) {
                    console.log(`🆕 ${newOrders.length} new orders detected`);
                    playSuccessSound();
                }
            }

            if (isFirstLoadRef.current && data) {
                isFirstLoadRef.current = false;
            }

            setOrders(data || []);
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    // Fetch Online Drivers
    const fetchDrivers = async () => {
        try {
            // Fetch online drivers
            const { data: onlineDrivers, error: driverError } = await supabase
                .from('driver')
                .select('*')
                .eq('status', 'online')
                .order('last_active', { ascending: false });

            if (driverError) throw driverError;

            // Fetch active orders to determine which drivers are busy
            const { data: activeOrders, error: orderError } = await supabase
                .from('orders')
                .select('driver_name')
                .in('status', ['confirmed', 'paid', 'processing', 'prepared', 'ready_for_pickup', 'shipped'])
                .not('driver_name', 'is', null);

            if (orderError) throw orderError;

            // Count active orders per driver
            const orderCounts = {};
            activeOrders.forEach(order => {
                if (order.driver_name) {
                    orderCounts[order.driver_name] = (orderCounts[order.driver_name] || 0) + 1;
                }
            });

            // Map counts back to online drivers
            const processedDrivers = (onlineDrivers || []).map(driver => ({
                ...driver,
                activeOrderCount: orderCounts[driver.driver_name] || 0
            }));

            setDrivers(processedDrivers);
        } catch (error) {
            console.error('Error fetching drivers:', error);
        }
    };

    useEffect(() => {
        fetchUnassignedOrders();
        fetchDrivers();
        fetchRestaurants();

        // Interval to check orders every 5 seconds
        const intervalId = setInterval(() => {
            fetchUnassignedOrders(false); // Silent fetch
            fetchDrivers(); // Also refresh drivers
        }, 5000);

        // Subscribe to changes
        const orderSub = supabase
            .channel('assignment-orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchUnassignedOrders(false))
            .subscribe();

        const driverSub = supabase
            .channel('assignment-drivers')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'driver' }, fetchDrivers)
            .subscribe();

        return () => {
            clearInterval(intervalId);
            orderSub.unsubscribe();
            driverSub.unsubscribe();
        };
    }, []); // Removed activeTab dependency

    // Calculate distance details for a specific order against all drivers
    const getDriversWithDistance = (order) => {
        if (!order || !order.restaurant_name) return drivers;

        // Find the restaurant for this order
        const restaurant = restaurants.find(r => r.name === order.restaurant_name);

        // Use Restaurant coordinates if available, otherwise fallback to Customer coordinates
        const targetLat = restaurant?.latitude || order.customer_lat;
        const targetLon = restaurant?.longitude || order.customer_lon;

        return drivers.map(driver => {
            const dist = calculateDistance(
                driver.latitude,
                driver.longitude,
                targetLat,
                targetLon
            );
            return { ...driver, distance: dist };
        }).sort((a, b) => a.distance - b.distance);
    };

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        if (!lat1 || !lon1 || !lat2 || !lon2) return 9999;
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return parseFloat((R * c).toFixed(2));
    };

    const playSuccessSound = () => {
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(e => console.error('Audio play failed', e));
        }
    };

    const assignDriver = async (orderId, driver, silent = false) => {
        try {
            const { error } = await supabase
                .from('orders')
                .update({
                    driver_name: driver.driver_name,
                    driver_mobile: driver.driver_phone,
                    driver_status: 'order_placed',
                    status: 'processing',
                    updated_at: new Date().toISOString()
                })
                .eq('id', orderId);

            if (error) throw error;

            playSuccessSound();

            // UI feedback
            if (!silent) setSelectedOrder(null);
            setAssignmentStatus(`Assigned ${driver.driver_name} to order #${orderId}`);
            setTimeout(() => setAssignmentStatus(null), 3000);
        } catch (err) {
            console.error('Assignment failed', err);
            if (!silent) alert('Failed to assign driver');
        }
    };

    // Auto-Assignment Loop
    useEffect(() => {
        if (!isAutoMode || orders.length === 0 || drivers.length === 0) return;

        const autoAssignLoop = async () => {
            for (const order of orders) {
                // Skip if already processing
                if (processingOrders.has(order.id)) continue;

                const allDrivers = getDriversWithDistance(order);
                if (allDrivers.length > 0) {
                    // 1. Try to find the closest driver with 0 active orders
                    const freeDrivers = allDrivers.filter(d => (d.activeOrderCount || 0) === 0);

                    let targetDriver = null;
                    if (freeDrivers.length > 0) {
                        targetDriver = freeDrivers[0]; // Closest among the free ones
                        console.log(`Auto-Pilot: Closest free driver found: ${targetDriver.driver_name}`);
                    } else {
                        // 2. All drivers are busy, pick a random online driver
                        const randomIndex = Math.floor(Math.random() * allDrivers.length);
                        targetDriver = allDrivers[randomIndex];
                        console.log(`Auto-Pilot: All drivers busy, picking random: ${targetDriver.driver_name}`);
                    }

                    // Mark as processing to prevent duplicate attempts
                    setProcessingOrders(prev => new Set(prev).add(order.id));

                    await assignDriver(order.id, targetDriver, true); // true = silent mode

                    // Remove from processing (though it should disappear from orders list shortly)
                    setProcessingOrders(prev => {
                        const next = new Set(prev);
                        next.delete(order.id);
                        return next;
                    });
                }
            }
        };

        autoAssignLoop();
    }, [orders, drivers, isAutoMode]); // Dependencies: if any change, re-evaluate

    const handleAutoAssign = (order) => {
        // ... (existing manual logic for button click - can keep or remove)
        const availableDrivers = getDriversWithDistance(order);
        if (availableDrivers.length > 0) {
            const bestDriver = availableDrivers[0];
            if (confirm(`Auto-Assigning ${bestDriver.driver_name} (${bestDriver.distance}km away) to Order #${order.id}?`)) {
                assignDriver(order.id, bestDriver);
            }
        } else {
            alert('No online drivers available for auto-assignment.');
        }
    };

    const handleOrderClick = (order) => {
        if (isAutoMode) {
            handleAutoAssign(order);
        } else {
            setSelectedOrder(order);
        }
    };

    return (
        <>
            <div className="order-assignment-container">
                <audio ref={audioRef} preload="auto">
                    <source src="/notification.mp3" type="audio/mpeg" />
                    <source src="/notification.wav" type="audio/wav" />
                </audio>
                <div className="assignment-header">
                    <div className="header-left">
                        <h1>Order Assignment</h1>
                    </div>

                    <div className="assignment-mode-toggle">
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={isAutoMode}
                                onChange={() => {
                                    setIsAutoMode(!isAutoMode);
                                    setSelectedOrder(null);
                                }}
                            />
                            <span className="slider round"></span>
                        </label>
                        <span className={isAutoMode ? 'active' : ''}>Auto-Pilot 🚀</span>
                    </div>
                </div>

                {assignmentStatus && <div className="assignment-feedback success">{assignmentStatus}</div>}

                <div className="assignment-content">
                    {/* Orders List */}
                    <div className="assignment-section orders-section">
                        <h2>
                            Unassigned Orders ({orders.length})
                        </h2>
                        {isAutoMode && <div className="auto-pilot-indicator">Scanning for orders... 📡</div>}
                        {orders.length === 0 ? (
                            <div className="no-data">No unassigned orders found</div>
                        ) : (
                            <div className="orders-list">
                                {orders.map(order => (
                                    <div
                                        key={order.id}
                                        className={`order-card ${selectedOrder?.id === order.id ? 'selected' : ''}`}
                                        onClick={() => handleOrderClick(order)}
                                    >
                                        <div className="order-card-header">
                                            <span className="order-id">#{order.id}</span>
                                            <span className="order-time">
                                                {order.delivery_time && '🕒 '}
                                                {order.delivery_time
                                                    ? new Date(order.delivery_time).toLocaleString()
                                                    : new Date(order.created_at).toLocaleTimeString()
                                                }
                                            </span>
                                        </div>
                                        <div className="order-details">
                                            <p><strong>Rest:</strong> {order.restaurant_name}</p>
                                            <p><strong>Cust:</strong> {order.customer_name} ({order.delivery_distance_km}km)</p>
                                            <p><strong>Loc:</strong> {order.delivery_address?.substring(0, 30)}...</p>
                                        </div>
                                        {isAutoMode && (
                                            <button className="auto-assign-btn">Auto Assign ⚡</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Drivers List (Only visible in Manual Mode when an order is selected) */}
                    {!isAutoMode && (
                        <div className="assignment-section drivers-section">
                            <h2>Available Drivers ({drivers.length})</h2>
                            {!selectedOrder ? (
                                <div className="placeholder-text">Select an order on the left to see available drivers.</div>
                            ) : (
                                <div className="drivers-list">
                                    {getDriversWithDistance(selectedOrder).map(driver => (
                                        <div key={driver.id} className="driver-card">
                                            <div className="driver-info">
                                                <span className="driver-name">{driver.driver_name}</span>
                                                <span className="driver-dist">📍 ~{driver.distance} km away</span>
                                            </div>
                                            <button
                                                className="assign-btn"
                                                onClick={() => assignDriver(selectedOrder.id, driver)}
                                            >
                                                Assign
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default AiOrderAssignment;
