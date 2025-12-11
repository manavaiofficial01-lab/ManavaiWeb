import React, { useState, useEffect } from 'react'
import Navbar from '../Navbar/Navbar'
import { supabase } from '../../../supabase';
import "./DaybyDayRevenue.css"

const DaybyDayRevenue = () => {
  const [profitData, setProfitData] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0, // This is total_amount from all orders
    totalOrderAmountWithoutDelivery: 0, // Sum of item prices only
    totalDeliveryCharges: 0,
    totalDriverEarnings: 0,
    totalAdminEarnings: 0,
    totalCompanyProfit: 0,
    totalOverallProfit: 0,
    deliveredOrders: 0,
    foodOrders: 0,
    productOrders: 0,
    totalItemsSold: 0
  });
  const [restaurantProfit, setRestaurantProfit] = useState([]);
  const [categoryProfit, setCategoryProfit] = useState([]);
  const [activeTab, setActiveTab] = useState('orders');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [foodItemsCache, setFoodItemsCache] = useState(new Map());
  const [productsCache, setProductsCache] = useState(new Map());

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
      fetchProfitData();
    }
  }, [selectedDate]);

  // Get IST date from UTC timestamp
  const getISTDate = (utcDateString) => {
    try {
      const date = new Date(utcDateString);
      if (isNaN(date.getTime())) {
        return null;
      }
      
      const istDateString = date.toLocaleDateString('en-CA', {
        timeZone: 'Asia/Kolkata'
      });
      
      return istDateString;
    } catch (error) {
      console.error('Error converting to IST date:', error);
      return null;
    }
  };

  // Tamil Nadu timezone formatting
  const getTamilNaduTime = (dateString) => {
    try {
      const date = new Date(dateString);
      
      if (isNaN(date.getTime())) {
        return {
          time: 'Invalid Time',
          date: 'Invalid Date',
          fullDateTime: 'Invalid DateTime'
        };
      }
      
      const timeOptions = {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      };
      
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Fetch food items profit data
  const fetchFoodItems = async () => {
    try {
      const { data, error } = await supabase
        .from('food_items')
        .select('id, price, profit, restaurant_name, category, name')
        .not('profit', 'is', null);

      if (error) throw error;

      const foodItemsMap = new Map();
      data?.forEach(item => {
        const price = parseFloat(item.price) || 0;
        const companyProfit = parseFloat(item.profit) || 0; // This is COMPANY earnings (from profit field)
        const restaurantEarnings = price - companyProfit; // This is RESTAURANT earnings
        
        foodItemsMap.set(item.id, {
          id: item.id,
          name: item.name,
          price: price,
          companyProfit: companyProfit, // Company earnings (from profit field)
          restaurantEarnings: restaurantEarnings, // Restaurant earnings = price - companyProfit
          restaurant_name: item.restaurant_name,
          category: item.category
        });
      });

      setFoodItemsCache(foodItemsMap);
      return foodItemsMap;
    } catch (error) {
      console.error('Error fetching food items:', error);
      return new Map();
    }
  };

  // Fetch products profit data
  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, profit, category, brand')
        .not('profit', 'is', null);

      if (error) throw error;

      const productsMap = new Map();
      data?.forEach(product => {
        const price = parseFloat(product.price) || 0;
        const companyProfit = parseFloat(product.profit) || 0; // This is COMPANY earnings
        const costOrMargin = price - companyProfit; // This is cost/margin
        
        productsMap.set(product.id, {
          id: product.id,
          name: product.name,
          price: price,
          companyProfit: companyProfit, // Company earnings
          costOrMargin: costOrMargin, // Cost or margin
          category: product.category,
          brand: product.brand
        });
      });

      setProductsCache(productsMap);
      return productsMap;
    } catch (error) {
      console.error('Error fetching products:', error);
      return new Map();
    }
  };

  // Calculate company profit for food items with quantity
  const calculateFoodItemCompanyProfit = (item, foodItemsMap) => {
    if (!item.product_id || !foodItemsMap.has(item.product_id)) {
      return 0;
    }
    
    const foodItem = foodItemsMap.get(item.product_id);
    const quantity = parseInt(item.quantity) || 1;
    
    // Company profit = profit_field_value × quantity
    return foodItem.companyProfit * quantity;
  };

  // Calculate company profit for products with quantity
  const calculateProductCompanyProfit = (item, productsMap) => {
    if (!item.product_id || !productsMap.has(item.product_id)) {
      return 0;
    }
    
    const product = productsMap.get(item.product_id);
    const quantity = parseInt(item.quantity) || 1;
    
    // Company profit = profit_field_value × quantity
    return product.companyProfit * quantity;
  };

  // Calculate admin earnings
  const calculateAdminEarnings = (deliveryCharges, driverEarnings) => {
    const delivery = parseFloat(deliveryCharges) || 0;
    const driver = parseFloat(driverEarnings) || 0;
    return Math.max(delivery - driver, 0);
  };

  // Calculate total items count for an order
  const calculateTotalItemsCount = (items) => {
    return items.reduce((total, item) => total + (parseInt(item.quantity) || 1), 0);
  };

  // Calculate total items amount (sum of item prices × quantities)
  const calculateTotalItemsAmount = (items) => {
    return items.reduce((total, item) => {
      const price = parseFloat(item.price) || 0;
      const quantity = parseInt(item.quantity) || 1;
      return total + (price * quantity);
    }, 0);
  };

  const fetchProfitData = async () => {
    if (!selectedDate) return;
    
    try {
      setLoading(true);
      
      // Fetch both food items and products in parallel
      const [foodItemsMap, productsMap] = await Promise.all([
        fetchFoodItems(),
        fetchProducts()
      ]);
      
      // Get orders for the selected date (3-day window for timezone safety)
      const startDate = new Date(selectedDate);
      startDate.setDate(startDate.getDate() - 1);
      
      const endDate = new Date(selectedDate);
      endDate.setDate(endDate.getDate() + 2);

      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (orders) {
        // Filter orders by IST date and delivered status
        const filteredOrders = orders.filter(order => {
          const istDate = getISTDate(order.created_at);
          return istDate === selectedDate && order.status === 'delivered';
        });
        
        processProfitData(filteredOrders, foodItemsMap, productsMap);
      } else {
        processProfitData([], foodItemsMap, productsMap);
      }
    } catch (error) {
      console.error('Error fetching profit data:', error);
      processProfitData([], new Map(), new Map());
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

  const processProfitData = (orders, foodItemsMap, productsMap) => {
    let totalRevenue = 0; // Sum of total_amount from all orders
    let totalOrderAmountWithoutDelivery = 0; // Sum of item prices only
    let totalDeliveryCharges = 0;
    let totalDriverEarnings = 0;
    let totalAdminEarnings = 0;
    let totalCompanyProfit = 0;
    let deliveredOrders = 0;
    let foodOrders = 0;
    let productOrders = 0;
    let totalItemsSold = 0;
    
    const restaurantMap = new Map();
    const categoryMap = new Map();

    const processedOrders = orders.map(order => {
      const isFoodOrder = order.order_type === 'food';
      const orderAmount = parseFloat(order.total_amount) || 0; // This already includes delivery charges
      const deliveryCharges = parseFloat(order.delivery_charges) || 0;
      const driverEarnings = parseFloat(order.driver_order_earnings) || 0;
      
      // Revenue = total_amount (which already includes delivery)
      const orderRevenue = orderAmount;
      
      // Calculate admin earnings from delivery
      const adminEarnings = calculateAdminEarnings(deliveryCharges, driverEarnings);
      
      // Parse order items
      const items = safeJsonParse(order.items);
      const orderItemsCount = calculateTotalItemsCount(items);
      const itemsTotalAmount = calculateTotalItemsAmount(items); // Sum of item prices × quantities
      
      // Calculate company profit from items
      let orderCompanyProfit = 0;
      let itemsWithProfit = [];
      
      items.forEach(item => {
        const quantity = parseInt(item.quantity) || 1;
        let itemCompanyProfit = 0;
        let itemDetails = null;
        
        if (isFoodOrder) {
          itemCompanyProfit = calculateFoodItemCompanyProfit(item, foodItemsMap);
          
          if (foodItemsMap.has(item.product_id)) {
            itemDetails = foodItemsMap.get(item.product_id);
          }
        } else {
          itemCompanyProfit = calculateProductCompanyProfit(item, productsMap);
          
          if (productsMap.has(item.product_id)) {
            itemDetails = productsMap.get(item.product_id);
          }
        }
        
        orderCompanyProfit += itemCompanyProfit;
        
        itemsWithProfit.push({
          ...item,
          quantity: quantity,
          totalPrice: (parseFloat(item.price) || 0) * quantity,
          companyProfit: itemCompanyProfit,
          itemDetails: itemDetails
        });
      });
      
      // Total order profit = company profit + admin earnings
      const totalOrderProfit = orderCompanyProfit + adminEarnings;
      
      // Add to totals
      totalRevenue += orderRevenue;
      totalOrderAmountWithoutDelivery += itemsTotalAmount; // Sum of item prices only
      totalDeliveryCharges += deliveryCharges;
      totalDriverEarnings += driverEarnings;
      totalAdminEarnings += adminEarnings;
      totalCompanyProfit += orderCompanyProfit;
      totalItemsSold += orderItemsCount;
      deliveredOrders++;
      
      if (isFoodOrder) {
        foodOrders++;
      } else {
        productOrders++;
      }

      // Restaurant profit calculation
      if (isFoodOrder && order.restaurant_name) {
        const currentRestaurant = restaurantMap.get(order.restaurant_name) || {
          name: order.restaurant_name,
          revenue: 0,
          itemsAmount: 0, // Sum of item prices
          deliveryCharges: 0,
          driverEarnings: 0,
          adminEarnings: 0,
          companyProfit: 0,
          totalProfit: 0,
          orders: 0,
          items: 0,
          totalQuantity: 0
        };
        
        currentRestaurant.revenue += orderRevenue;
        currentRestaurant.itemsAmount += itemsTotalAmount;
        currentRestaurant.deliveryCharges += deliveryCharges;
        currentRestaurant.driverEarnings += driverEarnings;
        currentRestaurant.adminEarnings += adminEarnings;
        currentRestaurant.companyProfit += orderCompanyProfit;
        currentRestaurant.totalProfit += totalOrderProfit;
        currentRestaurant.orders += 1;
        currentRestaurant.items += items.length;
        currentRestaurant.totalQuantity += orderItemsCount;
        
        restaurantMap.set(order.restaurant_name, currentRestaurant);
      }

      // Category profit calculation
      const category = order.category || (isFoodOrder && items[0]?.category) || 'Uncategorized';
      const currentCategory = categoryMap.get(category) || {
        name: category,
        revenue: 0,
        itemsAmount: 0,
        deliveryCharges: 0,
        driverEarnings: 0,
        adminEarnings: 0,
        companyProfit: 0,
        totalProfit: 0,
        orders: 0,
        items: 0,
        totalQuantity: 0,
        orderType: isFoodOrder ? 'Food' : 'Product'
      };
      
      currentCategory.revenue += orderRevenue;
      currentCategory.itemsAmount += itemsTotalAmount;
      currentCategory.deliveryCharges += deliveryCharges;
      currentCategory.driverEarnings += driverEarnings;
      currentCategory.adminEarnings += adminEarnings;
      currentCategory.companyProfit += orderCompanyProfit;
      currentCategory.totalProfit += totalOrderProfit;
      currentCategory.orders += 1;
      currentCategory.items += items.length;
      currentCategory.totalQuantity += orderItemsCount;
      
      categoryMap.set(category, currentCategory);

      // Get Tamil Nadu time for the order
      const tamilNaduTime = getTamilNaduTime(order.created_at);

      return {
        ...order,
        items: itemsWithProfit,
        orderRevenue,
        itemsTotalAmount, // NEW: Total of item prices only
        deliveryCharges,
        driverEarnings,
        adminEarnings,
        companyProfit: orderCompanyProfit,
        totalOrderProfit,
        itemsCount: orderItemsCount,
        formattedTime: tamilNaduTime.time,
        formattedDate: tamilNaduTime.date,
        fullDateTime: tamilNaduTime.fullDateTime,
        isFoodOrder
      };
    });

    // Calculate overall profit
    const totalOverallProfit = totalCompanyProfit + totalAdminEarnings;

    const restaurantArray = Array.from(restaurantMap.values())
      .sort((a, b) => b.totalProfit - a.totalProfit);
    
    const categoryArray = Array.from(categoryMap.values())
      .sort((a, b) => b.totalProfit - a.totalProfit);

    setProfitData(processedOrders);
    setRestaurantProfit(restaurantArray);
    setCategoryProfit(categoryArray);
    setStats({
      totalRevenue,
      totalOrderAmountWithoutDelivery,
      totalDeliveryCharges,
      totalDriverEarnings,
      totalAdminEarnings,
      totalCompanyProfit,
      totalOverallProfit,
      deliveredOrders,
      foodOrders,
      productOrders,
      totalItemsSold
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

    const totalItemsQuantity = selectedOrder.items.reduce((sum, item) => sum + item.quantity, 0);
    const itemsTotal = selectedOrder.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalCompanyProfit = selectedOrder.items.reduce((sum, item) => sum + item.companyProfit, 0);

    return (
      <div className="profit-modal-overlay" onClick={closeItemsModal}>
        <div className="profit-modal" onClick={(e) => e.stopPropagation()}>
          <div className="profit-modal-header">
            <button className="profit-modal-close" onClick={closeItemsModal}>×</button>
            <h3>Order Items - #{selectedOrder.receipt_reference}</h3>
            <p>
              {selectedOrder.customer_name} • {selectedOrder.customer_phone} • 
              {selectedOrder.isFoodOrder ? ' 🍕 Food' : ' 📦 Product'}
            </p>
            <p style={{fontSize: '0.8rem', margin: '4px 0 0 0', color: '#475569'}}>
              📅 {selectedOrder.fullDateTime} IST
            </p>
          </div>
          
          <div className="profit-modal-body">
            <div className="profit-modal-items">
              {selectedOrder.items.map((item, index) => (
                <div key={index} className="profit-modal-item">
                  <img 
                    src={item.product_image || '/placeholder-image.jpg'} 
                    alt={item.product_name}
                    className="profit-modal-item-image"
                    onError={(e) => {
                      e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0zMCAzN0MzMy4zMTM3IDM3IDM2IDM0LjMxMzcgMzYgMzFDMzYgMjcuNjg2MyAzMy4zMTM3IDI1IDMwIDI1QzI2LjY4NjMgMjUgMjQgMjcuNjg2MyAyNCAzMUMyNCAzNC4zMTM3IDI2LjY4NjMgMzcgMzAgMzdaIiBmaWxsPSIjOTRBMUI2Ii8+CjxwYXRoIGQ9Ik0zNi41IDQySDE5LjVDMTguMTE5MyA0MiAxNyA0MC44ODA3IDE3IDM5LjVWMTkuNUMxNyAxOC4xMTkzIDE4LjExOTMgMTcgMTkuNSAxN0g0MC41QzQxLjg4MDcgMTcgNDMgMTguMTE5MyA0MyAxOS41VjM5LjVDNDMgNDAuODgwNyA0MS44ODA3IDQyIDQwLjUgNDJIMzYuNVpNMzkuNSAzOS41VjI0LjI1TDMxLjM2NiAzMi4zODZDMzAuOTg3NSAzMi43NjQ1IDMwLjQxMjUgMzIuNzY0NSAzMC4wMzQgMzIuMzg2TDI2LjI1IDI4LjYwMkwyMC41IDM0LjM1MlYzOS41SDM5LjVaTTI0IDI0LjVDMjQgMjUuODgwNyAyMi44ODA3IDI3IDIxLjUgMjdDMjAuMTE5MyAyNyAxOSAyNS44ODA3IDE5IDI0LjVDMTkgMjMuMTE5MyAyMC4xMTkzIDIyIDIxLjUgMjJDMjIuODgwNyAyMiAyNCAyMy4xOTkzIDI0IDI0LjVaIiBmaWxsPSIjOTRBMUI2Ii8+Cjwvc3ZnPgo=';
                    }}
                  />
                  <div className="profit-modal-item-details">
                    <div className="profit-modal-item-name">
                      {item.product_name}
                      <small style={{display: 'block', color: '#64748b', fontSize: '0.75rem'}}>
                        Quantity: {item.quantity}
                      </small>
                    </div>
                    <div className="profit-modal-item-info">
                      <span className="profit-modal-item-price">
                        Unit Price: {formatCurrency(item.price || 0)}
                      </span>
                      <span className="profit-modal-item-total">
                        Total: {formatCurrency(item.totalPrice)}
                      </span>
                      {item.restaurant_name && (
                        <span className="profit-modal-item-restaurant">
                          🏪 {item.restaurant_name}
                        </span>
                      )}
                      {item.itemDetails && (
                        <>
                          <span className="profit-modal-item-profit-details">
                            Price: {formatCurrency(item.itemDetails.price)} | 
                            Company: {formatCurrency(item.itemDetails.companyProfit)} | 
                            Restaurant: {formatCurrency(item.itemDetails.restaurantEarnings || item.itemDetails.costOrMargin)} per item
                          </span>
                          <span className="profit-modal-item-company-profit profit-positive">
                            Company Profit: {formatCurrency(item.companyProfit)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="profit-modal-footer">
            <div className="profit-modal-total">
              <span>Order Summary:</span>
            </div>
            <div className="profit-modal-total">
              <span>Items ({totalItemsQuantity} units):</span>
              <span className="profit-modal-total-amount">
                {formatCurrency(itemsTotal)}
              </span>
            </div>
            <div className="profit-modal-total">
              <span>Delivery Charges:</span>
              <span className="profit-modal-total-amount">
                +{formatCurrency(selectedOrder.deliveryCharges)}
              </span>
            </div>
            <div className="profit-modal-total">
              <span>Order Total (Revenue):</span>
              <span className="profit-modal-total-amount">
                {formatCurrency(selectedOrder.orderRevenue)}
              </span>
            </div>
            <div className="profit-modal-total" style={{borderTop: '1px solid #e2e8f0', paddingTop: '8px'}}>
              <span>Driver Earnings:</span>
              <span className="profit-modal-total-amount">
                -{formatCurrency(selectedOrder.driverEarnings)}
              </span>
            </div>
            <div className="profit-modal-total">
              <span>Admin Delivery Earnings:</span>
              <span className="profit-modal-total-amount profit-positive">
                +{formatCurrency(selectedOrder.adminEarnings)}
              </span>
            </div>
            <div className="profit-modal-total">
              <span>Company Profit from Items:</span>
              <span className="profit-modal-total-amount profit-positive">
                +{formatCurrency(totalCompanyProfit)}
              </span>
            </div>
            <div className="profit-modal-total" style={{borderTop: '2px solid #e2e8f0', paddingTop: '12px', fontWeight: 'bold'}}>
              <span>Total Order Profit:</span>
              <span className="profit-modal-total-amount profit-total">
                {formatCurrency(selectedOrder.totalOrderProfit)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderOrdersTable = () => (
    <div className="profit-orders-table-container">
      <table className="profit-orders-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Time (IST)</th>
            <th>Customer</th>
            <th>Type</th>
            <th>Items</th>
            <th>Items Amount</th> {/* Changed from Order Amount */}
            <th>Delivery</th>
            <th>Revenue</th> {/* This is total_amount from order table */}
            <th>Driver</th>
            <th>Admin</th>
            <th>Company</th>
            <th>Total Profit</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {profitData.map((order) => (
            <tr key={order.id}>
              <td className="profit-order-id">#{order.receipt_reference}</td>
              <td className="profit-order-time">
                <div>{order.formattedTime}</div>
                <small>{order.formattedDate}</small>
              </td>
              <td className="profit-customer-info">
                <strong>{order.customer_name}</strong>
                <small>{order.customer_phone}</small>
              </td>
              <td>
                <span className={`profit-order-type-badge ${order.isFoodOrder ? 'profit-food' : 'profit-product'}`}>
                  {order.isFoodOrder ? '🍕 Food' : '📦 Product'}
                </span>
              </td>
              <td className="profit-order-items">
                <div 
                  className="profit-items-preview"
                  onClick={() => handleViewItems(order)}
                >
                  <div className="profit-items-preview-content">
                    <span className="profit-items-preview-count">
                      {order.itemsCount} unit{order.itemsCount !== 1 ? 's' : ''}
                      <small style={{display: 'block', fontSize: '0.75rem', color: '#64748b'}}>
                        ({order.items.length} item{order.items.length !== 1 ? 's' : ''})
                      </small>
                    </span>
                    View Details
                  </div>
                </div>
              </td>
              <td className="profit-items-amount">{formatCurrency(order.itemsTotalAmount)}</td> {/* Items Amount */}
              <td className="profit-delivery-charges">{formatCurrency(order.deliveryCharges)}</td>
              <td className="profit-revenue">{formatCurrency(order.orderRevenue)}</td> {/* Total Revenue */}
              <td className="profit-driver-earnings">-{formatCurrency(order.driverEarnings)}</td>
              <td className="profit-admin-earnings profit-positive">
                +{formatCurrency(order.adminEarnings)}
              </td>
              <td className="profit-company-profit profit-positive">
                +{formatCurrency(order.companyProfit)}
              </td>
              <td className="profit-total-profit profit-total">
                <strong>{formatCurrency(order.totalOrderProfit)}</strong>
              </td>
              <td>
                <span 
                  className="profit-status-badge"
                  style={{ backgroundColor: getStatusColor(order.status) }}
                >
                  {order.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderRestaurantsTable = () => (
    <div className="profit-table-container">
      <table className="profit-table">
        <thead>
          <tr>
            <th>Restaurant</th>
            <th>Orders</th>
            <th>Units Sold</th>
            <th>Items Amount</th>
            <th>Delivery</th>
            <th>Revenue</th>
            <th>Driver</th>
            <th>Admin</th>
            <th>Company Profit</th>
            <th>Total Profit</th>
            <th>Avg/Order</th>
          </tr>
        </thead>
        <tbody>
          {restaurantProfit.map((restaurant, index) => (
            <tr key={restaurant.name}>
              <td className="profit-name-cell">
                <span className="profit-rank-badge">{index + 1}</span>
                {restaurant.name}
              </td>
              <td className="profit-orders-cell">{restaurant.orders}</td>
              <td className="profit-quantity-cell">{restaurant.totalQuantity}</td>
              <td className="profit-items-amount-cell">{formatCurrency(restaurant.itemsAmount)}</td>
              <td className="profit-delivery-cell">{formatCurrency(restaurant.deliveryCharges)}</td>
              <td className="profit-revenue-cell">{formatCurrency(restaurant.revenue)}</td>
              <td className="profit-driver-cell">-{formatCurrency(restaurant.driverEarnings)}</td>
              <td className="profit-admin-cell profit-positive">
                +{formatCurrency(restaurant.adminEarnings)}
              </td>
              <td className="profit-company-profit-cell profit-positive">
                +{formatCurrency(restaurant.companyProfit)}
              </td>
              <td className="profit-total-cell profit-total">
                <strong>{formatCurrency(restaurant.totalProfit)}</strong>
              </td>
              <td className="profit-per-order-cell">
                {formatCurrency(restaurant.totalProfit / restaurant.orders)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderCategoriesTable = () => (
    <div className="profit-table-container">
      <table className="profit-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Type</th>
            <th>Orders</th>
            <th>Units Sold</th>
            <th>Items Amount</th>
            <th>Delivery</th>
            <th>Revenue</th>
            <th>Driver</th>
            <th>Admin</th>
            <th>Company Profit</th>
            <th>Total Profit</th>
            <th>Performance</th>
          </tr>
        </thead>
        <tbody>
          {categoryProfit.map((category, index) => (
            <tr key={category.name}>
              <td className="profit-name-cell">
                <span className="profit-rank-badge">{index + 1}</span>
                {category.name}
              </td>
              <td>
                <span className={`profit-type-badge ${category.orderType.toLowerCase()}`}>
                  {category.orderType}
                </span>
              </td>
              <td className="profit-orders-cell">{category.orders}</td>
              <td className="profit-quantity-cell">{category.totalQuantity}</td>
              <td className="profit-items-amount-cell">{formatCurrency(category.itemsAmount)}</td>
              <td className="profit-delivery-cell">{formatCurrency(category.deliveryCharges)}</td>
              <td className="profit-revenue-cell">{formatCurrency(category.revenue)}</td>
              <td className="profit-driver-cell">-{formatCurrency(category.driverEarnings)}</td>
              <td className="profit-admin-cell profit-positive">
                +{formatCurrency(category.adminEarnings)}
              </td>
              <td className="profit-company-profit-cell profit-positive">
                +{formatCurrency(category.companyProfit)}
              </td>
              <td className="profit-total-cell profit-total">
                <strong>{formatCurrency(category.totalProfit)}</strong>
              </td>
              <td className="profit-performance-cell">
                <div className="profit-performance-bar">
                  <div 
                    className="profit-performance-fill"
                    style={{ 
                      width: `${Math.min((category.totalProfit / stats.totalOverallProfit) * 100, 100)}%`
                    }}
                  ></div>
                </div>
                <span>{((category.totalProfit / stats.totalOverallProfit) * 100).toFixed(1)}%</span>
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
        <div className="profit-loading">
          <div className="profit-loading-spinner"></div>
          <p>Loading profit data...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="profit-container">
        {/* Header */}
        <div className="profit-header">
          <h1>Daily Profit Dashboard</h1>
          <div className="profit-date-selector">
            <label htmlFor="profit-date-picker">Select Date:</label>
            <input
              id="profit-date-picker"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="profit-date-input"
            />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="profit-stats-grid">
          <div className="profit-stat-card profit-total-revenue">
            <div className="profit-stat-icon">💰</div>
            <div className="profit-stat-info">
              <h3>Total Revenue</h3>
              <p className="profit-stat-value">{formatCurrency(stats.totalRevenue)}</p>
              <small>
                {stats.deliveredOrders} orders, {stats.totalItemsSold} units sold
              </small>
            </div>
          </div>

          <div className="profit-stat-card profit-items-amount">
            <div className="profit-stat-icon">🛒</div>
            <div className="profit-stat-info">
              <h3>Items Amount</h3>
              <p className="profit-stat-value">{formatCurrency(stats.totalOrderAmountWithoutDelivery)}</p>
              <small>
                Sum of item prices only (without delivery)
              </small>
            </div>
          </div>

          <div className="profit-stat-card profit-delivery-collected">
            <div className="profit-stat-icon">🚚</div>
            <div className="profit-stat-info">
              <h3>Delivery Charges</h3>
              <p className="profit-stat-value">{formatCurrency(stats.totalDeliveryCharges)}</p>
              <small>
                Total delivery fees collected
              </small>
            </div>
          </div>

          <div className="profit-stat-card profit-total-profit">
            <div className="profit-stat-icon">📈</div>
            <div className="profit-stat-info">
              <h3>Total Profit</h3>
              <p className="profit-stat-value">{formatCurrency(stats.totalOverallProfit)}</p>
              <small>
                {formatCurrency(stats.totalCompanyProfit)} company + {' '}
                {formatCurrency(stats.totalAdminEarnings)} admin
              </small>
            </div>
          </div>

          <div className="profit-stat-card profit-admin-earnings">
            <div className="profit-stat-icon">🏢</div>
            <div className="profit-stat-info">
              <h3>Admin Earnings</h3>
              <p className="profit-stat-value profit-positive">{formatCurrency(stats.totalAdminEarnings)}</p>
              <small>
                {formatCurrency(stats.totalDeliveryCharges)} collected - {' '}
                {formatCurrency(stats.totalDriverEarnings)} driver payments
              </small>
            </div>
          </div>

          <div className="profit-stat-card profit-company-profit">
            <div className="profit-stat-icon">📊</div>
            <div className="profit-stat-info">
              <h3>Company Profit</h3>
              <p className="profit-stat-value profit-positive">
                {formatCurrency(stats.totalCompanyProfit)}
              </p>
              <small>
                Sum of "Profit" field × Quantity from all items
              </small>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="profit-tabs-navigation">
          <button 
            className={`profit-tab-button ${activeTab === 'orders' ? 'profit-active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            📋 Order Profits ({profitData.length})
          </button>
          <button 
            className={`profit-tab-button ${activeTab === 'restaurants' ? 'profit-active' : ''}`}
            onClick={() => setActiveTab('restaurants')}
          >
            🏪 Restaurant Profits ({restaurantProfit.length})
          </button>
          <button 
            className={`profit-tab-button ${activeTab === 'categories' ? 'profit-active' : ''}`}
            onClick={() => setActiveTab('categories')}
          >
            📊 Category Profits ({categoryProfit.length})
          </button>
        </div>

        {/* Content Area */}
        <div className="profit-tab-content">
          {activeTab === 'orders' && (
            <div className="profit-orders-section">
              <h2>Order Profits - {getTamilNaduDay(selectedDate)}</h2>
              
              {profitData.length === 0 ? (
                <div className="profit-no-orders">
                  <p>No delivered orders found for selected date</p>
                </div>
              ) : (
                renderOrdersTable()
              )}
            </div>
          )}

          {activeTab === 'restaurants' && (
            <div className="profit-section">
              <h2>Restaurant Profits - {getTamilNaduDay(selectedDate)}</h2>
              
              {restaurantProfit.length === 0 ? (
                <div className="profit-no-data">
                  <p>No restaurant profit data found for delivered orders on selected date</p>
                </div>
              ) : (
                renderRestaurantsTable()
              )}
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="profit-section">
              <h2>Category Profits - {getTamilNaduDay(selectedDate)}</h2>
              
              {categoryProfit.length === 0 ? (
                <div className="profit-no-data">
                  <p>No category profit data found for delivered orders on selected date</p>
                </div>
              ) : (
                renderCategoriesTable()
              )}
            </div>
          )}
        </div>

        {/* Summary Section */}
        {profitData.length > 0 && (
          <div className="profit-summary-section">
            <h3>Profit Summary - {getTamilNaduDay(selectedDate)}</h3>
            <div className="profit-summary-grid">
              <div className="profit-summary-item">
                <span>Total Delivered Orders:</span>
                <strong>{stats.deliveredOrders}</strong>
              </div>
              <div className="profit-summary-item">
                <span>Total Units Sold:</span>
                <strong>{stats.totalItemsSold}</strong>
              </div>
              <div className="profit-summary-item">
                <span>Food Orders:</span>
                <strong>{stats.foodOrders}</strong>
              </div>
              <div className="profit-summary-item">
                <span>Product Orders:</span>
                <strong>{stats.productOrders}</strong>
              </div>
              <div className="profit-summary-item">
                <span>Items Amount (Without Delivery):</span>
                <strong>{formatCurrency(stats.totalOrderAmountWithoutDelivery)}</strong>
              </div>
              <div className="profit-summary-item">
                <span>Delivery Charges Collected:</span>
                <strong>{formatCurrency(stats.totalDeliveryCharges)}</strong>
              </div>
              <div className="profit-summary-item">
                <span>Total Revenue (Amount + Delivery):</span>
                <strong>{formatCurrency(stats.totalRevenue)}</strong>
              </div>
              <div className="profit-summary-item">
                <span>Driver Earnings Paid:</span>
                <strong>-{formatCurrency(stats.totalDriverEarnings)}</strong>
              </div>
              <div className="profit-summary-item">
                <span>Admin Earnings:</span>
                <strong className="profit-positive">{formatCurrency(stats.totalAdminEarnings)}</strong>
              </div>
              <div className="profit-summary-item">
                <span>Company Profit from Items:</span>
                <strong className="profit-positive">{formatCurrency(stats.totalCompanyProfit)}</strong>
              </div>
              <div className="profit-summary-item">
                <span>Total Overall Profit:</span>
                <strong className="profit-total">{formatCurrency(stats.totalOverallProfit)}</strong>
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