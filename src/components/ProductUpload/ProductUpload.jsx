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
    profit: '0'
  });

  const [colors, setColors] = useState([{ name: '', code: '', images: Array(4).fill(null) }]);
  const [sizes, setSizes] = useState(Array(4).fill(''));
  const [features, setFeatures] = useState(Array(4).fill({ title: '', desc: '' }));
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

  // Feature templates for all categories
  const FEATURE_TEMPLATES = {
    'Electronics': [
      { title: 'Warranty', desc: '1 Year Manufacturer Warranty' },
      { title: 'Tech Support', desc: '24/7 technical assistance' },
      { title: 'Battery Life', desc: 'Long-lasting battery backup' },
      { title: 'Connectivity', desc: 'Multiple connectivity options' }
    ],
    'Womens': [
      { title: 'Fabric', desc: 'Premium quality fabric' },
      { title: 'Fit', desc: 'Comfortable regular fit' },
      { title: 'Care', desc: 'Machine washable' },
      { title: 'Material', desc: 'High-quality material' }
    ],
    'Furniture': [
      { title: 'Material', desc: 'Solid wood with premium finish' },
      { title: 'Assembly', desc: 'Easy to assemble' },
      { title: 'Warranty', desc: '2 years structural warranty' },
      { title: 'Delivery', desc: 'Professional installation available' }
    ],
    'Snacks': [
      { title: 'Quality', desc: 'Premium quality guaranteed' },
      { title: 'Ingredients', desc: 'Natural ingredients used' },
      { title: 'Shelf Life', desc: 'Long shelf life' },
      { title: 'Packaging', desc: 'Hygienic packaging' }
    ],
    'Home Appliances': [
      { title: 'Warranty', desc: 'Comprehensive warranty' },
      { title: 'Energy Saving', desc: 'Energy efficient' },
      { title: 'Safety', desc: 'Multiple safety features' },
      { title: 'Performance', desc: 'High performance' }
    ],
    'Flowers': [
      { title: 'Freshness', desc: 'Fresh flowers guaranteed' },
      { title: 'Delivery', desc: 'Same day delivery available' },
      { title: 'Packaging', desc: 'Beautiful packaging' },
      { title: 'Quality', desc: 'Premium quality flowers' }
    ],
    'Daily Utilities': [
      { title: 'Quality', desc: 'Premium quality guaranteed' },
      { title: 'Durability', desc: 'Long-lasting performance' },
      { title: 'Usage', desc: 'Daily essential product' },
      { title: 'Value', desc: 'Great value for money' }
    ],
    'Grocery': [
      { title: 'Quality', desc: 'Premium quality guaranteed' },
      { title: 'Freshness', desc: 'Fresh products' },
      { title: 'Packaging', desc: 'Hygienic packaging' },
      { title: 'Origin', desc: 'Quality sourced products' }
    ],
    'Vegetables': [
      { title: 'Freshness', desc: 'Farm fresh vegetables' },
      { title: 'Organic', desc: 'Organically grown' },
      { title: 'Quality', desc: 'Premium quality' },
      { title: 'Nutrition', desc: 'Rich in nutrients' }
    ],
    'Fruits': [
      { title: 'Freshness', desc: 'Fresh seasonal fruits' },
      { title: 'Organic', desc: 'Organically grown' },
      { title: 'Quality', desc: 'Premium quality' },
      { title: 'Nutrition', desc: 'Rich in vitamins' }
    ],
    'Drinks': [
      { title: 'Quality', desc: 'Premium quality beverage' },
      { title: 'Ingredients', desc: 'Natural ingredients' },
      { title: 'Refreshment', desc: 'Refreshing taste' },
      { title: 'Packaging', desc: 'Hygienic packaging' }
    ],
    'Pharmacy': [
      { title: 'Quality', desc: 'Authentic medicines' },
      { title: 'Expiry', desc: 'Long expiry date' },
      { title: 'Safety', desc: 'Properly stored' },
      { title: 'Usage', desc: 'Follow doctor advice' }
    ],
    'Meat & Flesh': [
      { title: 'Freshness', desc: 'Fresh meat products' },
      { title: 'Quality', desc: 'Premium quality' },
      { title: 'Hygiene', desc: 'Hygienically processed' },
      { title: 'Packaging', desc: 'Vacuum sealed packaging' }
    ],
    'Gifts': [
      { title: 'Quality', desc: 'Premium gift item' },
      { title: 'Packaging', desc: 'Beautiful gift wrapping' },
      { title: 'Delivery', desc: 'Special delivery available' },
      { title: 'Occasion', desc: 'Perfect for all occasions' }
    ],
    'Accessories': [
      { title: 'Material', desc: 'High-quality material' },
      { title: 'Design', desc: 'Trendy design' },
      { title: 'Durability', desc: 'Long-lasting' },
      { title: 'Style', desc: 'Fashionable accessory' }
    ],
    'Mens': [
      { title: 'Fabric', desc: 'Premium quality fabric' },
      { title: 'Fit', desc: 'Comfortable regular fit' },
      { title: 'Care', desc: 'Machine washable' },
      { title: 'Material', desc: 'High-quality material' }
    ],
    'Kids': [
      { title: 'Material', desc: 'Child-safe materials' },
      { title: 'Comfort', desc: 'Comfortable for kids' },
      { title: 'Safety', desc: 'Safe for children' },
      { title: 'Quality', desc: 'Premium quality' }
    ],
    'Baby': [
      { title: 'Safety', desc: 'Baby-safe materials' },
      { title: 'Comfort', desc: 'Soft and comfortable' },
      { title: 'Quality', desc: 'Premium quality' },
      { title: 'Hygiene', desc: 'Hygienic and clean' }
    ],
    'Toys': [
      { title: 'Safety', desc: 'Child-safe materials' },
      { title: 'Educational', desc: 'Educational value' },
      { title: 'Durability', desc: 'Long-lasting' },
      { title: 'Age Group', desc: 'Age-appropriate' }
    ],
    'Mobile Accessories': [
      { title: 'Compatibility', desc: 'Universal compatibility' },
      { title: 'Quality', desc: 'Premium quality' },
      { title: 'Durability', desc: 'Long-lasting' },
      { title: 'Warranty', desc: '1 year warranty' }
    ],
    'Jewellery': [
      { title: 'Material', desc: 'Genuine materials' },
      { title: 'Quality', desc: 'Premium craftsmanship' },
      { title: 'Design', desc: 'Elegant design' },
      { title: 'Packaging', desc: 'Beautiful presentation box' }
    ],
    'Stationery': [
      { title: 'Quality', desc: 'Premium quality' },
      { title: 'Durability', desc: 'Long-lasting' },
      { title: 'Usage', desc: 'Smooth performance' },
      { title: 'Value', desc: 'Great value for money' }
    ],
    'Household Items': [
      { title: 'Quality', desc: 'Premium quality' },
      { title: 'Durability', desc: 'Long-lasting' },
      { title: 'Usage', desc: 'Daily household use' },
      { title: 'Value', desc: 'Great value for money' }
    ],
    'Fertilizer': [
      { title: 'Quality', desc: 'Premium quality fertilizer' },
      { title: 'Effectiveness', desc: 'Highly effective' },
      { title: 'Usage', desc: 'Easy to use' },
      { title: 'Results', desc: 'Visible growth results' }
    ]
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

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Auto-populate features when category changes
    if (name === 'category' && value) {
      const template = FEATURE_TEMPLATES[value] || Array(4).fill({ title: '', desc: '' });
      setFeatures(template);
      
      // Auto-populate sizes based on category
      const categorySizes = COMMON_SIZES[value] || ['Standard'];
      const newSizes = [...categorySizes, ...Array(4 - categorySizes.length).fill('')].slice(0, 4);
      setSizes(newSizes);
    }
    
    // Auto-calculate profit if price changes (10% by default)
    if (name === 'price' && value) {
      const priceValue = parseFloat(value);
      if (!isNaN(priceValue) && priceValue > 0) {
        const profitValue = (priceValue * 0.1).toFixed(2);
        setFormData(prev => ({ ...prev, profit: profitValue }));
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
      setColors(prev => [...prev, { name: '', code: '', images: Array(4).fill(null) }]);
    }
  };

  const removeColor = (index) => {
    if (colors.length > 1) {
      setColors(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Handle size changes
  const handleSizeChange = (index, value) => {
    setSizes(prev => prev.map((size, i) => i === index ? value : size));
  };

  // Handle feature changes
  const handleFeatureChange = (index, field, value) => {
    setFeatures(prev => prev.map((feature, i) => 
      i === index ? { ...feature, [field]: value } : feature
    ));
  };

  // Apply feature template
  const applyFeatureTemplate = () => {
    if (formData.category) {
      const template = FEATURE_TEMPLATES[formData.category];
      if (template) {
        setFeatures(template);
        setMessage({ type: 'success', text: `Applied ${formData.category} feature template` });
      }
    }
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
    
    // Validate at least one color has name
    const hasColorName = colors.some(color => color.name.trim());
    if (!hasColorName) errors.push('At least one color name is required');
    
    // Validate at least one color has images
    const hasColorImages = colors.some(color => 
      color.images.some(img => img !== null)
    );
    if (!hasColorImages) errors.push('At least one color image is required');
    
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

      // Upload color images
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

  // Prepare product data - handle null values properly
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Add colors (only for colors with names) - handle null properly
    colors.forEach((color, index) => {
      if (color.name.trim()) {
        const colorImages = imageUrls.colorImages[index] || [];
        productData[`color${index + 1}`] = color.name.trim();
        productData[`color${index + 1}_code`] = color.code.trim() || null;
        productData[`color${index + 1}_image1`] = colorImages[0] || null;
        productData[`color${index + 1}_image2`] = colorImages[1] || null;
        productData[`color${index + 1}_image3`] = colorImages[2] || null;
        productData[`color${index + 1}_image4`] = colorImages[3] || null;
      } else {
        // Explicitly set to null if no color name
        productData[`color${index + 1}`] = null;
        productData[`color${index + 1}_code`] = null;
        productData[`color${index + 1}_image1`] = null;
        productData[`color${index + 1}_image2`] = null;
        productData[`color${index + 1}_image3`] = null;
        productData[`color${index + 1}_image4`] = null;
      }
    });

    // Add sizes (only for non-empty sizes) - handle null properly
    sizes.forEach((size, index) => {
      if (size.trim()) {
        productData[`size${index + 1}`] = size.trim();
      } else {
        productData[`size${index + 1}`] = null;
      }
    });

    // Add features (only for features with titles) - handle null properly
    features.forEach((feature, index) => {
      if (feature.title.trim()) {
        productData[`feature${index + 1}_title`] = feature.title.trim();
        productData[`feature${index + 1}_desc`] = feature.desc.trim() || null;
      } else {
        productData[`feature${index + 1}_title`] = null;
        productData[`feature${index + 1}_desc`] = null;
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
      alert('✅ Product uploaded successfully!\n\nProduct Details:\n• Name: ' + formData.name + '\n• Category: ' + formData.category + '\n• Price: ₹' + formData.price + '\n• Profit: ₹' + formData.profit);
      
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
      rating: '0', reviews: '0', stock: '0', profit: '0'
    });
    setColors([{ name: '', code: '', images: Array(4).fill(null) }]);
    setSizes(Array(4).fill(''));
    setFeatures(Array(4).fill({ title: '', desc: '' }));
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
                <span className="section-subtitle">Add up to 4 colors with images</span>
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
                      <label>Color Name *</label>
                      <input 
                        type="text" 
                        value={color.name} 
                        onChange={(e) => handleColorChange(colorIndex, 'name', e.target.value)} 
                        placeholder="e.g., Black, Red, Blue"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Color Code</label>
                      <div className="color-input-group">
                        <input 
                          type="text" 
                          value={color.code} 
                          onChange={(e) => handleColorChange(colorIndex, 'code', e.target.value)} 
                          placeholder="#000000"
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
                <h3>Available Sizes</h3>
                <div className="section-actions">
                  <span className="section-subtitle">
                    {formData.category ? `Common sizes for ${formData.category}` : 'Select category first'}
                  </span>
                  {formData.category && (
                    <button 
                      type="button" 
                      onClick={() => {
                        const categorySizes = COMMON_SIZES[formData.category] || ['Standard'];
                        const newSizes = [...categorySizes, ...Array(4 - categorySizes.length).fill('')].slice(0, 4);
                        setSizes(newSizes);
                      }}
                      className="template-btn"
                    >
                      Apply Default Sizes
                    </button>
                  )}
                </div>
              </div>
              <div className="form-grid">
                {sizes.map((size, index) => (
                  <div key={index} className="form-group">
                    <label>Size {index + 1}</label>
                    <input 
                      type="text" 
                      value={size} 
                      onChange={(e) => handleSizeChange(index, e.target.value)} 
                      placeholder={`Size ${index + 1}`}
                      list={formData.category ? `sizes-${formData.category}` : undefined}
                    />
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

            {/* Features */}
            <div className="form-section">
              <div className="section-header">
                <h3>Product Features</h3>
                <div className="section-actions">
                  <span className="section-subtitle">
                    Key features and specifications
                  </span>
                  {formData.category && (
                    <button 
                      type="button" 
                      onClick={applyFeatureTemplate}
                      className="template-btn"
                    >
                      Apply Template
                    </button>
                  )}
                </div>
              </div>
              {features.map((feature, index) => (
                <div key={index} className="feature-section">
                  <h4>Feature {index + 1}</h4>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Title</label>
                      <input 
                        type="text" 
                        value={feature.title} 
                        onChange={(e) => handleFeatureChange(index, 'title', e.target.value)} 
                        placeholder="Feature title"
                      />
                    </div>
                    <div className="form-group">
                      <label>Description</label>
                      <input 
                        type="text" 
                        value={feature.desc} 
                        onChange={(e) => handleFeatureChange(index, 'desc', e.target.value)} 
                        placeholder="Feature description"
                      />
                    </div>
                  </div>
                </div>
              ))}
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