import React, { useState, useEffect, useCallback } from 'react';
import Navbar from "../Navbar/Navbar";
import { supabase } from "../../../supabase";
import { storage } from '../../../firebase.config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import "./ProductUpload.css";

const ProductUpload = () => {
  // State for categories from database
  const [categories, setCategories] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  
  // State for warehouses and zones from database
  const [warehouses, setWarehouses] = useState([]);
  const [zones, setZones] = useState([]);
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(true);
  const [isLoadingZones, setIsLoadingZones] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
    brand: '',
    description: '',
    discount: '',
    rating: '0',
    reviews: '0',
    stock: '0',
    profit: '0',
    warehouse: '',
    zone: ''
  });

  const [colors, setColors] = useState([{ 
    name: '', 
    code: '', 
    price: '',
    images: Array(4).fill(null) 
  }]);
  
  const [sizes, setSizes] = useState(Array(4).fill({ size: '', price: '' }));
  const [mainImage, setMainImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Predefined brands for suggestions
  const BRANDS = [
    'TechCorp', 'StyleHub', 'TrendWear', 'HomeStyle', 'Generic',
    'Samsung', 'Apple', 'Nike', 'Adidas', 'Puma', 'Raymond', 'Allen Solly'
  ];

  // Size templates for all categories
  const COMMON_SIZES = {
    'Electronics': ['Standard', 'Compact', 'Large', 'Extra Large'],
    'Womens': ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    'Furniture': ['Small', 'Medium', 'Large', 'Extra Large'],
    'Snacks': ['50g', '100g', '200g', '500g', '1kg'],
    'Home Appliances': ['Standard', 'Compact', 'Large', 'Extra Large'],
    'Flowers': ['Small Bouquet', 'Medium Bouquet', 'Large Bouquet', 'Deluxe Bouquet'],
    'Daily Utilities': ['Single', 'Pack of 3', 'Pack of 6', 'Pack of 12'],
    'Grocery': ['500g', '1kg', '2kg', '5kg'],
    'Vegetables': ['250g', '500g', '1kg', '2kg'],
    'Fruits': ['250g', '500g', '1kg', '2kg'],
    'Drinks': ['250ml', '500ml', '1L', '2L'],
    'Pharmacy': ['10 tablets', '20 tablets', '30 tablets', '50 tablets'],
    'Meat & Flesh': ['250g', '500g', '1kg', '2kg'],
    'Gifts': ['Small', 'Medium', 'Large', 'Premium'],
    'Accessories': ['One Size', 'Small', 'Medium', 'Large'],
    'Mens': ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    'Kids': ['2-4 Years', '4-6 Years', '6-8 Years', '8-10 Years', '10-12 Years'],
    'Baby': ['Newborn', '0-3 Months', '3-6 Months', '6-12 Months', '12-18 Months'],
    'Toys': ['Small', 'Medium', 'Large', 'Extra Large'],
    'Mobile Accessories': ['Universal', 'Small', 'Medium', 'Large'],
    'Jewellery': ['One Size', 'Small', 'Medium', 'Large'],
    'Stationery': ['Single', 'Pack of 5', 'Pack of 10', 'Pack of 20'],
    'Household Items': ['Single', 'Pack of 3', 'Pack of 6', 'Pack of 12'],
    'Fertilizer': ['1kg', '5kg', '10kg', '25kg']
  };

  // Fetch categories from database
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('search_categories')
          .select('id, title, subtitle, keywords')
          .order('display_order', { ascending: true })
          .order('title', { ascending: true });

        if (error) {
          console.error('Error fetching categories:', error);
          // Fallback to default categories if database fetch fails
          setCategories([
            { id: 1, title: 'Electronics', keywords: ['electronics', 'tech', 'gadgets'] },
            { id: 2, title: 'Womens', keywords: ['womens', 'women', 'ladies'] },
            { id: 3, title: 'Furniture', keywords: ['furniture', 'home'] },
            { id: 4, title: 'Snacks', keywords: ['snacks', 'food'] },
            { id: 5, title: 'Home Appliances', keywords: ['appliances', 'home'] },
            { id: 6, title: 'Flowers', keywords: ['flowers', 'plants'] },
            { id: 7, title: 'Daily Utilities', keywords: ['daily', 'essentials'] },
            { id: 8, title: 'Grocery', keywords: ['grocery', 'food'] }
          ]);
        } else {
          setCategories(data || []);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setIsLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  // Fetch warehouses from database
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const { data, error } = await supabase
          .from('warehouse')
          .select('id, name, zone')
          .order('name', { ascending: true });

        if (error) {
          console.error('Error fetching warehouses:', error);
        } else {
          setWarehouses(data || []);
        }
      } catch (error) {
        console.error('Error fetching warehouses:', error);
      } finally {
        setIsLoadingWarehouses(false);
      }
    };

    fetchWarehouses();
  }, []);

  // Fetch zones from database
  useEffect(() => {
    const fetchZones = async () => {
      try {
        const { data, error } = await supabase
          .from('app_zone')
          .select('id, zone_name')
          .order('zone_name', { ascending: true });

        if (error) {
          console.error('Error fetching zones:', error);
        } else {
          setZones(data || []);
        }
      } catch (error) {
        console.error('Error fetching zones:', error);
      } finally {
        setIsLoadingZones(false);
      }
    };

    fetchZones();
  }, []);

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Auto-populate sizes when category changes
    if (name === 'category' && value) {
      // Auto-populate sizes based on category
      const categorySizes = COMMON_SIZES[value] || ['Standard'];
      const newSizes = categorySizes.map((size, index) => ({
        size: size,
        price: index === 0 ? formData.price : ''
      }));
      
      // Fill remaining slots with empty values
      while (newSizes.length < 4) {
        newSizes.push({ size: '', price: '' });
      }
      
      setSizes(newSizes.slice(0, 4));
    }
    
    // Auto-calculate profit if price changes (10% by default)
    if (name === 'price' && value) {
      const priceValue = parseFloat(value);
      if (!isNaN(priceValue) && priceValue > 0) {
        const profitValue = (priceValue * 0.1).toFixed(2);
        setFormData(prev => ({ ...prev, profit: profitValue }));
        
        // Update first size price if it exists and matches the main price
        if (sizes[0] && sizes[0].size) {
          setSizes(prev => prev.map((sizeItem, index) => 
            index === 0 ? { ...sizeItem, price: value } : sizeItem
          ));
        }
      }
    }

    // Auto-calculate discount percentage if discount field changes
    if (name === 'discount' && value && formData.price) {
      const priceValue = parseFloat(formData.price);
      const discountMatch = value.match(/(\d+)%/);
      if (discountMatch && priceValue > 0) {
        const discountPercent = parseInt(discountMatch[1]);
        const discountAmount = (priceValue * discountPercent / 100).toFixed(2);
        setMessage({ 
          type: 'info', 
          text: `Discount amount: ₹${discountAmount} (${discountPercent}% of ₹${priceValue})` 
        });
      }
    }
  };

  // Handle color changes
  const handleColorChange = useCallback((colorIndex, field, value) => {
    setColors(prev => prev.map((color, index) => 
      index === colorIndex ? { ...color, [field]: value } : color
    ));
  }, []);

  // Handle color image changes
  const handleColorImageChange = useCallback((colorIndex, imageIndex, file) => {
    setColors(prev => prev.map((color, index) => 
      index === colorIndex ? {
        ...color,
        images: color.images.map((img, imgIndex) => 
          imgIndex === imageIndex ? file : img
        )
      } : color
    ));
  }, []);

  // Add/remove colors
  const addColor = () => {
    if (colors.length < 4) {
      setColors(prev => [...prev, { 
        name: '', 
        code: '', 
        price: '',
        images: Array(4).fill(null) 
      }]);
    }
  };

  const removeColor = (index) => {
    if (colors.length > 1) {
      setColors(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Handle size changes
  const handleSizeChange = (index, field, value) => {
    setSizes(prev => prev.map((sizeItem, i) => 
      i === index ? { ...sizeItem, [field]: value } : sizeItem
    ));
  };

  // Image upload function
  const uploadImage = async (file, folder) => {
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const filePath = `${folder}/${Date.now()}_${safeFileName}`;
    const storageRef = ref(storage, filePath);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
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

  // File handlers
  const handleMainImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        validateFile(file);
        setMainImage(file);
        setMessage({ type: '', text: '' });
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      }
    }
  };

  const handleColorFileChange = (colorIndex, imageIndex, e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        validateFile(file);
        handleColorImageChange(colorIndex, imageIndex, file);
        setMessage({ type: '', text: '' });
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      }
    }
  };

  // Form validation
  const validateForm = () => {
    const errors = [];
    
    if (!formData.name.trim()) errors.push('Product name is required');
    if (!formData.category) errors.push('Category is required');
    if (!formData.price || parseFloat(formData.price) <= 0) errors.push('Valid price is required');
    if (!mainImage) errors.push('Main image is required');
    
    return errors;
  };

  // Upload all images
  const uploadAllImages = async () => {
    const imageUrls = { mainImage: '', colorImages: [] };

    try {
      // Upload main image
      if (mainImage) {
        imageUrls.mainImage = await uploadImage(mainImage, 'products/main');
      }

      // Upload color images (only if they exist)
      for (let colorIndex = 0; colorIndex < colors.length; colorIndex++) {
        const colorImageUrls = [];
        for (let imgIndex = 0; imgIndex < 4; imgIndex++) {
          const imageFile = colors[colorIndex].images[imgIndex];
          if (imageFile) {
            const url = await uploadImage(imageFile, 'products/colors');
            colorImageUrls.push(url);
          } else {
            colorImageUrls.push(null);
          }
        }
        imageUrls.colorImages.push(colorImageUrls);
      }

      return imageUrls;
    } catch (error) {
      throw new Error(`Image upload failed: ${error.message}`);
    }
  };

  // Prepare product data
  const prepareProductData = (imageUrls) => {
    const productData = {
      name: formData.name.trim(),
      category: formData.category,
      price: parseFloat(formData.price) || 0,
      brand: formData.brand.trim() || null,
      description: formData.description.trim() || null,
      discount: formData.discount.trim() || null,
      rating: parseFloat(formData.rating) || 0,
      reviews: parseInt(formData.reviews) || 0,
      stock: parseInt(formData.stock) || 0,
      main_image_url: imageUrls.mainImage,
      profit: parseFloat(formData.profit) || 0,
      warehouse: formData.warehouse.trim() || null,
      zone: formData.zone.trim() || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Add colors with their prices
    colors.forEach((color, index) => {
      if (color.name.trim()) {
        const colorImages = imageUrls.colorImages[index] || [];
        productData[`color${index + 1}`] = color.name.trim();
        productData[`color${index + 1}_code`] = color.code.trim() || null;
        productData[`color${index + 1}_price`] = color.price ? parseFloat(color.price) : null;
        productData[`color${index + 1}_image1`] = colorImages[0] || null;
        productData[`color${index + 1}_image2`] = colorImages[1] || null;
        productData[`color${index + 1}_image3`] = colorImages[2] || null;
        productData[`color${index + 1}_image4`] = colorImages[3] || null;
      } else {
        // Explicitly set to null if no color name
        productData[`color${index + 1}`] = null;
        productData[`color${index + 1}_code`] = null;
        productData[`color${index + 1}_price`] = null;
        productData[`color${index + 1}_image1`] = null;
        productData[`color${index + 1}_image2`] = null;
        productData[`color${index + 1}_image3`] = null;
        productData[`color${index + 1}_image4`] = null;
      }
    });

    // Add sizes with their prices
    sizes.forEach((sizeItem, index) => {
      if (sizeItem.size.trim()) {
        productData[`size${index + 1}`] = sizeItem.size.trim();
        productData[`size${index + 1}_price`] = sizeItem.price ? parseFloat(sizeItem.price) : null;
      } else {
        productData[`size${index + 1}`] = null;
        productData[`size${index + 1}_price`] = null;
      }
    });

    return productData;
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

      // Upload images
      const imageUrls = await uploadAllImages();

      // Prepare data
      const productData = prepareProductData(imageUrls);

      // Insert into Supabase
      const { data, error } = await supabase
        .from('products')
        .insert([productData])
        .select();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Database sequence error. Please run: SELECT setval(\'products_id_seq\', (SELECT MAX(id) FROM products));');
        }
        throw error;
      }

      setMessage({ type: 'success', text: 'Product uploaded successfully!' });
      
      // Show alert after successful upload
      alert('✅ Product uploaded successfully!\n\nProduct Details:\n• Name: ' + formData.name + '\n• Category: ' + formData.category + '\n• Price: ₹' + formData.price + '\n• Profit: ₹' + formData.profit + '\n• Warehouse: ' + (formData.warehouse || 'Not specified') + '\n• Zone: ' + (formData.zone || 'Not specified'));
      
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
      name: '', category: '', price: '', brand: '', description: '', discount: '',
      rating: '0', reviews: '0', stock: '0', profit: '0', warehouse: '', zone: ''
    });
    setColors([{ 
      name: '', 
      code: '', 
      price: '',
      images: Array(4).fill(null) 
    }]);
    setSizes(Array(4).fill({ size: '', price: '' }));
    setMainImage(null);
    document.querySelectorAll('input[type="file"]').forEach(input => input.value = '');
    setMessage({ type: '', text: '' });
  };

  // Get available sizes for current category
  const getAvailableSizes = () => {
    return COMMON_SIZES[formData.category] || ['Standard'];
  };

  // Get category subtitle for the selected category
  const getCategorySubtitle = () => {
    const selectedCategory = categories.find(cat => cat.title === formData.category);
    return selectedCategory?.subtitle || '';
  };

  return (
    <>
      <Navbar />
      <div className="product-upload-container">
        <div className="product-upload-form">
          <div className="form-header">
            <h2>Upload New Product</h2>
            <p className="form-subtitle">Add a new product to your inventory</p>
          </div>
          
          {message.text && (
            <div className={`message ${message.type}`}>
              {message.text}
              {message.type === 'error' && message.text.includes('sequence') && (
                <div className="error-fix">
                  <strong>Quick Fix:</strong> Run this SQL in Supabase:
                  <code>SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));</code>
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
                  <label>Product Name *</label>
                  <input 
                    type="text" 
                    name="name" 
                    value={formData.name} 
                    onChange={handleInputChange} 
                    required 
                    placeholder="Enter product name"
                  />
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
                    {isLoadingCategories ? (
                      <option value="" disabled>Loading categories...</option>
                    ) : (
                      categories.map(cat => (
                        <option key={cat.id} value={cat.title}>
                          {cat.title}
                        </option>
                      ))
                    )}
                  </select>
                  {formData.category && getCategorySubtitle() && (
                    <div className="category-info">
                      {getCategorySubtitle()}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>Price (₹) *</label>
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
                  <label>Brand</label>
                  <input 
                    type="text" 
                    name="brand" 
                    value={formData.brand} 
                    onChange={handleInputChange}
                    placeholder="Enter brand name"
                    list="brand-suggestions"
                  />
                  <datalist id="brand-suggestions">
                    {BRANDS.map(brand => (
                      <option key={brand} value={brand} />
                    ))}
                  </datalist>
                  <div className="field-info">
                    Type to enter custom brand or select from suggestions
                  </div>
                </div>
                <div className="form-group">
                  <label>Warehouse</label>
                  <select 
                    name="warehouse" 
                    value={formData.warehouse} 
                    onChange={handleInputChange}
                  >
                    <option value="">Select Warehouse (Optional)</option>
                    {isLoadingWarehouses ? (
                      <option value="" disabled>Loading warehouses...</option>
                    ) : (
                      warehouses.map(warehouse => (
                        <option key={warehouse.id} value={warehouse.name}>
                          {warehouse.name} ({warehouse.zone})
                        </option>
                      ))
                    )}
                  </select>
                  <div className="field-info">
                    Select the warehouse where this product is stored
                  </div>
                </div>
                <div className="form-group">
                  <label>Zone</label>
                  <select 
                    name="zone" 
                    value={formData.zone} 
                    onChange={handleInputChange}
                  >
                    <option value="">Select Zone (Optional)</option>
                    {isLoadingZones ? (
                      <option value="" disabled>Loading zones...</option>
                    ) : (
                      zones.map(zone => (
                        <option key={zone.id} value={zone.zone_name}>
                          {zone.zone_name}
                        </option>
                      ))
                    )}
                  </select>
                  <div className="field-info">
                    Select the delivery zone for this product
                  </div>
                </div>
                <div className="form-group">
                  <label>Stock Quantity</label>
                  <input 
                    type="number" 
                    name="stock" 
                    value={formData.stock} 
                    onChange={handleInputChange} 
                    min="0" 
                    placeholder="0"
                  />
                </div>
                <div className="form-group">
                  <label>Profit (₹)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    name="profit" 
                    value={formData.profit} 
                    onChange={handleInputChange} 
                    min="0" 
                    placeholder="Auto-calculated"
                  />
                  <div className="field-info">Auto-calculated as 10% of price</div>
                </div>
                <div className="form-group">
                  <label>Discount</label>
                  <input 
                    type="text" 
                    name="discount" 
                    value={formData.discount} 
                    onChange={handleInputChange} 
                    placeholder="e.g., 15% off or ₹1000 off"
                  />
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
                    placeholder="0.0 - 5.0"
                  />
                </div>
                <div className="form-group">
                  <label>Review Count</label>
                  <input 
                    type="number" 
                    name="reviews" 
                    value={formData.reviews} 
                    onChange={handleInputChange} 
                    min="0" 
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="form-group full-width">
                <label>Description</label>
                <textarea 
                  name="description" 
                  value={formData.description} 
                  onChange={handleInputChange} 
                  rows="4" 
                  placeholder="Enter detailed product description..."
                />
                <div className="field-info">
                  Provide a compelling description that highlights product features and benefits
                </div>
              </div>
            </div>

            {/* Main Image */}
            <div className="form-section">
              <h3>Main Product Image *</h3>
              <div className="form-group">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleMainImageChange} 
                  required 
                />
                <div className="file-info">
                  Accepted formats: JPEG, PNG, WebP | Maximum size: 5MB
                </div>
                {mainImage && (
                  <div className="image-preview">
                    <strong>Selected:</strong> {mainImage.name} 
                    ({(mainImage.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                )}
              </div>
            </div>

            {/* Colors */}
            <div className="form-section">
              <div className="section-header">
                <h3>Product Colors & Variants</h3>
                <span className="section-subtitle">Optional: Add up to 4 colors with images and prices</span>
              </div>
              {colors.map((color, colorIndex) => (
                <div key={colorIndex} className="color-section">
                  <div className="color-header">
                    <h4>Color {colorIndex + 1}</h4>
                    {colors.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => removeColor(colorIndex)} 
                        className="remove-btn"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Color Name</label>
                      <input 
                        type="text" 
                        value={color.name} 
                        onChange={(e) => handleColorChange(colorIndex, 'name', e.target.value)} 
                        placeholder="e.g., Black, Red, Blue (optional)"
                      />
                    </div>
                    <div className="form-group">
                      <label>Color Code</label>
                      <div className="color-input-group">
                        <input 
                          type="text" 
                          value={color.code} 
                          onChange={(e) => handleColorChange(colorIndex, 'code', e.target.value)} 
                          placeholder="#000000 (optional)"
                        />
                        {color.code && (
                          <div 
                            className="color-preview" 
                            style={{ backgroundColor: color.code }}
                            title={color.code}
                          />
                        )}
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Color Price (₹)</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        min="0" 
                        value={color.price} 
                        onChange={(e) => handleColorChange(colorIndex, 'price', e.target.value)} 
                        placeholder="Optional color-specific price"
                      />
                    </div>
                  </div>
                  <div className="images-grid">
                    {[0, 1, 2, 3].map(imgIndex => (
                      <div key={imgIndex} className="form-group">
                        <label>Image {imgIndex + 1}</label>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => handleColorFileChange(colorIndex, imgIndex, e)} 
                        />
                        {color.images[imgIndex] && (
                          <div className="image-preview">
                            Selected: {color.images[imgIndex].name}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {colors.length < 4 && (
                <button type="button" onClick={addColor} className="add-btn">
                  + Add Another Color
                </button>
              )}
            </div>

            {/* Sizes */}
            <div className="form-section">
              <div className="section-header">
                <h3>Available Sizes with Prices</h3>
                <div className="section-actions">
                  <span className="section-subtitle">
                    {formData.category ? `Common sizes for ${formData.category}` : 'Select category first'}
                  </span>
                  {formData.category && (
                    <button 
                      type="button" 
                      onClick={() => {
                        const categorySizes = COMMON_SIZES[formData.category] || ['Standard'];
                        const newSizes = categorySizes.map((size, index) => ({
                          size: size,
                          price: index === 0 ? formData.price : ''
                        }));
                        
                        // Fill remaining slots with empty values
                        while (newSizes.length < 4) {
                          newSizes.push({ size: '', price: '' });
                        }
                        
                        setSizes(newSizes.slice(0, 4));
                      }}
                      className="template-btn"
                    >
                      Apply Default Sizes
                    </button>
                  )}
                </div>
              </div>
              <div className="form-grid">
                {sizes.map((sizeItem, index) => (
                  <div key={index} className="size-group">
                    <div className="form-group">
                      <label>Size {index + 1}</label>
                      <input 
                        type="text" 
                        value={sizeItem.size} 
                        onChange={(e) => handleSizeChange(index, 'size', e.target.value)} 
                        placeholder={`Size ${index + 1} (optional)`}
                        list={formData.category ? `sizes-${formData.category}` : undefined}
                      />
                    </div>
                    <div className="form-group">
                      <label>Price for Size {index + 1} (₹)</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        min="0" 
                        value={sizeItem.price} 
                        onChange={(e) => handleSizeChange(index, 'price', e.target.value)} 
                        placeholder="Optional size-specific price"
                      />
                    </div>
                  </div>
                ))}
              </div>
              {/* Data list for suggested sizes */}
              {formData.category && (
                <datalist id={`sizes-${formData.category}`}>
                  {getAvailableSizes().map((size, idx) => (
                    <option key={idx} value={size} />
                  ))}
                </datalist>
              )}
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
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <span className="loading-spinner"></span>
                    Uploading...
                  </>
                ) : (
                  'Upload Product'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default ProductUpload;