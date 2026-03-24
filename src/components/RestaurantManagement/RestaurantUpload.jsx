import React, { useState } from 'react';
import { supabase } from '../../../supabase';
import { storage } from '../../../firebase.config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import './RestaurantUpload.css';

const RestaurantUpload = () => {
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [imageFile, setImageFile] = useState(null);

  const [formData, setFormData] = useState({
    id: '',
    name: '',
    open_time: '11:00 AM',
    close_time: '11:00 PM',
    rating: 4.0,
    category: 'Both',
    delivery_time: '30-40 min',
    min_order: '₹49',
    tags: [],
    offer: '55% OFF',
    latitude: 10.6054,
    longitude: 78.4101,
    reviews_count: 0,
    hotel_status: 'open',
    password: '',
    username: '',
    restaurant_image: ''
  });

  const [newTag, setNewTag] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: (name === 'rating' || name === 'latitude' || name === 'longitude' || name === 'reviews_count') 
        ? parseFloat(value) 
        : value
    }));
  };

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

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        validateFile(file);
        setImageFile(file);
        // Create a temporary preview URL
        const previewUrl = URL.createObjectURL(file);
        setFormData(prev => ({ ...prev, restaurant_image: previewUrl }));
        setError(null);
      } catch (err) {
        alert(err.message);
        e.target.value = '';
      }
    }
  };

  const uploadImage = async (file) => {
    setIsUploading(true);
    try {
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const filePath = `restaurants/${Date.now()}_${safeFileName}`;
      const storageRef = ref(storage, filePath);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (err) {
      console.error('Image upload error:', err);
      throw new Error('Failed to upload image to storage.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim()) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (index) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index)
    }));
  };

  const validateFormData = () => {
    // Latitude constraints: 8.0 <= lat <= 13.0
    if (formData.latitude < 8.0 || formData.latitude > 13.0) {
      alert('Latitude must be between 8.0 and 13.0');
      return false;
    }
    // Longitude constraints: 76.0 <= lon <= 80.0
    if (formData.longitude < 76.0 || formData.longitude > 80.0) {
      alert('Longitude must be between 76.0 and 80.0');
      return false;
    }
    // Different coordinates check
    if (formData.latitude === formData.longitude) {
      alert('Latitude and Longitude cannot be identical.');
      return false;
    }
    if (!formData.id || !formData.name || !formData.username || !formData.password) {
      alert('Please fill all required fields (ID, Name, Username, Password)');
      return false;
    }
    if (!imageFile && !formData.restaurant_image) {
      alert('Please select a restaurant image');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateFormData()) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      let imageUrl = formData.restaurant_image;

      // Upload image if a new file is selected
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const submissionData = {
        ...formData,
        restaurant_image: imageUrl
      };

      const { error } = await supabase
        .from('restaurants')
        .insert([submissionData]);

      if (error) throw error;

      setSuccess(true);
      alert('Restaurant added successfully!');
      // Reset form (except some defaults)
      setFormData({
        id: '',
        name: '',
        open_time: '11:00 AM',
        close_time: '11:00 PM',
        rating: 4.0,
        category: 'Both',
        delivery_time: '30-40 min',
        min_order: '₹49',
        tags: [],
        offer: '55% OFF',
        latitude: 10.6054,
        longitude: 78.4101,
        reviews_count: 0,
        hotel_status: 'open',
        password: '',
        username: '',
        restaurant_image: ''
      });
      setImageFile(null);
    } catch (err) {
      console.error('Error adding restaurant:', err);
      setError(err.message);
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="restaurant-management restaurant-upload-section">
      <div className="restaurant-card">
        <div className="card-header">
          <h2>🏪 Add New Restaurant</h2>
          <p>Fill in the details to register a new vendor/restaurant in the system.</p>
        </div>

        <form onSubmit={handleSubmit} className="restaurant-form">
          <div className="form-grid">
            {/* Basic Info */}
            <div className="form-section">
              <h3>Basic Information</h3>
              <div className="input-group">
                <label>Restaurant ID *</label>
                <input type="text" name="id" value={formData.id} onChange={handleInputChange} placeholder="e.g. 1, resto_614" required />
              </div>
              <div className="input-group">
                <label>Restaurant Name *</label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="Enter name" required />
              </div>
              <div className="input-group">
                <label>Category</label>
                <select name="category" value={formData.category} onChange={handleInputChange}>
                  <option value="Veg">Veg</option>
                  <option value="Non Veg">Non Veg</option>
                  <option value="Both">Both</option>
                </select>
              </div>
              <div className="input-group">
                <label>Rating (0.0 - 5.0)</label>
                <input type="number" step="0.1" min="0" max="5" name="rating" value={formData.rating} onChange={handleInputChange} />
              </div>
            </div>

            {/* Operational Info */}
            <div className="form-section">
              <h3>Operational Details</h3>
              <div className="input-row">
                <div className="input-group">
                  <label>Open Time</label>
                  <input type="text" name="open_time" value={formData.open_time} onChange={handleInputChange} placeholder="e.g. 11:00 AM" />
                </div>
                <div className="input-group">
                  <label>Close Time</label>
                  <input type="text" name="close_time" value={formData.close_time} onChange={handleInputChange} placeholder="e.g. 11:00 PM" />
                </div>
              </div>
              <div className="input-group">
                <label>Delivery Time Range</label>
                <input type="text" name="delivery_time" value={formData.delivery_time} onChange={handleInputChange} placeholder="e.g. 30-40 min" />
              </div>
              <div className="input-group">
                <label>Min Order Value</label>
                <input type="text" name="min_order" value={formData.min_order} onChange={handleInputChange} placeholder="e.g. ₹49" />
              </div>
              <div className="input-group">
                <label>Hotel Status</label>
                <select name="hotel_status" value={formData.hotel_status} onChange={handleInputChange}>
                  <option value="open">Open</option>
                  <option value="close">Closed</option>
                </select>
              </div>
            </div>

            {/* Location & Tags */}
            <div className="form-section">
              <h3>Location & Promotion</h3>
              <div className="input-row">
                <div className="input-group">
                  <label>Latitude * (8.0 - 13.0)</label>
                  <input type="number" step="0.0000001" name="latitude" value={formData.latitude} onChange={handleInputChange} required />
                </div>
                <div className="input-group">
                  <label>Longitude * (76.0 - 80.0)</label>
                  <input type="number" step="0.0000001" name="longitude" value={formData.longitude} onChange={handleInputChange} required />
                </div>
              </div>
              <div className="input-group">
                <label>Offer Details</label>
                <input type="text" name="offer" value={formData.offer} onChange={handleInputChange} placeholder="e.g. 50% OFF" />
              </div>
              <div className="input-group">
                <label>Tags (e.g. Biryani, Chinese)</label>
                <div className="tag-input-wrapper">
                  <input type="text" value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Type tag..." onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())} />
                  <button type="button" onClick={handleAddTag}>Add</button>
                </div>
                <div className="tags-container">
                  {formData.tags.map((tag, idx) => (
                    <span key={idx} className="tag-badge">
                      {tag} <button type="button" onClick={() => handleRemoveTag(idx)}>×</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Credentials & Media */}
            <div className="form-section">
              <h3>Vendor Credentials & Media</h3>
              <div className="input-group">
                <label>Vendor Username *</label>
                <input type="text" name="username" value={formData.username} onChange={handleInputChange} placeholder="manavai_vendor_name" required />
              </div>
              <div className="input-group">
                <label>Vendor Password *</label>
                <input type="password" name="password" value={formData.password} onChange={handleInputChange} placeholder="Set password" required />
              </div>
              <div className="input-group">
                <label>Restaurant Image *</label>
                <div className="file-upload-wrapper">
                  <input 
                    type="file" 
                    id="restaurant_image_file"
                    accept="image/*" 
                    onChange={handleImageChange} 
                    className="file-input-hidden"
                  />
                  <label htmlFor="restaurant_image_file" className="file-upload-btn">
                    {imageFile ? 'Change Image' : 'Choose Image'}
                  </label>
                  {imageFile && <span className="file-name">{imageFile.name}</span>}
                </div>
                <p className="file-help">JPG, PNG or WebP. Max 5MB.</p>
              </div>
              {formData.restaurant_image && (
                <div className="image-preview">
                  <div className="preview-label">Preview:</div>
                  <img src={formData.restaurant_image} alt="Preview" />
                </div>
              )}
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="submit-btn" disabled={loading || isUploading}>
              {isUploading ? 'Uploading Image...' : (loading ? 'Adding...' : 'Register Restaurant')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RestaurantUpload;
