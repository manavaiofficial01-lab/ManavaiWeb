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
  Trash2,
  Edit,
  Gift
} from 'lucide-react';
import "./DriverDetails.css";
import Navbar from '../Navbar/Navbar';

function DriverDetails() {
  const [drivers, setDrivers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loginLogs, setLoginLogs] = useState([]);
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [driverStats, setDriverStats] = useState({
    totalDrivers: 0,
    lifetimeEarnings: 0,
    lifetimeOrders: 0,
    todayActiveHours: 0,
    todayOrderEarnings: 0,
    todayTargetIncentive: 0,
    todayHourlyIncentive: 0,
    todayTotalEarnings: 0
  });
  const [newDriver, setNewDriver] = useState({
    driver_name: '',
    driver_phone: '',
    password: ''
  });
  const [historicalIncentives, setHistoricalIncentives] = useState([]);

  const [incentiveConfig, setIncentiveConfig] = useState(null);
  const [globalShift, setGlobalShift] = useState({
    startTime: '09:00',
    endTime: '21:00'
  });
  const [isUpdatingGlobal, setIsUpdatingGlobal] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' or 'payouts'
  const [payoutRequests, setPayoutRequests] = useState([]);
  const [payoutStats, setPayoutStats] = useState({ pending: 0, paid: 0 });
  const [isProcessingPayout, setIsProcessingPayout] = useState(false);

  // New driver form
  const [newDriverData, setNewDriverData] = useState({
    driver_name: '',
    driver_phone: '',
    password: '',
    duty_start_time: '09:00',
    duty_end_time: '21:00'
  });

  // Fetch drivers with their total revenue
  const fetchDrivers = async () => {
    try {
      const { data: driverList, error: driverError } = await supabase
        .from('driver')
        .select('*')
        .order('created_at', { ascending: false });

      if (driverError) throw driverError;

      // 1. Fetch Order Earnings for ALL drivers
      const { data: orderEarnings, error: orderError } = await supabase
        .from('orders')
        .select('driver_mobile, driver_order_earnings')
        .eq('status', 'delivered');

      if (orderError) throw orderError;

      // 2. Fetch Incentives for ALL drivers
      const { data: incentiveData, error: incentiveError } = await supabase
        .from('driver_daily_incentives')
        .select('driver_mobile, incentive_amount, date');

      if (incentiveError) throw incentiveError;

      const today = new Date().toLocaleDateString('en-CA');

      // 3. Aggregate order earnings
      const orderTotals = (orderEarnings || []).reduce((acc, item) => {
        const mobile = item.driver_mobile;
        const earnings = parseFloat(item.driver_order_earnings) || 0;
        acc[mobile] = (acc[mobile] || 0) + earnings;
        return acc;
      }, {});

      // 4. Aggregate historical incentives
      const incentiveTotals = (incentiveData || []).reduce((acc, item) => {
        const mobile = item.driver_mobile;
        // Only sum historical incentives (avoiding double-counting if live data is used elsewhere)
        // But for a simple list view, we sum everything in the history table
        const incentive = parseFloat(item.incentive_amount) || 0;
        acc[mobile] = (acc[mobile] || 0) + incentive;
        return acc;
      }, {});

      // Combine with driver list
      const driversWithRevenue = (driverList || []).map(d => ({
        ...d,
        total_revenue: (orderTotals[d.driver_phone] || 0) + (incentiveTotals[d.driver_phone] || 0)
      }));

      setDrivers(driversWithRevenue);
      setDriverStats(prev => ({ ...prev, totalDrivers: driversWithRevenue.length }));
      
      // Auto-sync wallets to ensure data is populated in Driver App
      syncAllWallets(driversWithRevenue, orderTotals, incentiveTotals);
      
      // Pre-fill global shift from the first driver as a baseline
      if (driversWithRevenue.length > 0) {
        setGlobalShift({
          startTime: driversWithRevenue[0].duty_start_time || '09:00',
          endTime: driversWithRevenue[0].duty_end_time || '21:00'
        });
      }
    } catch (error) {
      console.error('Error fetching drivers:', error);
    }
  };

  // Fetch incentive config
  const fetchIncentiveConfig = async () => {
    try {
      const today = new Date().getDay();
      let { data, error } = await supabase
        .from('daily_incentive_configs')
        .select('*')
        .eq('is_active', true)
        .eq('day_of_week', today)
        .single();

      if (!data) {
        const { data: defaultData } = await supabase
          .from('daily_incentive_configs')
          .select('*')
          .eq('is_active', true)
          .is('day_of_week', null)
          .limit(1)
          .single();
        data = defaultData;
      }

      setIncentiveConfig(data);
    } catch (error) {
      console.error('Error fetching incentive config:', error);
    }
  };

  // Fetch driver data (orders and login logs)
  const fetchDriverData = async (driverPhone) => {
    try {
      const now = new Date();
      const today = now.toLocaleDateString('en-CA');
      
      // Fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('driver_mobile', driverPhone)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
      setOrders(ordersData || []);

      // Fetch login logs for today (including open sessions)
      const { data: logsData, error: logsError } = await supabase
        .from('driver_login_logs')
        .select('*')
        .eq('driver_mobile', driverPhone)
        .or(`created_date.eq.${today},logout_time.is.null`);

      if (logsError) throw logsError;
      setLoginLogs(logsData || []);

      // Fetch historical incentive data
      const { data: historicalData, error: historicalError } = await supabase
        .from('driver_daily_incentives')
        .select('*')
        .eq('driver_mobile', driverPhone)
        .order('date', { ascending: false });

      if (historicalError) throw historicalError;
      setHistoricalIncentives(historicalData || []);

      calculateDriverStats(ordersData || [], logsData || [], historicalData || []);
    } catch (error) {
      console.error('Error fetching driver data:', error);
    }
  };

  // Calculate driver statistics
  const calculateDriverStats = (driverOrders, logsData = [], historicalIncentives = []) => {
    const stats = {
      totalEarnings: 0,
      totalOrders: driverOrders.length,
      completedOrders: 0,
      pendingOrders: 0,
      cancelledOrders: 0,
      todayEarnings: 0,
      averageEarnings: 0,
      totalIncentive: 0,
      todayIncentive: 0,
      todayIdleIncentive: 0,
      activeHours: 0
    };

    const now = new Date();
    const today = now.toLocaleDateString('en-CA');

    // Calculate Today's Target Incentive based on USER's specific tiers
    const calculateTodayTargetIncentive = (ordersCount) => {
      if (ordersCount >= 12) return 800;
      if (ordersCount >= 10) return 520;
      if (ordersCount >= 7) return 450;
      if (ordersCount >= 5) return 300;
      if (ordersCount >= 3) return 180;
      return 0;
    };

    const driverOrdersByDate = {};

    driverOrders.forEach(order => {
      const orderDate = new Date(order.created_at).toISOString().split('T')[0];
      if (!driverOrdersByDate[orderDate]) {
        driverOrdersByDate[orderDate] = 0;
      }

      if (order.status === 'delivered') {
        driverOrdersByDate[orderDate]++;
        
        if (order.driver_order_earnings) {
          if (orderDate === today) {
            stats.todayEarnings += parseFloat(order.driver_order_earnings);
          }
        }
        stats.completedOrders++;
      } else if (order.status === 'cancelled') {
        stats.cancelledOrders++;
      } else {
        stats.pendingOrders++;
      }
    });

    // Calculate Active Hours for today with overlap merging
    if (logsData && logsData.length > 0) {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startOfTodayMs = startOfToday.getTime();

      const intervals = logsData.map(log => {
        const s = new Date(log.login_time).getTime();
        const e = log.logout_time ? new Date(log.logout_time).getTime() : now.getTime();
        
        // Clip to today
        return {
          start: Math.max(s, startOfTodayMs),
          end: Math.max(e, startOfTodayMs)
        };
      });

      intervals.sort((a, b) => a.start - b.start);
      const merged = [];
      if (intervals.length > 0) {
        let current = intervals[0];
        for (let i = 1; i < intervals.length; i++) {
          if (intervals[i].start <= current.end) {
            current.end = Math.max(current.end, intervals[i].end);
          } else {
            merged.push(current);
            current = intervals[i];
          }
        }
        merged.push(current);
      }

      const totalMs = merged.reduce((sum, interval) => sum + (interval.end - interval.start), 0);
      stats.activeHours = parseFloat((totalMs / (1000 * 60 * 60)).toFixed(2));

      // Calculate "No Order Incentive" (10 Rs per idle hour)
      // Mirroring the logic from the driver app
      const [startH, startM = 0] = (selectedDriver?.duty_start_time || '09:00').split(/[.:]/).map(Number);
      const [endH, endM = 0] = (selectedDriver?.duty_end_time || '21:00').split(/[.:]/).map(Number);
      
      for (let h = startH; h <= endH; h++) {
        const blockStart = new Date(startOfToday);
        blockStart.setHours(h, h === startH ? startM : 0, 0, 0);
        const blockEnd = new Date(startOfToday);
        blockEnd.setHours(h, 59, 59, 999);

        // Calculate overlap for this specific hour
        let overlapMs = 0;
        merged.forEach(interval => {
          const overlapS = Math.max(interval.start, blockStart.getTime());
          const overlapE = Math.min(interval.end, blockEnd.getTime());
          if (overlapE > overlapS) overlapMs += (overlapE - overlapS);
        });

        const blockDuration = (h === startH) ? (60 - startM) : 60;
        const requiredMins = Math.max(5, blockDuration - 10); // 10 min grace period

        if (overlapMs >= requiredMins * 60 * 1000) {
          const ordersInBlock = driverOrders.filter(order => {
            const ot = new Date(order.created_at).getTime();
            return ot >= blockStart.getTime() && ot <= blockEnd.getTime();
          });

          if (ordersInBlock.length === 0) {
            stats.todayIdleIncentive += 10;
          }
        }
      }
    }

    // 1. Total Drivers
    const totalDriversCount = drivers.length;

    // 2. Lifetime Earnings (Order Fee Only)
    const lifetimeOrderEarnings = driverOrders.reduce((sum, order) => {
      if (order.status === 'delivered') {
        return sum + (parseFloat(order.driver_order_earnings) || 0);
      }
      return sum;
    }, 0);

    // 3. Lifetime Completed Orders
    const lifetimeCompletedOrders = driverOrders.filter(o => o.status === 'delivered').length;

    // 4. Today's Active Hours
    const todayActiveHoursVal = stats.activeHours;

    // 5. Today's Order Earnings
    const todayOrderEarningsVal = stats.todayEarnings;

    // 6. Today's Target Incentive
    const todayOrderCount = driverOrdersByDate[today] || 0;
    const todayTargetIncVal = calculateTodayTargetIncentive(todayOrderCount);

    // 7. Today's Hourly Incentive
    const todayHourlyIncVal = stats.todayIdleIncentive;

    // 8. Today's Total Earnings
    const todayTotalEarningsVal = todayOrderEarningsVal + todayTargetIncVal + todayHourlyIncVal;

    const finalStats = {
      totalDrivers: totalDriversCount,
      lifetimeEarnings: lifetimeOrderEarnings,
      lifetimeOrders: lifetimeCompletedOrders,
      todayActiveHours: todayActiveHoursVal,
      todayOrderEarnings: todayOrderEarningsVal,
      todayTargetIncentive: todayTargetIncVal,
      todayHourlyIncentive: todayHourlyIncVal,
      todayTotalEarnings: todayTotalEarningsVal
    };

    setDriverStats(finalStats);
    
    // Auto-save today's status to DB
    const todayData = {
      driver_mobile: selectedDriver.driver_phone,
      driver_name: selectedDriver.driver_name,
      date: today,
      orders_count: todayOrderCount,
      earnings: todayOrderEarningsVal,
      active_hours: todayActiveHoursVal,
      incentive_amount: todayTargetIncVal + todayHourlyIncVal,
      status: (todayTargetIncVal + todayHourlyIncVal) > 0 ? 'qualified' : 'in_progress',
      updated_at: new Date().toISOString()
    };

    saveIncentivesToDb([todayData]);
  };

  // Save incentives to DB
  const saveIncentivesToDb = async (incentiveData) => {
    try {
      const { error } = await supabase
        .from('driver_daily_incentives')
        .upsert(incentiveData, { 
          onConflict: 'driver_mobile,date' 
        });

      if (error) {
        if (error.code === '42P01') { // Table does not exist
          console.error('Table driver_daily_incentives does not exist. Please create it.');
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Error saving incentives:', error);
    }
  };

  // Sync all driver wallets (Backfill/Initialize)
  const syncAllWallets = async (driverList, orderTotals, incentiveTotals) => {
    try {
      const walletEntries = driverList.map(driver => {
        const phone = driver.driver_phone;
        const totalEarnings = (orderTotals[phone] || 0) + (incentiveTotals[phone] || 0);
        return {
          driver_mobile: phone,
          total_earnings: totalEarnings,
          current_balance: totalEarnings, // Initially balance = total if no paid data
          updated_at: new Date().toISOString()
        };
      });

      // We use upsert but only update total_earnings to preserve total_paid
      for (const wallet of walletEntries) {
        // First check if wallet exists to get current total_paid
        const { data: existing } = await supabase
          .from('driver_wallet')
          .select('total_paid')
          .eq('driver_mobile', wallet.driver_mobile)
          .single();

        const totalPaid = existing?.total_paid || 0;
        
        await supabase
          .from('driver_wallet')
          .upsert({
            ...wallet,
            total_paid: totalPaid,
            current_balance: wallet.total_earnings - totalPaid
          }, { onConflict: 'driver_mobile' });
      }
    } catch (error) {
      console.error('Error syncing wallets:', error);
    }
  };

  // Fetch Payout Requests
  const fetchPayoutRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('payout_requests')
        .select('*, driver:driver(driver_name)')
        .order('requested_at', { ascending: false });

      if (error) throw error;
      setPayoutRequests(data || []);
      
      const pending = data.filter(r => r.status === 'pending').length;
      const paid = data.filter(r => r.status === 'paid').length;
      setPayoutStats({ pending, paid });
    } catch (error) {
      console.error('Error fetching payout requests:', error);
    }
  };

  // Handle Payout Approval
  const handleProcessPayout = async (request, approvedAmount) => {
    setIsProcessingPayout(true);
    try {
      // 1. Update Request
      const { error: reqError } = await supabase
        .from('payout_requests')
        .update({
          status: 'paid',
          approved_amount: parseFloat(approvedAmount),
          processed_at: new Date().toISOString()
        })
        .eq('id', request.id);

      if (reqError) throw reqError;

      // 2. Update Driver Wallet
      const { data: wallet } = await supabase
        .from('driver_wallet')
        .select('total_paid, total_earnings')
        .eq('driver_mobile', request.driver_mobile)
        .single();

      const newTotalPaid = (parseFloat(wallet.total_paid) || 0) + parseFloat(approvedAmount);
      
      await supabase
        .from('driver_wallet')
        .update({
          total_paid: newTotalPaid,
          current_balance: parseFloat(wallet.total_earnings) - newTotalPaid,
          updated_at: new Date().toISOString()
        })
        .eq('driver_mobile', request.driver_mobile);

      alert('Payout processed successfully!');
      fetchPayoutRequests();
      fetchDrivers(); // Refresh main list
    } catch (error) {
      console.error('Error processing payout:', error);
      alert('Failed to process payout');
    } finally {
      setIsProcessingPayout(false);
    }
  };

  // Aggregated data for the calendar
  const driverOrdersByDate = {};
  const driverOrderPayByDate = {};
  orders.forEach(order => {
    if (order.status === 'delivered') {
      const dateKey = new Date(order.created_at).toLocaleDateString('en-CA');
      driverOrdersByDate[dateKey] = (driverOrdersByDate[dateKey] || 0) + 1;
      driverOrderPayByDate[dateKey] = (driverOrderPayByDate[dateKey] || 0) + (parseFloat(order.driver_order_earnings) || 0);
    }
  });

  // Get earnings by date from both live and historical data
  const getEarningsByDate = (date) => {
    const targetDate = date.toLocaleDateString('en-CA');
    const today = new Date().toLocaleDateString('en-CA');

    // 1. Get raw order data
    const orderCount = driverOrdersByDate[targetDate] || 0;
    const orderPay = driverOrderPayByDate[targetDate] || 0;

    // 2. Get incentive data
    let incentiveAmount = 0;
    if (targetDate === today) {
      incentiveAmount = driverStats.todayTargetIncentive + driverStats.todayHourlyIncentive;
    } else {
      const historicalDay = historicalIncentives.find(item => item.date === targetDate);
      if (historicalDay) {
        incentiveAmount = parseFloat(historicalDay.incentive_amount) || 0;
      }
    }

    return { 
      earnings: orderPay + incentiveAmount, 
      orders: orderCount 
    };
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
          duty_start_time: newDriverData.duty_start_time,
          duty_end_time: newDriverData.duty_end_time,
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
        password: '',
        duty_start_time: '09:00',
        duty_end_time: '21:00'
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


  // Update Global Shift for all drivers
  const handleUpdateGlobalShift = async () => {
    if (!confirm('This will update the duty shift for ALL drivers in the system. Continue?')) return;

    setIsUpdatingGlobal(true);
    try {
      const { data, error, count } = await supabase
        .from('driver')
        .update({ 
          duty_start_time: globalShift.startTime,
          duty_end_time: globalShift.endTime
        })
        .not('id', 'is', null); // Update all records where id is not null

      if (error) throw error;

      alert(`Shift timing updated for ${count || 'all'} drivers!`);
      await fetchDrivers();
    } catch (error) {
      console.error('Error updating global shift:', error);
      alert('Error updating global shift: ' + error.message);
    } finally {
      setIsUpdatingGlobal(false);
    }
  };

  // Format date for last active
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  // Initialize and Auto-refresh
  useEffect(() => {
    fetchDrivers();
    fetchIncentiveConfig();
    fetchPayoutRequests();

    // Refresh data every 30 seconds
    const listInterval = setInterval(() => {
      fetchDrivers();
      fetchPayoutRequests();
    }, 30000);
    return () => clearInterval(listInterval);
  }, []);

  useEffect(() => {
    if (selectedDriver) {
      fetchDriverData(selectedDriver.driver_phone);

      // Refresh selected driver data every 30 seconds to update active hours
      const statsInterval = setInterval(() => {
        fetchDriverData(selectedDriver.driver_phone);
      }, 30000);

      return () => clearInterval(statsInterval);
    }
  }, [selectedDriver]);

  const calendarDays = generateCalendarDays();

  return (
    <>
      <div className="driver-details-container">
        {/* Header */}
        <div className="driver-header">
          <div className="header-left">
            <h1><Users className="icon" /> Driver Management</h1>
            <div className="tab-switcher">
              <button 
                className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button 
                className={`tab-btn ${activeTab === 'payouts' ? 'active' : ''}`}
                onClick={() => setActiveTab('payouts')}
              >
                Payout Requests
                {payoutStats.pending > 0 && <span className="pending-badge">{payoutStats.pending}</span>}
              </button>
            </div>
          </div>
          
          <div className="header-right-actions">
            <div className="global-shift-card">
              <div className="shift-label">
                <Clock size={16} /> <span>Global Shift</span>
              </div>
              <div className="shift-inputs">
                <input
                  type="time"
                  value={globalShift.startTime}
                  onChange={(e) => setGlobalShift({ ...globalShift, startTime: e.target.value })}
                />
                <span className="separator">to</span>
                <input
                  type="time"
                  value={globalShift.endTime}
                  onChange={(e) => setGlobalShift({ ...globalShift, endTime: e.target.value })}
                />
                <button
                  className="apply-all-btn"
                  onClick={handleUpdateGlobalShift}
                  disabled={isUpdatingGlobal}
                >
                  {isUpdatingGlobal ? 'Updating...' : 'Set for All'}
                </button>
              </div>
            </div>

            <button
              className="add-driver-btn"
              onClick={() => setShowAddDriver(true)}
            >
              <UserPlus size={20} /> Add New Driver
            </button>
          </div>
        </div>

        {activeTab === 'overview' ? (
          <div>
            {/* Stats Cards */}
            <div className="stats-grid eight-cols">
          {/* 1st Container: Total Drivers Count */}
          <div className="stat-card">
            <div className="stat-icon drivers-count">
              <Users size={24} />
            </div>
            <div className="stat-info">
              <h3>Total Drivers</h3>
              <p className="stat-value">{driverStats.totalDrivers}</p>
            </div>
          </div>

          {/* 2nd Container: Lifetime Earnings */}
          <div className="stat-card">
            <div className="stat-icon total-earnings">
              <DollarSign size={24} />
            </div>
            <div className="stat-info">
              <h3>Lifetime Earnings</h3>
              <p className="stat-value">{formatCurrency(driverStats.lifetimeEarnings)}</p>
              <span className="stat-detail">From beginning</span>
            </div>
          </div>

          {/* 3rd Container: Total Order Count */}
          <div className="stat-card">
            <div className="stat-icon completed-orders">
              <CheckCircle size={24} />
            </div>
            <div className="stat-info">
              <h3>Lifetime Orders</h3>
              <p className="stat-value">{driverStats.lifetimeOrders}</p>
              <span className="stat-detail">Completed total</span>
            </div>
          </div>

          {/* 4th Container: Today Active Hours */}
          <div className="stat-card">
            <div className="stat-icon active-hours">
              <Clock size={24} />
            </div>
            <div className="stat-info">
              <h3>Active Today</h3>
              <p className="stat-value">
                {Math.floor(driverStats.todayActiveHours)}h {Math.round((driverStats.todayActiveHours % 1) * 60)} m
              </p>
              <span className="stat-detail">Current online time</span>
            </div>
          </div>

          {/* 5th Container: Today Earning Amount */}
          <div className="stat-card">
            <div className="stat-icon today-earnings">
              <TrendingUp size={24} />
            </div>
            <div className="stat-info">
              <h3>Today's Order Pay</h3>
              <p className="stat-value">{formatCurrency(driverStats.todayOrderEarnings)}</p>
            </div>
          </div>

          {/* 6th Container: Today Target Incentive */}
          <div className="stat-card">
            <div className="stat-icon target-incentive">
              <Gift size={24} />
            </div>
            <div className="stat-info">
              <h3>Target Incentive</h3>
              <p className="stat-value">{formatCurrency(driverStats.todayTargetIncentive)}</p>
              <span className="stat-detail">Based on order count</span>
            </div>
          </div>

          {/* 7th Container: Today Hourly Incentive */}
          <div className="stat-card">
            <div className="stat-icon hourly-incentive">
              <Clock size={24} />
            </div>
            <div className="stat-info">
              <h3>Hourly Incentive</h3>
              <p className="stat-value">{formatCurrency(driverStats.todayHourlyIncentive)}</p>
              <span className="stat-detail">₹10/hr idle pay</span>
            </div>
          </div>

          {/* 8th Container: Today Total Earnings */}
          <div className="stat-card today-total">
            <div className="stat-icon total-revenue">
              <DollarSign size={24} />
            </div>
            <div className="stat-info">
              <h3>Today's Total</h3>
              <p className="stat-value highlight">{formatCurrency(driverStats.todayTotalEarnings)}</p>
              <span className="stat-detail">Sum of all earnings</span>
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
                    <div className={`status-dot ${driver.status}`}></div>
                  </div>
                  <div className="driver-info">
                    <div className="driver-header-flex">
                      <h3>{driver.driver_name}</h3>
                      <div className="driver-revenue-badge">
                        {formatCurrency(driver.total_revenue)}
                      </div>
                    </div>
                    <p className="driver-phone">{driver.driver_phone}</p>
                    <div className="driver-meta">
                      <div className="last-active-status">
                        <Clock size={12} />
                        <span>LAST ACTIVE: {formatDate(driver.last_active)}</span>
                      </div>
                      <span className="shift-badge-mini">
                        <Clock size={10} /> {driver.duty_start_time} - {driver.duty_end_time}
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
                      <Trash2 size={18} />
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
                    onChange={(e) => setNewDriverData({ ...newDriverData, driver_name: e.target.value })}
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
                    onChange={(e) => setNewDriverData({ ...newDriverData, driver_phone: e.target.value })}
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
                    onChange={(e) => setNewDriverData({ ...newDriverData, password: e.target.value })}
                    required
                    placeholder="Create a password"
                    minLength="6"
                  />
                </div>

                <div className="time-range-group">
                  <div className="form-group">
                    <label>Duty Start Time</label>
                    <input
                      type="time"
                      value={newDriverData.duty_start_time}
                      onChange={(e) => setNewDriverData({ ...newDriverData, duty_start_time: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Duty End Time</label>
                    <input
                      type="time"
                      value={newDriverData.duty_end_time}
                      onChange={(e) => setNewDriverData({ ...newDriverData, duty_end_time: e.target.value })}
                      required
                    />
                  </div>
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
    ) : (
      /* Payout Requests Tab */
      <div className="payout-management">
            <div className="payout-summary-bar">
              <div className="summary-item">
                <span className="label">Pending Requests</span>
                <span className="value orange">{payoutStats.pending}</span>
              </div>
              <div className="summary-item">
                <span className="label">Processed This Month</span>
                <span className="value green">{payoutStats.paid}</span>
              </div>
            </div>

            <div className="requests-table-container">
              <table className="requests-table">
                <thead>
                  <tr>
                    <th>Driver Name</th>
                    <th>Requested At</th>
                    <th>Amount (Req / Paid)</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payoutRequests.length === 0 ? (
                    <tr><td colSpan="5" className="empty-row">No payout requests found</td></tr>
                  ) : (
                    payoutRequests.map(req => (
                      <tr key={req.id}>
                        <td>
                          <div className="driver-name-cell">
                            <strong>{req.driver?.driver_name || 'Unknown'}</strong>
                            <span>{req.driver_mobile}</span>
                          </div>
                        </td>
                        <td>{new Date(req.requested_at).toLocaleString()}</td>
                        <td className="amount">
                          <div className="amount-stack">
                            <span className="req-amt">Req: ₹{parseFloat(req.requested_amount).toFixed(0)}</span>
                            {req.status === 'paid' && (
                              <span className={`paid-amt ${parseFloat(req.approved_amount) < parseFloat(req.requested_amount) ? 'partial' : ''}`}>
                                Paid: ₹{parseFloat(req.approved_amount).toFixed(0)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`status-pill ${req.status}`}>
                            {req.status.toUpperCase()}
                            {req.status === 'paid' && parseFloat(req.approved_amount) < parseFloat(req.requested_amount) && (
                              <span className="partial-tag">PARTIAL</span>
                            )}
                          </span>
                        </td>
                        <td>
                          {req.status === 'pending' ? (
                            <button 
                              className="process-btn"
                              onClick={() => {
                                const amount = prompt(`Approve payout for ${req.driver?.driver_name}?\nRequested: ₹${req.requested_amount}\nEnter amount to pay:`, req.requested_amount);
                                if (amount !== null && !isNaN(amount) && amount !== "") {
                                  handleProcessPayout(req, amount);
                                }
                              }}
                              disabled={isProcessingPayout}
                            >
                              Mark as Paid
                            </button>
                          ) : (
                            <div className="processed-info">
                              <span className="date">{new Date(req.processed_at).toLocaleDateString()}</span>
                              <span className="receipt-ref">ID: #{req.id.toString().slice(-4)}</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default DriverDetails;