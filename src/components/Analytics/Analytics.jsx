import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabase';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';
import { 
  TrendingUp, Users, ShoppingBag, 
  Calendar, ArrowUpRight, ArrowDownRight,
  RefreshCw, DollarSign, Award, Clock, Filter
} from 'lucide-react';
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval, 
  startOfWeek, endOfWeek, eachWeekOfInterval, subDays
} from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import './Analytics.css';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4'];

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalUsers: 0,
    activeDrivers: 0,
    cancelledOrders: 0,
  });

  const [revenueData, setRevenueData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [productData, setProductData] = useState([]);
  const [driverData, setDriverData] = useState([]);

  // Default to Weekly/30-Day for better long-term overview
  const [granularity, setGranularity] = useState('weekly'); 
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setLoadProgress(0);
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error('Invalid Dates');

      // Smart Continuous Partitioning (No gaps)
      const chunks = [];
      let runner = new Date(start);
      while (runner < end) {
        const cStart = new Date(runner);
        const cEnd = new Date(runner);
        cEnd.setDate(cEnd.getDate() + 7); // 7 day chunks
        
        chunks.push({
          start: cStart.toISOString(),
          end: (cEnd > end ? end : cEnd).toISOString()
        });
        runner = new Date(cEnd); // Start next chunk exactly where this one ended
      }

      let completed = 0;
      const fetchChunk = async (chunk) => {
        try {
          const { data, error } = await supabase
            .from('orders')
            .select('created_at, total_amount, order_type, items, delivery_address, driver_name, driver_mobile, driver_order_earnings, status')
            .gte('created_at', chunk.start)
            .lt('created_at', chunk.end) // Use < for end to avoid double counting overlaps
            .limit(10000); // Explicitly bypass the 1000 default limit

          if (error) throw error;
          completed++;
          setLoadProgress(Math.round((completed / chunks.length) * 100));
          return data || [];
        } catch (e) {
          return [];
        }
      };

      const results = [];
      for (let i = 0; i < chunks.length; i += 4) {
        const batch = chunks.slice(i, i + 4);
        const batchData = await Promise.all(batch.map(fetchChunk));
        results.push(...batchData.flat());
      }
      
      // CRITICAL: Filter for successful statuses in memory for speed & accuracy
      const deliveredOrders = results.filter(o => 
        ['delivered', 'Delivered', 'Success', 'success'].includes(String(o.status || '').trim())
      );
      
      const cancelledOrders = results.filter(o => 
        ['cancelled', 'Cancelled', 'failed'].includes(String(o.status || '').trim())
      );

      const orders = deliveredOrders; // Standardize 'orders' to only delivered as requested

      // Fetch User data with high limit
      const { data: users } = await supabase
        .from('user_data')
        .select('created_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .limit(10000);

      // TIME-SERIES AGGREGATION
      let intervalArr = [];
      if (granularity === 'weekly') {
        intervalArr = eachWeekOfInterval({ start, end });
      } else if (granularity === 'daily') {
        intervalArr = eachDayOfInterval({ start, end });
      } else {
        let currentM = startOfMonth(start);
        while (currentM <= end) {
          intervalArr.push(new Date(currentM));
          currentM = new Date(currentM.setMonth(currentM.getMonth() + 1));
        }
      }

      const processedData = intervalArr.map(point => {
        let ptStart, ptEnd, label;
        if (granularity === 'daily') {
          ptStart = point; ptEnd = point; label = format(point, 'dd MMM');
        } else if (granularity === 'weekly') {
          ptStart = startOfWeek(point); ptEnd = endOfWeek(point); label = `Week ${format(point, 'ww')} (${format(point, 'MMM')})`;
        } else {
          ptStart = startOfMonth(point); ptEnd = endOfMonth(point); label = format(point, 'MMM yyyy');
        }

        const ptOrders = orders.filter(o => {
          const d = new Date(o.created_at);
          return d >= ptStart && d <= ptEnd;
        });

        const ptUsers = users?.filter(u => {
          const d = new Date(u.created_at);
          return d >= ptStart && d <= ptEnd;
        }) || [];

        const ptRev = ptOrders.reduce((sum, o) => {
          const amtStr = String(o.total_amount || '0').replace(/[^0-9.]/g, '');
          return sum + (parseFloat(amtStr) || 0);
        }, 0);

        return { time: label, revenue: Math.round(ptRev), orders: ptOrders.length, customers: ptUsers.length };
      });

      setRevenueData(processedData);

      // OVERALL METRICS
      const totalRev = orders.reduce((sum, o) => {
        const amtStr = String(o.total_amount || '0').replace(/[^0-9.]/g, '');
        return sum + (parseFloat(amtStr) || 0);
      }, 0);
      const { count: globalTotalUsers } = await supabase.from('user_data').select('*', { count: 'exact', head: true });

      setStats({
        totalRevenue: Math.round(totalRev),
        totalOrders: orders.length,
        totalUsers: globalTotalUsers || 0,
        activeDrivers: new Set(orders.map(o => o.driver_mobile)).size,
        cancelledOrders: cancelledOrders.length,
      });

      // CATEGORY MIX
      const catMap = new Map();
      orders.forEach(order => {
        const type = order.order_type || 'General';
        catMap.set(type, (catMap.get(type) || 0) + 1);
      });
      setCategoryData(Array.from(catMap.entries()).map(([name, value]) => ({ name, value })));

      // BESTSELLING
      const prodMap = new Map();
      orders.forEach(order => {
        try {
          const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
          items.forEach(item => {
            const name = item.product_name || 'Item';
            prodMap.set(name, (prodMap.get(name) || 0) + (parseInt(item.quantity) || 1));
          });
        } catch (e) {}
      });
      setProductData(Array.from(prodMap.entries()).map(([name, value]) => ({ name, value })).sort((a,b) => b.value-a.value).slice(0,8));

      // PERFORMANCE
      const dMap = new Map();
      orders.forEach(d => {
        if (!d.driver_mobile) return;
        if (!dMap.has(d.driver_mobile)) dMap.set(d.driver_mobile, { name: d.driver_name, earnings: 0, orders: 0 });
        const entry = dMap.get(d.driver_mobile);
        entry.earnings += (parseFloat(d.driver_order_earnings) || 0);
        entry.orders += 1;
      });
      setDriverData(Array.from(dMap.values()).sort((a,b)=>b.earnings-a.earnings).slice(0,5));

    } catch (error) {
      console.error('Platform Stats Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [granularity, dateRange]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading && !refreshing) {
    return (
      <div className="analytics-loading">
        <div className="loader-orbit"></div>
        <div className="loading-progress-container">
           <div className="loading-progress-bar" style={{ width: `${loadProgress}%` }}></div>
        </div>
        <p>Analyzing Platform Hub... {loadProgress}%</p>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      <header className="analytics-header">
        <div className="header-title">
          <h1>Analytics Hub</h1>
          <div className="filter-group-main">
            <div className="quick-filters">
              {[
                { label: '120D', days: 120, gran: 'monthly' },
                { label: '240D', days: 240, gran: 'monthly' },
                { label: '364D', days: 364, gran: 'monthly' },
              ].map(f => (
                <button 
                  key={f.label}
                  className={`quick-f-btn ${dateRange.start === format(subDays(new Date(), f.days), 'yyyy-MM-dd') ? 'active' : ''}`}
                  onClick={() => {
                    setDateRange({ start: format(subDays(new Date(), f.days), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') });
                    setGranularity(f.gran);
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="divider-v"></div>
            <div className="toggle-group header-toggles">
               {['weekly', 'monthly'].map(t => (
                 <button key={t} className={granularity === t ? 'active' : ''} onClick={() => setGranularity(t)}>
                   {t.charAt(0).toUpperCase() + t.slice(1)}
                 </button>
               ))}
            </div>
          </div>
        </div>
        <div className="header-actions">
           <div className="filter-wrapper">
             <button className="filter-toggle" onClick={() => setShowFilters(!showFilters)}>
                <Filter size={18} />
                <span>Custom Date</span>
             </button>
             <AnimatePresence>
               {showFilters && (
                 <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="filter-dropdown">
                    <div className="filter-section">
                      <label>Set Window</label>
                      <div className="date-inputs">
                        <input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} />
                        <span>to</span>
                        <input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} />
                      </div>
                    </div>
                 </motion.div>
               )}
             </AnimatePresence>
           </div>
           <button className={`refresh-btn ${refreshing ? 'spinning' : ''}`} onClick={handleRefresh}>
            <RefreshCw size={20} />
          </button>
        </div>
      </header>

      <section className="stats-grid">
        <StatCard title="Window Sales" value={`₹${stats.totalRevenue.toLocaleString()}`} icon={<DollarSign size={20} />} description="Delivered gross income" />
        <StatCard title="Delivered" value={stats.totalOrders} icon={<ShoppingBag size={20} />} description="Total successful orders" />
        <StatCard title="Cancelled" value={stats.cancelledOrders} icon={<RefreshCw size={20} />} description="Failed or cancelled orders" />
        <StatCard title="Total Users" value={stats.totalUsers} icon={<TrendingUp size={20} />} description="Global user base" />
      </section>

      <div className="charts-main-grid">
        <div className="chart-card large-span">
          <div className="card-header">
            <div className="header-with-tabs">
               <h3>Performance Trajectory</h3>
               <div className="mini-tabs"><b>{granularity.toUpperCase()} VIEW</b></div>
            </div>
            <p className="card-subtitle">Aggregated revenue and volume trends</p>
          </div>
          <div className="chart-wrapper">
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} />
                  <Legend />
                  <Area type="monotone" name="Income (₹)" dataKey="revenue" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                  <Area type="monotone" name="Orders" dataKey="orders" stroke="#10b981" strokeWidth={3} fillOpacity={0.1} fill="#10b981" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="empty-chart">No transaction data for this window</div>}
          </div>
        </div>

        <div className="chart-card">
          <div className="card-header">
            <h3>Acquisition Mix</h3>
            <p className="card-subtitle">New customer registrations</p>
          </div>
          <div className="chart-wrapper">
             <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueData}>
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                  <Tooltip />
                  <Bar dataKey="customers" name="New Signup" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
             </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="charts-main-grid">
        <div className="chart-card">
          <div className="card-header">
             <h3>Category Velocity</h3>
             <p className="card-subtitle">Orders by operational type</p>
          </div>
          <div className="chart-wrapper flex-center">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                  {categoryData.map((e, i) => <Cell key={`c-${i}`} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="secondary-grid-wrapper" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', gridColumn: 'span 2'}}>
          <div className="chart-card">
            <div className="card-header"><h3>Top Performers</h3><p className="card-subtitle">Highest volume products by count</p></div>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={productData} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 11}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-card">
            <div className="card-header"><h3>Delivery Partner Leaderboard</h3><p className="card-subtitle">Commissions and efficiency</p></div>
            <div className="leaderboard-table">
              <div className="lb-header"><span>Partner</span><span>Success</span><span className="text-right">Payout</span></div>
              {driverData.length > 0 ? driverData.map((d, i) => (
                <div key={i} className="lb-row">
                  <div className="lb-user"><div className="lb-avatar">{d.name?.charAt(0)}</div><span className="lb-name">{d.name}</span></div>
                  <span className="lb-units">{d.orders}</span>
                  <span className="lb-amount">₹{Math.round(d.earnings).toLocaleString()}</span>
                </div>
              )) : <p className="empty-list">No partners found in range</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, description }) => (
  <motion.div className="stat-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
    <div className="stat-top"><div className="stat-icon-box">{icon}</div></div>
    <div className="stat-content">
      <div className="stat-title">{title}</div>
      <div className="stat-value">{value}</div>
    </div>
    <div className="stat-footer"><div className="stat-desc">{description}</div></div>
  </motion.div>
);

export default Analytics;
