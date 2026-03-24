import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabase';
import './RestaurantManagement.css';

const RestaurantManagement = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const fetchRestaurants = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;
      setRestaurants(data || []);
    } catch (err) {
      console.error('Error fetching restaurants:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'open' ? 'close' : 'open';
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({ hotel_status: newStatus })
        .eq('id', id);

      if (error) throw error;

      setRestaurants(prev =>
        prev.map(r => r.id === id ? { ...r, hotel_status: newStatus } : r)
      );
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status');
    }
  };

  const filteredRestaurants = restaurants.filter(r =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="loading-container"><div className="spinner"></div><p>Loading Restaurants...</p></div>;

  return (
    <div className="restaurant-management-list">
      <div className="management-header">
        <div className="header-text">
          <h2>🏥 Restaurant Status Control</h2>
          <p>Quickly open or close restaurants for service.</p>
        </div>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search by name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="search-icon">🔍</span>
        </div>
      </div>

      {error && <div className="error-message">Error: {error}</div>}

      <div className="restaurants-grid">
        {filteredRestaurants.map(restaurant => (
          <div key={restaurant.id} className={`restaurant-status-card ${restaurant.hotel_status}`}>
            <div className="card-top">
              <img src={restaurant.restaurant_image || 'https://via.placeholder.com/150'} alt={restaurant.name} className="restaurant-img" />
              <div className={`status-badge ${restaurant.hotel_status}`}>
                {restaurant.hotel_status === 'open' ? '🟢 Open' : '🔴 Closed'}
              </div>
            </div>
            
            <div className="card-info">
              <h3 title={restaurant.name}>{restaurant.name}</h3>
              <p className="resto-id">ID: {restaurant.id}</p>
              <div className="resto-meta">
                <span>🕒 {restaurant.open_time} - {restaurant.close_time}</span>
                <span>⭐ {restaurant.rating}</span>
              </div>
            </div>

            <div className="card-actions">
              <div className="toggle-wrapper">
                <span className="toggle-label">Service Status</span>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={restaurant.hotel_status === 'open'}
                    onChange={() => toggleStatus(restaurant.id, restaurant.hotel_status)}
                  />
                  <span className="slider round"></span>
                </label>
              </div>
              <button 
                className={`status-btn ${restaurant.hotel_status === 'open' ? 'resto-close-btn' : 'resto-open-btn'}`}
                onClick={() => toggleStatus(restaurant.id, restaurant.hotel_status)}
              >
                {restaurant.hotel_status === 'open' ? 'Force Close' : 'Force Open'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredRestaurants.length === 0 && (
        <div className="no-results">
          <p>No restaurants found matching your search.</p>
        </div>
      )}
    </div>
  );
};

export default RestaurantManagement;
