import React, { useState, useEffect } from 'react';
import Navbar from "../Navbar/Navbar";
import { supabase } from "../../../supabase";
import { storage } from '../../../firebase.config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import "./FoodUpload.css";

const FoodUpload = () => {
  // State for restaurants
  const [restaurants, setRestaurants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    original_price: '',
    category: '',
    restaurant_name: '',
    rating: '4.5',
    review_count: '0',
    veg: true,
    popular: false,
    bestseller: false,
    calories: '',
    prep_time: '',
    profit: '0',
    food_position: '0'
  });

  const [image, setImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Predefined categories for food items
  const FOOD_CATEGORIES = [
    "Biryani", "Pizza", "Burger", "Fried Chicken", "Mutton", "Chicken", "Fresh Juice", 
    "Sea Foods", "South Indian", "Dosa", "Parotta", "Fried Rice", "Naan & Gravy", 
    "Noodles", "Veg", "Rolls", "Soup", "Tea", "Coffee", "Shakes", "Mojito", "Cake's", "Ice Cream"
  ];

  // Preparation time options
  const PREP_TIME_OPTIONS = [
    '5-10 mins', '10-15 mins', '15-20 mins', '20-25 mins',
    '25-30 mins', '30-35 mins', '35-40 mins', '40-45 mins',
    '45-50 mins', '50-55 mins', '55-60 mins', '60+ mins'
  ];

  // Fetch restaurants from database
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        setIsLoading(true);
        
        // Fetch restaurants - simplified query
        const { data: restaurantsData, error: restaurantsError } = await supabase
          .from('restaurants')
          .select('id, name, category, hotel_status')
          .eq('hotel_status', 'open')
          .order('name', { ascending: true });

        if (restaurantsError) {
          console.error('Restaurants fetch error:', restaurantsError);
          throw restaurantsError;
        }

        console.log('Fetched restaurants:', restaurantsData);
        setRestaurants(restaurantsData || []);

      } catch (error) {
        console.error('Error fetching restaurants:', error);
        setMessage({ type: 'error', text: 'Failed to load restaurants' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchRestaurants();
  }, []);

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Auto-calculate profit (20% by default for food items)
    if (name === 'price' && value) {
      const priceValue = parseFloat(value);
      if (!isNaN(priceValue) && priceValue > 0) {
        const profitValue = (priceValue * 0.2).toFixed(2);
        setFormData(prev => ({ ...prev, profit: profitValue }));
      }
    }
  };

  // File validation
  const validateFile = (file) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    if (!validTypes.includes(file.type)) {
      throw new Error('Invalid file type. Please use JPEG, PNG, or WebP.');
    }
    
    if (file.size > maxSize) {
      throw new Error('File size too large. Maximum 5MB allowed.');
    }
    
    return true;
  };

  // Handle image change
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        validateFile(file);
        setImage(file);
        setMessage({ type: '', text: '' });
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      }
    }
  };

  // Image upload function
  const uploadImage = async (file) => {
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const filePath = `food-items/${Date.now()}_${safeFileName}`;
    const storageRef = ref(storage, filePath);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
  };

  // Form validation
  const validateForm = () => {
    const errors = [];
    
    if (!formData.name.trim()) errors.push('Food item name is required');
    if (!formData.price || parseFloat(formData.price) <= 0) errors.push('Valid price is required');
    if (!formData.category) errors.push('Category is required');
    if (!formData.restaurant_name) errors.push('Restaurant is required');
    if (!image) errors.push('Food image is required');
    
    // Validate rating range
    if (formData.rating && (parseFloat(formData.rating) < 0 || parseFloat(formData.rating) > 5)) {
      errors.push('Rating must be between 0 and 5');
    }

    return errors;
  };

  // Prepare food item data
  const prepareFoodData = (imageUrl) => {
    return {
      name: formData.name.trim(),
      price: parseFloat(formData.price) || 0,
      original_price: formData.original_price ? parseFloat(formData.original_price) : null,
      category: formData.category,
      restaurant_name: formData.restaurant_name,
      rating: parseFloat(formData.rating) || 4.5,
      review_count: parseInt(formData.review_count) || 0,
      veg: formData.veg,
      popular: formData.popular,
      bestseller: formData.bestseller,
      calories: formData.calories ? parseInt(formData.calories) : null,
      prep_time: formData.prep_time || null,
      image_url: imageUrl,
      profit: parseFloat(formData.profit) || 0,
      food_position: parseInt(formData.food_position) || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    setMessage({ type: '', text: '' });

    try {
      // Validation
      const errors = validateForm();
      if (errors.length > 0) {
        throw new Error(errors.join(', '));
      }

      // Upload image
      const imageUrl = await uploadImage(image);

      // Prepare data
      const foodData = prepareFoodData(imageUrl);

      // Insert into Supabase
      const { data, error } = await supabase
        .from('food_items')
        .insert([foodData])
        .select();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Database sequence error. Please run: SELECT setval(\'food_items_id_seq\', (SELECT MAX(id) FROM food_items));');
        }
        throw error;
      }

      setMessage({ type: 'success', text: 'Food item uploaded successfully!' });
      
      // Show alert after successful upload
      alert('✅ Food Item uploaded successfully!\n\nFood Details:\n• Name: ' + formData.name + '\n• Restaurant: ' + formData.restaurant_name + '\n• Category: ' + formData.category + '\n• Price: ₹' + formData.price + '\n• Profit: ₹' + formData.profit + '\n• Vegetarian: ' + (formData.veg ? 'Yes' : 'No'));
      
      resetForm();

    } catch (error) {
      setMessage({ type: 'error', text: error.message });
      // Show error alert
      alert('❌ Upload Failed!\n\nError: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      price: '',
      original_price: '',
      category: '',
      restaurant_name: '',
      rating: '4.5',
      review_count: '0',
      veg: true,
      popular: false,
      bestseller: false,
      calories: '',
      prep_time: '',
      profit: '0',
      food_position: '0'
    });
    setImage(null);
    document.querySelectorAll('input[type="file"]').forEach(input => input.value = '');
    setMessage({ type: '', text: '' });
  };

  return (
    <>
      <Navbar />
      <div className="food-upload-container">
        <div className="food-upload-form">
          <div className="form-header">
            <h2>Upload New Food Item</h2>
            <p className="form-subtitle">Add a new food item to your restaurant menu</p>
          </div>
          
          {message.text && (
            <div className={`message ${message.type}`}>
              {message.text}
              {message.type === 'error' && message.text.includes('sequence') && (
                <div className="error-fix">
                  <strong>Quick Fix:</strong> Run this SQL in Supabase:
                  <code>SELECT setval('food_items_id_seq', (SELECT MAX(id) FROM food_items));</code>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Basic Information */}
            <div className="form-section">
              <h3>Basic Information</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Food Item Name *</label>
                  <input 
                    type="text" 
                    name="name" 
                    value={formData.name} 
                    onChange={handleInputChange} 
                    required 
                    placeholder="Enter food item name"
                  />
                </div>

                <div className="form-group">
                  <label>Restaurant *</label>
                  <select 
                    name="restaurant_name" 
                    value={formData.restaurant_name} 
                    onChange={handleInputChange} 
                    required
                  >
                    <option value="">Select Restaurant</option>
                    {isLoading ? (
                      <option value="" disabled>Loading restaurants...</option>
                    ) : (
                      restaurants.map(restaurant => (
                        <option key={restaurant.id} value={restaurant.name}>
                          {restaurant.name} {restaurant.category ? `(${restaurant.category})` : ''}
                        </option>
                      ))
                    )}
                  </select>
                  {!isLoading && restaurants.length === 0 && (
                    <div className="field-info warning">
                      No restaurants found. Please add restaurants first.
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Category *</label>
                  <select 
                    name="category" 
                    value={formData.category} 
                    onChange={handleInputChange} 
                    required
                  >
                    <option value="">Select Category</option>
                    {FOOD_CATEGORIES.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Current Price (₹) *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0.01" 
                    name="price" 
                    value={formData.price} 
                    onChange={handleInputChange} 
                    required 
                    placeholder="0.00"
                  />
                </div>

                <div className="form-group">
                  <label>Original Price (₹)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0.01" 
                    name="original_price" 
                    value={formData.original_price} 
                    onChange={handleInputChange} 
                    placeholder="Original price for discount"
                  />
                  <div className="field-info">
                    Leave empty if no discount offered
                  </div>
                </div>

                <div className="form-group">
                  <label>Profit (₹) *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    name="profit" 
                    value={formData.profit} 
                    onChange={handleInputChange} 
                    min="0" 
                    required
                    placeholder="Auto-calculated"
                  />
                  <div className="field-info">Auto-calculated as 20% of price</div>
                </div>

                <div className="form-group">
                  <label>Calories</label>
                  <input 
                    type="number" 
                    name="calories" 
                    value={formData.calories} 
                    onChange={handleInputChange} 
                    min="0" 
                    placeholder="e.g., 350"
                  />
                </div>

                <div className="form-group">
                  <label>Preparation Time</label>
                  <select 
                    name="prep_time" 
                    value={formData.prep_time} 
                    onChange={handleInputChange}
                  >
                    <option value="">Select preparation time</option>
                    {PREP_TIME_OPTIONS.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Rating</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    min="0" 
                    max="5" 
                    name="rating" 
                    value={formData.rating} 
                    onChange={handleInputChange} 
                    placeholder="4.5"
                  />
                </div>

                <div className="form-group">
                  <label>Review Count</label>
                  <input 
                    type="number" 
                    name="review_count" 
                    value={formData.review_count} 
                    onChange={handleInputChange} 
                    min="0" 
                    placeholder="0"
                  />
                </div>

                <div className="form-group">
                  <label>Display Position</label>
                  <input 
                    type="number" 
                    name="food_position" 
                    value={formData.food_position} 
                    onChange={handleInputChange} 
                    min="0" 
                    placeholder="0"
                  />
                  <div className="field-info">Lower numbers appear first</div>
                </div>
              </div>
            </div>

            {/* Food Properties */}
            <div className="form-section">
              <h3>Food Properties</h3>
              <div className="checkbox-grid">
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      name="veg" 
                      checked={formData.veg} 
                      onChange={handleInputChange} 
                    />
                    <span className="checkbox-custom"></span>
                    Vegetarian
                  </label>
                </div>

                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      name="popular" 
                      checked={formData.popular} 
                      onChange={handleInputChange} 
                    />
                    <span className="checkbox-custom"></span>
                    Popular Item
                  </label>
                </div>

                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      name="bestseller" 
                      checked={formData.bestseller} 
                      onChange={handleInputChange} 
                    />
                    <span className="checkbox-custom"></span>
                    Best Seller
                  </label>
                </div>
              </div>
            </div>

            {/* Food Image */}
            <div className="form-section">
              <h3>Food Image *</h3>
              <div className="form-group">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageChange} 
                  required 
                />
                <div className="file-info">
                  Accepted formats: JPEG, PNG, WebP | Maximum size: 5MB
                </div>
                {image && (
                  <div className="image-preview">
                    <strong>Selected:</strong> {image.name} 
                    ({(image.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                )}
              </div>
            </div>

            <div className="form-actions">
              <button 
                type="button" 
                onClick={resetForm} 
                className="reset-btn"
                disabled={isUploading}
              >
                Reset Form
              </button>
              <button 
                type="submit" 
                className="submit-btn" 
                disabled={isUploading || restaurants.length === 0}
              >
                {isUploading ? (
                  <>
                    <span className="loading-spinner"></span>
                    Uploading...
                  </>
                ) : (
                  restaurants.length === 0 ? 'No Restaurants Available' : 'Upload Food Item'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default FoodUpload;