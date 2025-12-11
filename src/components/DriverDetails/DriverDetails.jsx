import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabase';
import {
  Calendar,
  DollarSign,
  UserPlus,
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  Trash2
} from 'lucide-react';
import "./DriverDetails.css";
import Navbar from '../Navbar/Navbar';

function DriverDetails() {
  const [drivers, setDrivers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [driverStats, setDriverStats] = useState({});
  const [newDriver, setNewDriver] = useState({
    driver_name: '',
    driver_phone: '',
    password: ''
  });

  // New driver form
  const [newDriverData, setNewDriverData] = useState({
    driver_name: '',
    driver_phone: '',
    password: ''
  });

  // Fetch drivers
  const fetchDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from('driver')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDrivers(data || []);
    } catch (error) {
      console.error('Error fetching drivers:', error);
    }
  };

  // Fetch driver orders
  const fetchDriverOrders = async (driverPhone) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('driver_mobile', driverPhone)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
      
      // Calculate stats
      calculateDriverStats(data || []);
    } catch (error) {
      console.error('Error fetching driver orders:', error);
    }
  };

  // Calculate driver statistics
  const calculateDriverStats = (driverOrders) => {
    const stats = {
      totalEarnings: 0,
      totalOrders: driverOrders.length,
      completedOrders: 0,
      pendingOrders: 0,
      cancelledOrders: 0,
      todayEarnings: 0,
      averageEarnings: 0
    };

    const today = new Date().toDateString();
    
    driverOrders.forEach(order => {
      if (order.driver_order_earnings) {
        stats.totalEarnings += parseFloat(order.driver_order_earnings);
        
        // Today's earnings
        const orderDate = new Date(order.created_at).toDateString();
        if (orderDate === today) {
          stats.todayEarnings += parseFloat(order.driver_order_earnings);
        }
      }

      // Count by status
      if (order.status === 'delivered') {
        stats.completedOrders++;
      } else if (order.status === 'cancelled') {
        stats.cancelledOrders++;
      } else {
        stats.pendingOrders++;
      }
    });

    stats.averageEarnings = stats.totalOrders > 0 ? 
      stats.totalEarnings / stats.totalOrders : 0;

    setDriverStats(stats);
  };

  // Get earnings by date
  const getEarningsByDate = (date) => {
    const dateStr = date.toDateString();
    let dailyEarnings = 0;
    let dailyOrders = 0;

    orders.forEach(order => {
      const orderDate = new Date(order.created_at).toDateString();
      if (orderDate === dateStr && order.driver_order_earnings) {
        dailyEarnings += parseFloat(order.driver_order_earnings);
        dailyOrders++;
      }
    });

    return { earnings: dailyEarnings, orders: dailyOrders };
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    const days = [];
    
    // Add previous month's trailing days
    const firstDayOfWeek = firstDay.getDay();
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      const { earnings, orders } = getEarningsByDate(date);
      days.push({
        date,
        currentMonth: false,
        earnings,
        orders
      });
    }
    
    // Add current month's days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const { earnings, orders } = getEarningsByDate(date);
      days.push({
        date,
        currentMonth: true,
        earnings,
        orders
      });
    }
    
    // Add next month's leading days
    const totalCells = 42; // 6 weeks
    const nextMonthDays = totalCells - days.length;
    
    for (let day = 1; day <= nextMonthDays; day++) {
      const date = new Date(year, month + 1, day);
      const { earnings, orders } = getEarningsByDate(date);
      days.push({
        date,
        currentMonth: false,
        earnings,
        orders
      });
    }
    
    return days;
  };

  // Create new driver
  const handleCreateDriver = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!newDriverData.driver_name.trim()) {
      alert('Driver name is required!');
      return;
    }
    
    if (!newDriverData.driver_phone.trim() || !/^\d{10}$/.test(newDriverData.driver_phone)) {
      alert('Please enter a valid 10-digit phone number!');
      return;
    }
    
    if (!newDriverData.password.trim()) {
      alert('Password is required!');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('driver')
        .insert([{
          driver_name: newDriverData.driver_name.trim(),
          driver_phone: newDriverData.driver_phone.trim(),
          password: newDriverData.password,
          status: 'offline',
          created_at: new Date().toISOString()
        }])
        .select();

      if (error) throw error;

      alert('Driver created successfully!');
      setShowAddDriver(false);
      setNewDriverData({
        driver_name: '',
        driver_phone: '',
        password: ''
      });
      fetchDrivers();
    } catch (error) {
      console.error('Error creating driver:', error);
      alert('Error creating driver: ' + error.message);
    }
  };

  // Delete driver
  const handleDeleteDriver = async (driverId) => {
    if (!confirm('Are you sure you want to delete this driver?')) return;

    try {
      const { error } = await supabase
        .from('driver')
        .delete()
        .eq('id', driverId);

      if (error) throw error;

      alert('Driver deleted successfully!');
      fetchDrivers();
      if (selectedDriver && selectedDriver.id === driverId) {
        setSelectedDriver(null);
        setOrders([]);
      }
    } catch (error) {
      console.error('Error deleting driver:', error);
      alert('Error deleting driver: ' + error.message);
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  // Initialize
  useEffect(() => {
    fetchDrivers();
  }, []);

  useEffect(() => {
    if (selectedDriver) {
      fetchDriverOrders(selectedDriver.driver_phone);
    }
  }, [selectedDriver]);

  const calendarDays = generateCalendarDays();

  return (
    <>
      <Navbar/>
      <div className="driver-details-container">
      {/* Header */}
      <div className="driver-header">
        <h1><Users className="icon" /> Driver Management</h1>
        <button 
          className="add-driver-btn"
          onClick={() => setShowAddDriver(true)}
        >
          <UserPlus size={20} /> Add New Driver
        </button>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon total-drivers">
            <Users size={24} />
          </div>
          <div className="stat-info">
            <h3>Total Drivers</h3>
            <p className="stat-value">{drivers.length}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon total-earnings">
            <DollarSign size={24} />
          </div>
          <div className="stat-info">
            <h3>Total Earnings</h3>
            <p className="stat-value">{formatCurrency(driverStats.totalEarnings)}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon completed-orders">
            <CheckCircle size={24} />
          </div>
          <div className="stat-info">
            <h3>Completed Orders</h3>
            <p className="stat-value">{driverStats.completedOrders}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon average-earnings">
            <TrendingUp size={24} />
          </div>
          <div className="stat-info">
            <h3>Avg. per Order</h3>
            <p className="stat-value">{formatCurrency(driverStats.averageEarnings)}</p>
          </div>
        </div>
      </div>

      <div className="main-content">
        {/* Drivers List */}
        <div className="drivers-section">
          <h2><Users className="icon" /> Drivers List</h2>
          <div className="drivers-grid">
            {drivers.map((driver) => (
              <div 
                key={driver.id}
                className={`driver-card ${selectedDriver?.id === driver.id ? 'selected' : ''}`}
                onClick={() => setSelectedDriver(driver)}
              >
                <div className="driver-avatar">
                  {driver.driver_name.charAt(0).toUpperCase()}
                </div>
                <div className="driver-info">
                  <h3>{driver.driver_name}</h3>
                  <p className="driver-phone">{driver.driver_phone}</p>
                  <div className="driver-status">
                    <span className={`status-badge ${driver.status}`}>
                      {driver.status}
                    </span>
                    <span className="last-active">
                      <Clock size={12} /> Last active: {new Date(driver.last_active).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="driver-actions">
                  <button 
                    className="action-btn delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDriver(driver.id);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Earnings Calendar */}
        <div className="calendar-section">
          <div className="calendar-header">
            <h2><Calendar className="icon" /> Earnings Calendar</h2>
            <div className="calendar-nav">
              <button 
                onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1))}
              >
                &lt;
              </button>
              <h3>
                {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              <button 
                onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1))}
              >
                &gt;
              </button>
            </div>
          </div>

          <div className="calendar-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="calendar-day-header">
                {day}
              </div>
            ))}
            
            {calendarDays.map((day, index) => (
              <div 
                key={index}
                className={`calendar-day ${day.currentMonth ? 'current-month' : 'other-month'} ${day.earnings > 0 ? 'has-earnings' : ''}`}
              >
                <div className="day-number">
                  {day.date.getDate()}
                  {day.date.toDateString() === new Date().toDateString() && (
                    <span className="today-dot"></span>
                  )}
                </div>
                {day.earnings > 0 && (
                  <div className="day-earnings">
                    <DollarSign size={12} />
                    <span>{formatCurrency(day.earnings)}</span>
                    <div className="order-count">{day.orders} orders</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Driver Modal */}
      {showAddDriver && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2><UserPlus className="icon" /> Add New Driver</h2>
              <button 
                className="close-btn"
                onClick={() => setShowAddDriver(false)}
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleCreateDriver}>
              <div className="form-group">
                <label>Driver Name *</label>
                <input
                  type="text"
                  value={newDriverData.driver_name}
                  onChange={(e) => setNewDriverData({...newDriverData, driver_name: e.target.value})}
                  required
                  placeholder="Enter driver's full name"
                  autoFocus
                />
              </div>
              
              <div className="form-group">
                <label>Phone Number *</label>
                <input
                  type="tel"
                  value={newDriverData.driver_phone}
                  onChange={(e) => setNewDriverData({...newDriverData, driver_phone: e.target.value})}
                  required
                  placeholder="Enter 10-digit mobile number"
                  pattern="[0-9]{10}"
                  maxLength="10"
                />
              </div>
              
              <div className="form-group">
                <label>Password *</label>
                <input
                  type="password"
                  value={newDriverData.password}
                  onChange={(e) => setNewDriverData({...newDriverData, password: e.target.value})}
                  required
                  placeholder="Create a password"
                  minLength="6"
                />
              </div>
              
              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn-cancel"
                  onClick={() => setShowAddDriver(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-submit"
                >
                  Create Driver
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

export default DriverDetails;