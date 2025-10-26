import React, { useState, useEffect } from 'react'
import Navbar from '../Navbar/Navbar'
import { supabase } from '../../../supabase';
import "./DaybyDayRevenue.css"

const DaybyDayRevenue = () => {
  const [revenueData, setRevenueData] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalRevenueWithoutDelivery: 0,
    foodRevenue: 0,
    foodRevenueWithoutDelivery: 0,
    productRevenue: 0,
    productRevenueWithoutDelivery: 0,
    deliveryChargesTotal: 0,
    deliveredOrders: 0,
    totalOrders: 0
  });
  const [restaurantRevenue, setRestaurantRevenue] = useState([]);
  const [categoryRevenue, setCategoryRevenue] = useState([]);
  const [activeTab, setActiveTab] = useState('orders');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showItemsModal, setShowItemsModal] = useState(false);

  // Get current IST date in YYYY-MM-DD format
  const getCurrentISTDate = () => {
    const now = new Date();
    return now.toLocaleDateString('en-CA', {
      timeZone: 'Asia/Kolkata'
    });
  };

  // Initialize selectedDate with current IST date when component mounts
  useEffect(() => {
    const currentISTDate = getCurrentISTDate();
    setSelectedDate(currentISTDate);
  }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchRevenueData();
    }
  }, [selectedDate]);

  // Tamil Nadu timezone (IST - India Standard Time)
  const getTamilNaduTime = (dateString) => {
    try {
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.error('Invalid date:', dateString);
        return {
          time: 'Invalid Time',
          date: 'Invalid Date',
          fullDateTime: 'Invalid DateTime'
        };
      }
      
      // Format time in 12-hour format with AM/PM
      const timeOptions = {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      };
      
      // Format date in Indian format
      const dateOptions = {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      };
      
      const time = date.toLocaleTimeString('en-IN', timeOptions);
      const dateFormatted = date.toLocaleDateString('en-IN', dateOptions);
      
      return {
        time,
        date: dateFormatted,
        fullDateTime: date.toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        })
      };
    } catch (error) {
      console.error('Error formatting date:', error);
      return {
        time: 'Error',
        date: 'Error',
        fullDateTime: 'Error'
      };
    }
  };

  const getTamilNaduDay = (dateString) => {
    try {
      const date = new Date(dateString + 'T00:00:00+05:30'); // Add timezone for IST
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const fetchRevenueData = async () => {
    if (!selectedDate) return;
    
    try {
      setLoading(true);
      
      // Get all orders for a wider date range, then filter by IST date
      const startDate = new Date(selectedDate);
      startDate.setDate(startDate.getDate() - 1); // Include previous day for timezone overlap
      
      const endDate = new Date(selectedDate);
      endDate.setDate(endDate.getDate() + 2); // Include next day for timezone overlap

      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (orders) {
        // Filter orders by IST date to handle timezone correctly
        const filteredOrders = orders.filter(order => {
          const istDate = getISTDate(order.created_at);
          return istDate === selectedDate;
        });
        
        processRevenueData(filteredOrders);
      } else {
        processRevenueData([]);
      }
    } catch (error) {
      console.error('Error fetching revenue data:', error);
      processRevenueData([]);
    } finally {
      setLoading(false);
    }
  };

  const safeJsonParse = (data) => {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (e) {
        console.error('JSON parse error:', e);
        return [];
      }
    }
    return data || [];
  };

  const processRevenueData = (orders) => {
    let totalRevenue = 0;
    let totalRevenueWithoutDelivery = 0;
    let foodRevenue = 0;
    let foodRevenueWithoutDelivery = 0;
    let productRevenue = 0;
    let productRevenueWithoutDelivery = 0;
    let deliveryChargesTotal = 0;
    let deliveredOrders = 0;
    const restaurantMap = new Map();
    const categoryMap = new Map();

    const processedOrders = orders.map(order => {
      const isFoodOrder = order.order_type === 'food';
      const isDelivered = order.status === 'delivered';

      const orderAmount = parseFloat(order.total_amount) || 0;
      const deliveryCharges = parseFloat(order.delivery_charges) || 0;
      const orderRevenue = orderAmount + deliveryCharges;
      const orderRevenueWithoutDelivery = orderAmount;

      totalRevenue += orderRevenue;
      totalRevenueWithoutDelivery += orderRevenueWithoutDelivery;
      deliveryChargesTotal += deliveryCharges;
      
      if (isFoodOrder) {
        foodRevenue += orderRevenue;
        foodRevenueWithoutDelivery += orderRevenueWithoutDelivery;
      } else {
        productRevenue += orderRevenue;
        productRevenueWithoutDelivery += orderRevenueWithoutDelivery;
      }

      if (isDelivered) {
        deliveredOrders++;
      }

      const items = safeJsonParse(order.items);
      
      if (isFoodOrder && order.restaurant_name) {
        const currentRestaurant = restaurantMap.get(order.restaurant_name) || {
          name: order.restaurant_name,
          revenue: 0,
          revenueWithoutDelivery: 0,
          orders: 0,
          items: 0
        };
        
        currentRestaurant.revenue += orderRevenue;
        currentRestaurant.revenueWithoutDelivery += orderRevenueWithoutDelivery;
        currentRestaurant.orders += 1;
        currentRestaurant.items += items.reduce((sum, item) => sum + (item.quantity || 1), 0);
        
        restaurantMap.set(order.restaurant_name, currentRestaurant);
      }

      if (!isFoodOrder && order.category) {
        const currentCategory = categoryMap.get(order.category) || {
          name: order.category,
          revenue: 0,
          revenueWithoutDelivery: 0,
          orders: 0,
          items: 0
        };
        
        currentCategory.revenue += orderRevenue;
        currentCategory.revenueWithoutDelivery += orderRevenueWithoutDelivery;
        currentCategory.orders += 1;
        currentCategory.items += items.reduce((sum, item) => sum + (item.quantity || 1), 0);
        
        categoryMap.set(order.category, currentCategory);
      }

      items.forEach(item => {
        if (item.category && isFoodOrder) {
          const currentFoodCategory = categoryMap.get(item.category) || {
            name: item.category,
            revenue: 0,
            revenueWithoutDelivery: 0,
            orders: 0,
            items: 0
          };
          
          const itemRevenue = (item.price || 0) * (item.quantity || 1);
          currentFoodCategory.revenue += itemRevenue;
          currentFoodCategory.revenueWithoutDelivery += itemRevenue;
          currentFoodCategory.items += (item.quantity || 1);
          
          categoryMap.set(item.category, currentFoodCategory);
        }
      });

      // Get Tamil Nadu time for the order
      const tamilNaduTime = getTamilNaduTime(order.created_at);

      return {
        ...order,
        items: items,
        orderRevenue,
        orderRevenueWithoutDelivery,
        deliveryCharges,
        formattedTime: tamilNaduTime.time,
        formattedDate: tamilNaduTime.date,
        fullDateTime: tamilNaduTime.fullDateTime,
        isFoodOrder,
        isDelivered
      };
    });

    const restaurantArray = Array.from(restaurantMap.values())
      .sort((a, b) => b.revenue - a.revenue);
    
    const categoryArray = Array.from(categoryMap.values())
      .sort((a, b) => b.revenue - a.revenue);

    setRevenueData(processedOrders);
    setRestaurantRevenue(restaurantArray);
    setCategoryRevenue(categoryArray);
    setStats({
      totalRevenue,
      totalRevenueWithoutDelivery,
      foodRevenue,
      foodRevenueWithoutDelivery,
      productRevenue,
      productRevenueWithoutDelivery,
      deliveryChargesTotal,
      deliveredOrders,
      totalOrders: orders.length
    });
  };

  const getStatusColor = (status) => {
    const statusColors = {
      delivered: '#10B981',
      processing: '#F59E0B',
      confirmed: '#3B82F6',
      pending: '#6B7280',
      cancelled: '#EF4444'
    };
    return statusColors[status] || '#6B7280';
  };

  const handleViewItems = (order) => {
    setSelectedOrder(order);
    setShowItemsModal(true);
  };

  const closeItemsModal = () => {
    setShowItemsModal(false);
    setSelectedOrder(null);
  };

  const ItemsModal = () => {
    if (!selectedOrder) return null;

    const totalItems = selectedOrder.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const itemsTotal = selectedOrder.items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);

    return (
      <div className="revenue-modal-overlay" onClick={closeItemsModal}>
        <div className="revenue-modal" onClick={(e) => e.stopPropagation()}>
          <div className="revenue-modal-header">
            <button className="revenue-modal-close" onClick={closeItemsModal}>×</button>
            <h3>Order Items - #{selectedOrder.receipt_reference}</h3>
            <p>
              {selectedOrder.customer_name} • {selectedOrder.customer_phone} • 
              {selectedOrder.isFoodOrder ? ' 🍕 Food' : ' 📦 Product'}
            </p>
            <p style={{fontSize: '0.8rem', margin: '4px 0 0 0', color: '#475569'}}>
              📅 {selectedOrder.fullDateTime} IST
            </p>
          </div>
          
          <div className="revenue-modal-body">
            <div className="revenue-modal-items">
              {selectedOrder.items.map((item, index) => (
                <div key={index} className="revenue-modal-item">
                  <img 
                    src={item.product_image || '/placeholder-image.jpg'} 
                    alt={item.product_name}
                    className="revenue-modal-item-image"
                    onError={(e) => {
                      e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0zMCAzN0MzMy4zMTM3IDM3IDM2IDM0LjMxMzcgMzYgMzFDMzYgMjcuNjg2MyAzMy4zMTM3IDI1IDMwIDI1QzI2LjY4NjMgMjUgMjQgMjcuNjg2MyAyNCAzMUMyNCAzNC4zMTM3IDI2LjY4NjMgMzcgMzAgMzdaIiBmaWxsPSIjOTRBMUI2Ii8+CjxwYXRoIGQ9Ik0zNi41IDQySDE5LjVDMTguMTE5MyA0MiAxNyA0MC44ODA3IDE3IDM5LjVWMTkuNUMxNyAxOC4xMTkzIDE4LjExOTMgMTcgMTkuNSAxN0g0MC41QzQxLjg4MDcgMTcgNDMgMTguMTE5MyA0MyAxOS41VjM5LjVDNDMgNDAuODgwNyA0MS44ODA3IDQyIDQwLjUgNDJIMzYuNVpNMzkuNSAzOS41VjI0LjI1TDMxLjM2NiAzMi4zODZDMzAuOTg3NSAzMi43NjQ1IDMwLjQxMjUgMzIuNzY0NSAzMC4wMzQgMzIuMzg2TDI2LjI1IDI4LjYwMkwyMC41IDM0LjM1MlYzOS41SDM5LjVaTTI0IDI0LjVDMjQgMjUuODgwNyAyMi44ODA3IDI3IDIxLjUgMjdDMjAuMTE5MyAyNyAxOSAyNS44ODA3IDE5IDI0LjVDMTkgMjMuMTE5MyAyMC4xMTkMyAyMiAyMS41IDIyQzIyLjg4MDcgMjIgMjQgMjMuMTE5MyAyNCAyNC41WiIgZmlsbD0iIzk0QTFCNiIvPgo8L3N2Zz4K';
                    }}
                  />
                  <div className="revenue-modal-item-details">
                    <div className="revenue-modal-item-name">{item.product_name}</div>
                    <div className="revenue-modal-item-info">
                      <span className="revenue-modal-item-price">
                        {formatCurrency(item.price || 0)} × {item.quantity || 1}
                      </span>
                      <span className="revenue-modal-item-quantity">
                        Qty: {item.quantity || 1}
                      </span>
                      {item.restaurant_name && (
                        <span className="revenue-modal-item-restaurant">
                          🏪 {item.restaurant_name}
                        </span>
                      )}
                      {item.category && (
                        <span className="revenue-modal-item-category">
                          {item.category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="revenue-modal-footer">
            <div className="revenue-modal-total">
              <span>Items Total ({totalItems} items):</span>
              <span className="revenue-modal-total-amount">
                {formatCurrency(itemsTotal)}
              </span>
            </div>
            {selectedOrder.deliveryCharges > 0 && (
              <div className="revenue-modal-total" style={{marginTop: '8px'}}>
                <span>Delivery Charges:</span>
                <span className="revenue-modal-total-amount">
                  +{formatCurrency(selectedOrder.deliveryCharges)}
                </span>
              </div>
            )}
            <div className="revenue-modal-total" style={{marginTop: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '8px'}}>
              <span>Order Total:</span>
              <span className="revenue-modal-total-amount">
                {formatCurrency(selectedOrder.orderRevenue)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderOrdersTable = () => (
    <div className="revenue-orders-table-container">
      <table className="revenue-orders-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Time (IST)</th>
            <th>Customer</th>
            <th>Type</th>
            <th>Items</th>
            <th>Order Amount</th>
            <th>Delivery Charges</th>
            <th>Total Revenue</th>
            <th>Status</th>
            <th>Payment</th>
          </tr>
        </thead>
        <tbody>
          {revenueData.map((order) => (
            <tr key={order.id} className={order.isDelivered ? 'revenue-delivered-order' : ''}>
              <td className="revenue-order-id">#{order.receipt_reference}</td>
              <td className="revenue-order-time">
                <div>{order.formattedTime}</div>
                <small>{order.formattedDate}</small>
              </td>
              <td className="revenue-customer-info">
                <strong>{order.customer_name}</strong>
                <small>{order.customer_phone}</small>
              </td>
              <td>
                <span className={`revenue-order-type-badge ${order.isFoodOrder ? 'revenue-food' : 'revenue-product'}`}>
                  {order.isFoodOrder ? '🍕 Food' : '📦 Product'}
                </span>
              </td>
              <td className="revenue-order-items">
                <div 
                  className="revenue-items-preview"
                  onClick={() => handleViewItems(order)}
                >
                  <div className="revenue-items-preview-content">
                    <span className="revenue-items-preview-count">
                      {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                    </span>
                    View Items
                  </div>
                </div>
              </td>
              <td className="revenue-amount">{formatCurrency(order.orderRevenueWithoutDelivery)}</td>
              <td className="revenue-delivery-charges">+{formatCurrency(order.deliveryCharges)}</td>
              <td className="revenue-total-revenue-amount">
                <strong>{formatCurrency(order.orderRevenue)}</strong>
              </td>
              <td>
                <span 
                  className="revenue-status-badge"
                  style={{ backgroundColor: getStatusColor(order.status) }}
                >
                  {order.status}
                </span>
              </td>
              <td>
                <span className={`revenue-payment-method ${order.payment_method.toLowerCase().replace(' ', '-')}`}>
                  {order.payment_method}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderRestaurantsTable = () => (
    <div className="revenue-table-container">
      <table className="revenue-table">
        <thead>
          <tr>
            <th>Restaurant</th>
            <th>Product Revenue</th>
            <th>Total Revenue</th>
            <th>Orders</th>
            <th>Items Sold</th>
            <th>Average Order Value</th>
          </tr>
        </thead>
        <tbody>
          {restaurantRevenue.map((restaurant, index) => (
            <tr key={restaurant.name}>
              <td className="revenue-name-cell">
                <span className="revenue-rank-badge">{index + 1}</span>
                {restaurant.name}
              </td>
              <td className="revenue-revenue-cell">
                <strong>{formatCurrency(restaurant.revenueWithoutDelivery)}</strong>
              </td>
              <td className="revenue-revenue-cell">
                <strong>{formatCurrency(restaurant.revenue)}</strong>
                <div style={{fontSize: '0.75rem', color: '#64748b', marginTop: '2px'}}>
                  (+{formatCurrency(restaurant.revenue - restaurant.revenueWithoutDelivery)} delivery)
                </div>
              </td>
              <td className="revenue-orders-cell">{restaurant.orders}</td>
              <td className="revenue-items-cell">{restaurant.items}</td>
              <td className="revenue-aov-cell">
                {formatCurrency(restaurant.revenueWithoutDelivery / restaurant.orders)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderCategoriesTable = () => (
    <div className="revenue-table-container">
      <table className="revenue-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Product Revenue</th>
            <th>Total Revenue</th>
            <th>Orders</th>
            <th>Items Sold</th>
            <th>Performance</th>
          </tr>
        </thead>
        <tbody>
          {categoryRevenue.map((category, index) => (
            <tr key={category.name}>
              <td className="revenue-name-cell">
                <span className="revenue-rank-badge">{index + 1}</span>
                {category.name}
              </td>
              <td className="revenue-revenue-cell">
                <strong>{formatCurrency(category.revenueWithoutDelivery)}</strong>
              </td>
              <td className="revenue-revenue-cell">
                <strong>{formatCurrency(category.revenue)}</strong>
              </td>
              <td className="revenue-orders-cell">{category.orders}</td>
              <td className="revenue-items-cell">{category.items}</td>
              <td className="revenue-performance-cell">
                <div className="revenue-performance-bar">
                  <div 
                    className="revenue-performance-fill"
                    style={{ 
                      width: `${(category.revenueWithoutDelivery / stats.totalRevenueWithoutDelivery) * 100}%`
                    }}
                  ></div>
                </div>
                <span>{((category.revenueWithoutDelivery / stats.totalRevenueWithoutDelivery) * 100).toFixed(1)}%</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="revenue-loading">
          <div className="revenue-loading-spinner"></div>
          <p>Loading revenue data...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="revenue-container">
        {/* Header */}
        <div className="revenue-header">
          <h1>Daily Revenue Dashboard</h1>
          <div className="revenue-date-selector">
            <label htmlFor="revenue-date-picker">Select Date:</label>
            <input
              id="revenue-date-picker"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="revenue-date-input"
            />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="revenue-stats-grid">
          <div className="revenue-stat-card revenue-total-revenue">
            <div className="revenue-stat-icon">💰</div>
            <div className="revenue-stat-info">
              <h3>Total Revenue</h3>
              <p className="revenue-stat-value">{formatCurrency(stats.totalRevenue)}</p>
              <small>
                {formatCurrency(stats.totalRevenueWithoutDelivery)} products + {' '}
                {formatCurrency(stats.deliveryChargesTotal)} delivery
              </small>
            </div>
          </div>

          <div className="revenue-stat-card revenue-food-revenue">
            <div className="revenue-stat-icon">🍕</div>
            <div className="revenue-stat-info">
              <h3>Food Revenue</h3>
              <p className="revenue-stat-value">{formatCurrency(stats.foodRevenue)}</p>
              <small>
                {formatCurrency(stats.foodRevenueWithoutDelivery)} food + {' '}
                {formatCurrency(stats.foodRevenue - stats.foodRevenueWithoutDelivery)} delivery
              </small>
            </div>
          </div>

          <div className="revenue-stat-card revenue-product-revenue">
            <div className="revenue-stat-icon">📦</div>
            <div className="revenue-stat-info">
              <h3>Product Revenue</h3>
              <p className="revenue-stat-value">{formatCurrency(stats.productRevenue)}</p>
              <small>
                {formatCurrency(stats.productRevenueWithoutDelivery)} products + {' '}
                {formatCurrency(stats.productRevenue - stats.productRevenueWithoutDelivery)} delivery
              </small>
            </div>
          </div>

          <div className="revenue-stat-card revenue-orders-delivered">
            <div className="revenue-stat-icon">✅</div>
            <div className="revenue-stat-info">
              <h3>Delivered Orders</h3>
              <p className="revenue-stat-value">
                {stats.deliveredOrders} / {stats.totalOrders}
              </p>
              <small>
                {stats.totalOrders > 0 
                  ? `${Math.round((stats.deliveredOrders / stats.totalOrders) * 100)}% delivered`
                  : 'No orders'
                }
              </small>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="revenue-tabs-navigation">
          <button 
            className={`revenue-tab-button ${activeTab === 'orders' ? 'revenue-active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            📋 Order Details
          </button>
          <button 
            className={`revenue-tab-button ${activeTab === 'restaurants' ? 'revenue-active' : ''}`}
            onClick={() => setActiveTab('restaurants')}
          >
            🏪 Restaurant Revenue
          </button>
          <button 
            className={`revenue-tab-button ${activeTab === 'categories' ? 'revenue-active' : ''}`}
            onClick={() => setActiveTab('categories')}
          >
            📊 Category Revenue
          </button>
        </div>

        {/* Content Area */}
        <div className="revenue-tab-content">
          {activeTab === 'orders' && (
            <div className="revenue-orders-section">
              <h2>Order Details - {getTamilNaduDay(selectedDate)}</h2>
              
              {revenueData.length === 0 ? (
                <div className="revenue-no-orders">
                  <p>No orders found for selected date</p>
                </div>
              ) : (
                renderOrdersTable()
              )}
            </div>
          )}

          {activeTab === 'restaurants' && (
            <div className="revenue-section">
              <h2>Restaurant Revenue - {getTamilNaduDay(selectedDate)}</h2>
              
              {restaurantRevenue.length === 0 ? (
                <div className="revenue-no-data">
                  <p>No restaurant data found for selected date</p>
                </div>
              ) : (
                renderRestaurantsTable()
              )}
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="revenue-section">
              <h2>Category Revenue - {getTamilNaduDay(selectedDate)}</h2>
              
              {categoryRevenue.length === 0 ? (
                <div className="revenue-no-data">
                  <p>No category data found for selected date</p>
                </div>
              ) : (
                renderCategoriesTable()
              )}
            </div>
          )}
        </div>

        {/* Summary Section */}
        {revenueData.length > 0 && (
          <div className="revenue-summary-section">
            <h3>Daily Summary - {getTamilNaduDay(selectedDate)}</h3>
            <div className="revenue-summary-grid">
              <div className="revenue-summary-item">
                <span>Total Orders:</span>
                <strong>{stats.totalOrders}</strong>
              </div>
              <div className="revenue-summary-item">
                <span>Product Revenue:</span>
                <strong>{formatCurrency(stats.totalRevenueWithoutDelivery)}</strong>
              </div>
              <div className="revenue-summary-item">
                <span>Delivery Charges:</span>
                <strong>{formatCurrency(stats.deliveryChargesTotal)}</strong>
              </div>
              <div className="revenue-summary-item">
                <span>Total Revenue:</span>
                <strong>{formatCurrency(stats.totalRevenue)}</strong>
              </div>
              <div className="revenue-summary-item">
                <span>Food Orders:</span>
                <strong>{revenueData.filter(order => order.isFoodOrder).length}</strong>
              </div>
              <div className="revenue-summary-item">
                <span>Product Orders:</span>
                <strong>{revenueData.filter(order => !order.isFoodOrder).length}</strong>
              </div>
              <div className="revenue-summary-item">
                <span>Delivery Success Rate:</span>
                <strong>
                  {stats.totalOrders > 0 
                    ? `${Math.round((stats.deliveredOrders / stats.totalOrders) * 100)}%`
                    : '0%'
                  }
                </strong>
              </div>
            </div>
          </div>
        )}

        {/* Items Modal */}
        {showItemsModal && <ItemsModal />}
      </div>
    </>
  );
};

export default DaybyDayRevenue;