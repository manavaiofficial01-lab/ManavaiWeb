import React, { useState, useEffect } from 'react';
import { supabase } from "../../../supabase";
import Navbar from '../Navbar/Navbar';
import "./FoodManagement.css";

const FoodManagement = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [foodItems, setFoodItems] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingFood, setEditingFood] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [activeTab, setActiveTab] = useState('restaurants');

  // Predefined categories
  const foodCategories = [
    "Biryani", "Pizza", "Burger", "Fried Chicken", "Mutton","Chicken", "Sea Foods", "South Indian", "Dosa", "Parotta", "Fried Rice", "Naan & Gravy", "Noodles", "Veg", "Rolls", "Soup", "Tea", "Coffee", "Shakes", "Mojito", "Cake's","Ice Cream","Fresh Juice"
  ];

  // Fetch restaurants
  const fetchRestaurants = async () => {
    try {
      setLoading(true);
      setError('');

      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .order('name');

      if (error) throw error;

      setRestaurants(data || []);
    } catch (error) {
      console.error('Error fetching restaurants:', error);
      setError('Failed to load restaurants');
    } finally {
      setLoading(false);
    }
  };

  // Fetch food items by restaurant
  const fetchFoodItemsByRestaurant = async (restaurant) => {
    try {
      setLoading(true);
      setError('');

      const { data, error } = await supabase
        .from('food_items')
        .select('*')
        .eq('restaurant_name', restaurant.name)
        .order('food_position')
        .order('name');

      if (error) throw error;

      setFoodItems(data || []);
    } catch (error) {
      console.error('Error fetching food items:', error);
      setError('Failed to load food items');
    } finally {
      setLoading(false);
    }
  };

  // Update food item
  const updateFoodItem = async (foodItem) => {
    try {
      setLoading(true);
      setError('');

      const { data, error } = await supabase
        .from('food_items')
        .update({
          name: foodItem.name,
          price: foodItem.price,
          original_price: foodItem.original_price,
          category: foodItem.category,
          rating: foodItem.rating,
          review_count: foodItem.review_count,
          veg: foodItem.veg,
          popular: foodItem.popular,
          bestseller: foodItem.bestseller,
          calories: foodItem.calories,
          prep_time: foodItem.prep_time,
          profit: foodItem.profit,
          food_position: foodItem.food_position,
          updated_at: new Date().toISOString()
        })
        .eq('id', foodItem.id)
        .select();

      if (error) throw error;

      return data?.[0];
    } catch (error) {
      console.error('Error updating food item:', error);
      setError('Failed to update food item');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Delete food item
  const deleteFoodItem = async (foodId) => {
    try {
      setLoading(true);
      setError('');

      const { error } = await supabase
        .from('food_items')
        .delete()
        .eq('id', foodId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error deleting food item:', error);
      setError('Failed to delete food item');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = async (foodId) => {
    try {
      await deleteFoodItem(foodId);
      setFoodItems(prevItems =>
        prevItems.filter(item => item.id !== foodId)
      );
      setDeleteConfirm(null);
    } catch (error) {
      // Error is handled in deleteFoodItem function
    }
  };

  const startDeleteConfirm = (foodItem) => {
    setDeleteConfirm(foodItem);
  };

  const cancelDeleteConfirm = () => {
    setDeleteConfirm(null);
  };

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const handleRestaurantClick = (restaurant) => {
    setSelectedRestaurant(restaurant);
    fetchFoodItemsByRestaurant(restaurant);
    setActiveTab('foodItems');
  };

  const handleBackToRestaurants = () => {
    setSelectedRestaurant(null);
    setFoodItems([]);
    setSearchTerm('');
    setActiveTab('restaurants');
  };

  const handleEditClick = (foodItem) => {
    setEditingFood({ ...foodItem });
    setDeleteConfirm(null);
  };

  const handleSaveClick = async () => {
    if (!editingFood) return;

    try {
      const updatedFood = await updateFoodItem(editingFood);

      if (updatedFood) {
        setFoodItems(prevItems =>
          prevItems.map(item =>
            item.id === updatedFood.id ? updatedFood : item
          )
        );
        setEditingFood(null);
      }
    } catch (error) {
      // Error is handled in updateFoodItem function
    }
  };

  const handleCancelClick = () => {
    setEditingFood(null);
  };

  const handleFieldChange = (field, value) => {
    if (editingFood) {
      setEditingFood(prev => ({
        ...prev,
        [field]: field === 'price' || field === 'original_price' || field === 'profit' || field === 'rating'
          ? parseFloat(value) || 0
          : field === 'review_count' || field === 'calories' || field === 'food_position'
            ? parseInt(value) || 0
            : field === 'veg' || field === 'popular' || field === 'bestseller'
              ? Boolean(value)
              : value
      }));
    }
  };

  const toggleFoodStatus = async (foodItem, field) => {
    try {
      setLoading(true);

      const updatedFood = { ...foodItem, [field]: !foodItem[field] };
      const result = await updateFoodItem(updatedFood);

      if (result) {
        setFoodItems(prevItems =>
          prevItems.map(item =>
            item.id === result.id ? result : item
          )
        );
      }
    } catch (error) {
      console.error('Error updating food status:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredFoodItems = foodItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status) => {
    return status === 'open' ? 'open' : 'closed';
  };

  const getVegBadge = (isVeg) => {
    return isVeg ? 'veg' : 'non-veg';
  };

  return (
    <>
      <Navbar />
      <div className="food-management">
        <div className="container">
          {error && (
            <div className="error-message">
              <div className="error-content">
                <span className="error-icon">⚠️</span>
                <span>{error}</span>
              </div>
              <button onClick={() => setError('')} className="error-close">×</button>
            </div>
          )}

          {deleteConfirm && (
            <div className="delete-confirm-overlay">
              <div className="delete-confirm-modal">
                <div className="delete-icon">🗑️</div>
                <h3>Confirm Delete</h3>
                <p>Are you sure you want to delete <strong>"{deleteConfirm.name}"</strong>?</p>
                <p className="delete-warning">This action cannot be undone.</p>
                <div className="delete-actions">
                  <button
                    className="delete-cancel-btn"
                    onClick={cancelDeleteConfirm}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    className="delete-confirm-btn"
                    onClick={() => handleDeleteClick(deleteConfirm.id)}
                    disabled={loading}
                  >
                    {loading ? 'Deleting...' : 'Yes, Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="management-header">
            <h1>Food Management</h1>
            <div className="header-tabs">
              <button
                className={`tab-button ${activeTab === 'restaurants' ? 'active' : ''}`}
                onClick={handleBackToRestaurants}
              >
                Restaurants
              </button>
              {selectedRestaurant && (
                <button
                  className={`tab-button ${activeTab === 'foodItems' ? 'active' : ''}`}
                  onClick={() => setActiveTab('foodItems')}
                >
                  {selectedRestaurant.name} - Menu
                </button>
              )}
            </div>
          </div>

          {activeTab === 'restaurants' ? (
            // Restaurants List View
            <div className="restaurants-section">
              <div className="section-header">
                <h2>All Restaurants</h2>
                <p>Manage restaurants and their food items</p>
              </div>

              {loading ? (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <p>Loading restaurants...</p>
                </div>
              ) : restaurants.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🏪</div>
                  <h3>No Restaurants Found</h3>
                  <p>Add restaurants to get started with food management.</p>
                </div>
              ) : (
                <div className="restaurants-table-container">
                  <table className="restaurants-table">
                    <thead>
                      <tr>
                        <th>Restaurant Name</th>
                        <th>Timing</th>
                        <th>Category</th>
                        <th>Rating</th>
                        <th>Status</th>
                        <th>Delivery</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {restaurants.map(restaurant => (
                        <tr key={restaurant.id}>
                          <td className="restaurant-info">
                            <div className="restaurant-details">
                              <div className="restaurant-name">{restaurant.name}</div>
                              {restaurant.tags && restaurant.tags.length > 0 && (
                                <div className="restaurant-tags">
                                  {restaurant.tags.slice(0, 2).map((tag, index) => (
                                    <span key={index} className="tag">{tag}</span>
                                  ))}
                                  {restaurant.tags.length > 2 && (
                                    <span className="tag-more">+{restaurant.tags.length - 2}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="timing-cell">
                            <div className="timing">
                              {restaurant.open_time} - {restaurant.close_time}
                            </div>
                          </td>
                          <td className="category-cell">
                            <span className="category">{restaurant.category}</span>
                          </td>
                          <td className="rating-cell">
                            <div className="rating">
                              <span className="stars">{"★".repeat(Math.floor(restaurant.rating || 0))}</span>
                              <span className="rating-value">{restaurant.rating || 0}</span>
                              <span className="reviews">({restaurant.reviews_count || 0})</span>
                            </div>
                          </td>
                          <td>
                            <span className={`status-badge ${getStatusBadge(restaurant.hotel_status)}`}>
                              {restaurant.hotel_status}
                            </span>
                          </td>
                          <td className="delivery-cell">
                            <div className="delivery-info">
                              <span className="delivery-time">{restaurant.delivery_time}</span>
                              {restaurant.min_order && (
                                <span className="min-order">Min: ₹{restaurant.min_order}</span>
                              )}
                            </div>
                          </td>
                          <td className="action-buttons">
                            <button
                              className="manage-btn"
                              onClick={() => handleRestaurantClick(restaurant)}
                              disabled={loading}
                            >
                              Manage Menu
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            // Food Items View
            <div className="food-items-section">
              <div className="section-header">
                <div className="header-top">
                  <button
                    className="back-button"
                    onClick={handleBackToRestaurants}
                  >
                    <span className="back-arrow">←</span>
                    All Restaurants
                  </button>
                  <div className="header-title">
                    <h2>{selectedRestaurant.name} - Menu Items</h2>
                    <p>Manage food items for this restaurant</p>
                  </div>
                </div>

                <div className="food-stats">
                  <div className="stat-card">
                    <div className="stat-value">{foodItems.length}</div>
                    <div className="stat-label">Total Items</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{foodItems.filter(item => item.popular).length}</div>
                    <div className="stat-label">Popular</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{foodItems.filter(item => item.bestseller).length}</div>
                    <div className="stat-label">Bestsellers</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{foodItems.filter(item => item.veg).length}</div>
                    <div className="stat-label">Veg Items</div>
                  </div>
                </div>
              </div>

              <div className="search-section">
                <div className="search-container">
                  <i className="icon-search">🔍</i>
                  <input
                    type="text"
                    placeholder="Search food items by name or category..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                  />
                  {searchTerm && (
                    <button
                      className="clear-search"
                      onClick={() => setSearchTerm('')}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <p>Loading food items...</p>
                </div>
              ) : (
                <div className="food-items-table-container">
                  <table className="food-items-table">
                    <thead>
                      <tr>
                        <th>Food Item</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Original Price</th>
                        <th>Profit</th>
                        <th>Rating</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Position</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFoodItems.length === 0 ? (
                        <tr>
                          <td colSpan="10" className="no-items">
                            <div className="empty-state">
                              <div className="empty-icon">🍕</div>
                              <h3>{searchTerm ? 'No food items found' : 'No food items in this restaurant'}</h3>
                              <p>
                                {searchTerm
                                  ? 'Try adjusting your search terms'
                                  : 'Add food items to get started'
                                }
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredFoodItems.map(item => (
                          <tr key={item.id}>
                            <td className="food-info">
                              {editingFood?.id === item.id ? (
                                <div className="edit-input-container">
                                  <input
                                    type="text"
                                    value={editingFood.name}
                                    onChange={(e) => handleFieldChange('name', e.target.value)}
                                    className="edit-input"
                                    placeholder="Food item name"
                                  />
                                </div>
                              ) : (
                                <div className="food-details">
                                  <div className="food-name">{item.name}</div>
                                  {item.prep_time && (
                                    <div className="prep-time">⏱️ {item.prep_time}</div>
                                  )}
                                  {item.calories && (
                                    <div className="calories">🔥 {item.calories} cal</div>
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="category-cell">
                              {editingFood?.id === item.id ? (
                                <select
                                  value={editingFood.category}
                                  onChange={(e) => handleFieldChange('category', e.target.value)}
                                  className="edit-select"
                                >
                                  <option value="">Select Category</option>
                                  {foodCategories.map(category => (
                                    <option key={category} value={category}>
                                      {category}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="category">{item.category}</span>
                              )}
                            </td>

                            {editingFood?.id === item.id ? (
                              <>
                                <td>
                                  <div className="edit-input-container">
                                    <span className="currency-symbol">₹</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={editingFood.price}
                                      onChange={(e) => handleFieldChange('price', e.target.value)}
                                      className="edit-input"
                                    />
                                  </div>
                                </td>
                                <td>
                                  <div className="edit-input-container">
                                    <span className="currency-symbol">₹</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={editingFood.original_price}
                                      onChange={(e) => handleFieldChange('original_price', e.target.value)}
                                      className="edit-input"
                                    />
                                  </div>
                                </td>
                                <td>
                                  <div className="edit-input-container">
                                    <span className="currency-symbol">₹</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={editingFood.profit}
                                      onChange={(e) => handleFieldChange('profit', e.target.value)}
                                      className="edit-input"
                                    />
                                  </div>
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="5"
                                    value={editingFood.rating}
                                    onChange={(e) => handleFieldChange('rating', e.target.value)}
                                    className="edit-input"
                                  />
                                </td>
                                <td>
                                  <select
                                    value={editingFood.veg}
                                    onChange={(e) => handleFieldChange('veg', e.target.value === 'true')}
                                    className="edit-select"
                                  >
                                    <option value={true}>Veg</option>
                                    <option value={false}>Non-Veg</option>
                                  </select>
                                </td>
                                <td className="status-actions">
                                  <div className="toggle-buttons">
                                    <button
                                      className={`toggle-btn ${editingFood.popular ? 'active' : ''}`}
                                      onClick={() => handleFieldChange('popular', !editingFood.popular)}
                                      type="button"
                                    >
                                      Popular
                                    </button>
                                    <button
                                      className={`toggle-btn ${editingFood.bestseller ? 'active' : ''}`}
                                      onClick={() => handleFieldChange('bestseller', !editingFood.bestseller)}
                                      type="button"
                                    >
                                      Bestseller
                                    </button>
                                  </div>
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    min="0"
                                    value={editingFood.food_position}
                                    onChange={(e) => handleFieldChange('food_position', e.target.value)}
                                    className="edit-input"
                                  />
                                </td>
                                <td className="action-buttons">
                                  <button
                                    className="save-btn"
                                    onClick={handleSaveClick}
                                    disabled={loading}
                                  >
                                    {loading ? 'Saving...' : 'Save'}
                                  </button>
                                  <button
                                    className="cancel-btn"
                                    onClick={handleCancelClick}
                                    disabled={loading}
                                  >
                                    Cancel
                                  </button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="price-cell">
                                  <span className="price-amount">₹{item.price}</span>
                                </td>
                                <td className="original-price-cell">
                                  {item.original_price && item.original_price > item.price ? (
                                    <span className="original-price">₹{item.original_price}</span>
                                  ) : (
                                    <span className="no-original-price">-</span>
                                  )}
                                </td>
                                <td className="profit-cell">
                                  <span className="profit-amount">₹{item.profit || 0}</span>
                                </td>
                                <td className="rating-cell">
                                  <div className="rating">
                                    <span className="stars">{"★".repeat(Math.floor(item.rating || 0))}</span>
                                    <span className="rating-value">{item.rating || 0}</span>
                                    <span className="reviews">({item.review_count || 0})</span>
                                  </div>
                                </td>
                                <td>
                                  <span className={`veg-badge ${getVegBadge(item.veg)}`}>
                                    {item.veg ? '🟢 Veg' : '🔴 Non-Veg'}
                                  </span>
                                </td>
                                <td className="status-actions">
                                  <div className="toggle-buttons">
                                    <button
                                      className={`toggle-btn ${item.popular ? 'active' : ''}`}
                                      onClick={() => toggleFoodStatus(item, 'popular')}
                                      disabled={loading}
                                    >
                                      Popular
                                    </button>
                                    <button
                                      className={`toggle-btn ${item.bestseller ? 'active' : ''}`}
                                      onClick={() => toggleFoodStatus(item, 'bestseller')}
                                      disabled={loading}
                                    >
                                      Bestseller
                                    </button>
                                  </div>
                                </td>
                                <td className="position-cell">
                                  <span className="position">{item.food_position || 0}</span>
                                </td>
                                <td className="action-buttons">
                                  <button
                                    className="edit-btn"
                                    onClick={() => handleEditClick(item)}
                                    disabled={loading}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="delete-btn"
                                    onClick={() => startDeleteConfirm(item)}
                                    disabled={loading}
                                  >
                                    Delete
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default FoodManagement;