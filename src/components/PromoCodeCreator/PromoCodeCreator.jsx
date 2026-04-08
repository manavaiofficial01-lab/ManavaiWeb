import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  RotateCcw, 
  Check, 
  AlertCircle,
  Tag,
  Percent,
  IndianRupee,
  Calendar,
  ShoppingBag,
  Store,
  Package,
  Truck,
  ToggleLeft,
  ToggleRight,
  Search,
  X
} from 'lucide-react';
import './PromoCodeCreator.css';
import { format, addDays } from 'date-fns';

const CATEGORIES = [
  { id: 'food', label: 'Food', icon: '🍕' },
  { id: 'electronics', label: 'Electronics', icon: '💻' },
  { id: 'groceries', label: 'Groceries', icon: '🥬' },
  { id: 'fashion', label: 'Fashion', icon: '👕' },
  { id: 'general', label: 'General', icon: '📦' }
];

export default function PromoCodeCreator() {
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [errors, setErrors] = useState({});
  const [shakeFields, setShakeFields] = useState({});
  const [restaurantSearch, setRestaurantSearch] = useState('');
  const [showRestaurantDropdown, setShowRestaurantDropdown] = useState(false);
  const restaurantDropdownRef = useRef(null);

  // Default valid_until is 30 days from now
  const defaultValidUntil = format(addDays(new Date(), 30), "yyyy-MM-dd'T'HH:mm");
  const defaultValidFrom = format(new Date(), "yyyy-MM-dd'T'HH:mm");

  const [form, setForm] = useState({
    code: '',
    description: '',
    is_active: true,
    discount_type: 'percentage',
    discount_value: '',
    maximum_discount: '',
    free_shipping: false,
    max_usage_count: '',
    max_usage_per_user: '',
    usage_count: 0,
    minimum_order_amount: '',
    valid_from: defaultValidFrom,
    valid_until: defaultValidUntil,
    applicable_categories: [],
    applicable_restaurants: [],
    apply_to_all_categories: false,
    apply_to_all_restaurants: false
  });

  // Fetch restaurants on mount
  useEffect(() => {
    const fetchRestaurants = async () => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name')
        .order('name');
      if (error) console.error('Error fetching restaurants:', error);
      else setRestaurants(data || []);
    };
    fetchRestaurants();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (restaurantDropdownRef.current && !restaurantDropdownRef.current.contains(e.target)) {
        setShowRestaurantDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleCodeChange = (e) => {
    const value = e.target.value.toUpperCase().slice(0, 20);
    setForm((prev) => ({ ...prev, code: value }));
    if (errors.code) {
      setErrors((prev) => ({ ...prev, code: null }));
    }
  };

  const handleDiscountTypeChange = (type) => {
    setForm((prev) => ({ 
      ...prev, 
      discount_type: type,
      maximum_discount: type === 'fixed_amount' ? '' : prev.maximum_discount
    }));
  };

  const handleCategoryToggle = (categoryId) => {
    setForm((prev) => {
      const current = prev.applicable_categories;
      const updated = current.includes(categoryId)
        ? current.filter(c => c !== categoryId)
        : [...current, categoryId];
      return { ...prev, applicable_categories: updated };
    });
  };

  const handleRestaurantToggle = (restaurantId) => {
    setForm((prev) => {
      const current = prev.applicable_restaurants;
      const updated = current.includes(restaurantId)
        ? current.filter(r => r !== restaurantId)
        : [...current, restaurantId];
      return { ...prev, applicable_restaurants: updated };
    });
  };

  const handleAllCategoriesToggle = (checked) => {
    setForm((prev) => ({
      ...prev,
      apply_to_all_categories: checked,
      applicable_categories: checked ? [] : prev.applicable_categories
    }));
  };

  const handleAllRestaurantsToggle = (checked) => {
    setForm((prev) => ({
      ...prev,
      apply_to_all_restaurants: checked,
      applicable_restaurants: checked ? [] : prev.applicable_restaurants,
      restaurantSearch: ''
    }));
  };

  const checkCodeUnique = async (code) => {
    const { data } = await supabase
      .from('promo_codes')
      .select('id')
      .eq('code', code)
      .single();
    return !data;
  };

  const validate = async () => {
    const newErrors = {};

    // Code validation
    if (!form.code.trim()) {
      newErrors.code = 'Promo code is required';
    } else if (form.code.length < 3) {
      newErrors.code = 'Code must be at least 3 characters';
    } else {
      const isUnique = await checkCodeUnique(form.code);
      if (!isUnique) {
        newErrors.code = 'This promo code already exists';
      }
    }

    // Discount validation
    const hasDiscountValue = form.discount_value && parseFloat(form.discount_value) > 0;
    if (!hasDiscountValue && !form.free_shipping) {
      newErrors.discount_value = 'Enter a discount value or enable free shipping';
    }

    if (hasDiscountValue && parseFloat(form.discount_value) < 0) {
      newErrors.discount_value = 'Discount value cannot be negative';
    }

    // Max discount only for percentage
    if (form.discount_type === 'percentage' && form.maximum_discount) {
      if (parseFloat(form.maximum_discount) < 0) {
        newErrors.maximum_discount = 'Maximum discount cannot be negative';
      }
    }

    // Min order amount
    if (form.minimum_order_amount && parseFloat(form.minimum_order_amount) < 0) {
      newErrors.minimum_order_amount = 'Minimum order amount cannot be negative';
    }

    // Date validation
    if (form.valid_from && form.valid_until) {
      const fromDate = new Date(form.valid_from);
      const untilDate = new Date(form.valid_until);
      if (untilDate <= fromDate) {
        newErrors.valid_until = 'Valid until must be after valid from';
      }
    }

    // Applicability validation
    if (!form.apply_to_all_categories && form.applicable_categories.length === 0) {
      newErrors.applicable_categories = 'Select at least one category or apply to all';
    }

    if (!form.apply_to_all_restaurants && form.applicable_restaurants.length === 0) {
      newErrors.applicable_restaurants = 'Select at least one restaurant or apply to all';
    }

    setErrors(newErrors);

    // Trigger shake animation for error fields
    if (Object.keys(newErrors).length > 0) {
      const shakeTimeout = {};
      Object.keys(newErrors).forEach((field) => {
        setShakeFields((prev) => ({ ...prev, [field]: true }));
        shakeTimeout[field] = setTimeout(() => {
          setShakeFields((prev) => ({ ...prev, [field]: false }));
        }, 500);
      });
    }

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const isValid = await validate();
    if (!isValid) {
      setLoading(false);
      setToast({ type: 'error', message: 'Please fix the errors below' });
      return;
    }

    const payload = {
      code: form.code.toUpperCase(),
      description: form.description || null,
      is_active: form.is_active,
      discount_type: form.discount_type,
      discount_value: form.discount_value ? parseFloat(form.discount_value) : 0,
      maximum_discount: form.maximum_discount ? parseFloat(form.maximum_discount) : null,
      free_shipping: form.free_shipping,
      max_usage_count: form.max_usage_count ? parseInt(form.max_usage_count) : null,
      max_usage_per_user: form.max_usage_per_user ? parseInt(form.max_usage_per_user) : null,
      usage_count: 0,
      minimum_order_amount: form.minimum_order_amount ? parseFloat(form.minimum_order_amount) : null,
      valid_from: form.valid_from ? new Date(form.valid_from).toISOString() : null,
      valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
      applicable_categories: form.apply_to_all_categories ? null : form.applicable_categories,
      applicable_restaurants: form.apply_to_all_restaurants ? null : form.applicable_restaurants
    };

    const { error } = await supabase.from('promo_codes').insert([payload]);

    if (error) {
      setToast({ type: 'error', message: `Error: ${error.message}` });
    } else {
      setToast({ type: 'success', message: '✅ Promo code created successfully!' });
      handleReset();
    }

    setLoading(false);
  };

  const handleReset = () => {
    setForm({
      code: '',
      description: '',
      is_active: true,
      discount_type: 'percentage',
      discount_value: '',
      maximum_discount: '',
      free_shipping: false,
      max_usage_count: '',
      max_usage_per_user: '',
      usage_count: 0,
      minimum_order_amount: '',
      valid_from: defaultValidFrom,
      valid_until: defaultValidUntil,
      applicable_categories: [],
      applicable_restaurants: [],
      apply_to_all_categories: false,
      apply_to_all_restaurants: false
    });
    setErrors({});
    setRestaurantSearch('');
  };

  const filteredRestaurants = restaurants.filter(r => 
    r.name.toLowerCase().includes(restaurantSearch.toLowerCase())
  );

  const selectedRestaurants = restaurants.filter(r => 
    form.applicable_restaurants.includes(r.id)
  );

  return (
    <section className="promo-code-creator">
      {/* Header */}
      <div className="header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>
        <h1 className="title">
          <Tag size={28} />
          Create Promo Code
        </h1>
        <div className="header-spacer"></div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
          {toast.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-container">
        {/* Basic Info Card */}
        <div className={`form-card ${shakeFields.code ? 'shake' : ''}`}>
          <div className="card-header">
            <Tag size={20} />
            <h3>Basic Info</h3>
          </div>
          
          <div className="form-grid">
            <div className="form-group full-width">
              <label>
                Promo Code *
                <span className="hint">(Max 20 chars, uppercase)</span>
              </label>
              <div className="input-wrapper">
                <input
                  type="text"
                  name="code"
                  value={form.code}
                  onChange={handleCodeChange}
                  placeholder="e.g., SUMMER2024"
                  className={errors.code ? 'error' : ''}
                  maxLength={20}
                />
                {form.code && !errors.code && <Check className="valid-icon" size={18} />}
                {errors.code && <AlertCircle className="error-icon" size={18} />}
              </div>
              {errors.code && <span className="error-text">{errors.code}</span>}
            </div>

            <div className="form-group full-width">
              <label>Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="e.g., 10% off on all orders above ₹500"
                rows={3}
              />
            </div>

            <div className="form-group switch-group">
              <label className="switch-label">
                <span>Active Status</span>
                <div 
                  className={`custom-switch ${form.is_active ? 'active' : ''}`}
                  onClick={() => setForm(prev => ({ ...prev, is_active: !prev.is_active }))}
                >
                  {form.is_active ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                </div>
              </label>
              <span className="switch-hint">
                {form.is_active ? 'Promo code is active' : 'Promo code is inactive'}
              </span>
            </div>
          </div>
        </div>

        {/* Discount Settings Card */}
        <div className={`form-card ${shakeFields.discount_value ? 'shake' : ''}`}>
          <div className="card-header">
            <Percent size={20} />
            <h3>Discount Settings</h3>
          </div>

          <div className="form-grid">
            <div className="form-group full-width">
              <label>Discount Type</label>
              <div className="segmented-control">
                <button
                  type="button"
                  className={form.discount_type === 'percentage' ? 'active' : ''}
                  onClick={() => handleDiscountTypeChange('percentage')}
                >
                  <Percent size={16} />
                  Percentage
                </button>
                <button
                  type="button"
                  className={form.discount_type === 'fixed_amount' ? 'active' : ''}
                  onClick={() => handleDiscountTypeChange('fixed_amount')}
                >
                  <IndianRupee size={16} />
                  Fixed Amount
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>
                Discount Value {form.discount_type === 'percentage' ? '(%)' : '(₹)'}
              </label>
              <div className="input-wrapper">
                {form.discount_type === 'percentage' ? <Percent size={16} /> : <IndianRupee size={16} />}
                <input
                  type="number"
                  name="discount_value"
                  value={form.discount_value}
                  onChange={handleChange}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className={errors.discount_value ? 'error' : ''}
                />
              </div>
              {errors.discount_value && <span className="error-text">{errors.discount_value}</span>}
            </div>

            {form.discount_type === 'percentage' && (
              <div className="form-group">
                <label>Maximum Discount Cap (₹)</label>
                <div className="input-wrapper">
                  <IndianRupee size={16} />
                  <input
                    type="number"
                    name="maximum_discount"
                    value={form.maximum_discount}
                    onChange={handleChange}
                    placeholder="No cap"
                    min="0"
                    step="0.01"
                    className={errors.maximum_discount ? 'error' : ''}
                  />
                </div>
                {errors.maximum_discount && <span className="error-text">{errors.maximum_discount}</span>}
              </div>
            )}

            <div className="form-group switch-group">
              <label className="switch-label">
                <span>Free Shipping</span>
                <div 
                  className={`custom-switch ${form.free_shipping ? 'active' : ''}`}
                  onClick={() => setForm(prev => ({ ...prev, free_shipping: !prev.free_shipping }))}
                >
                  {form.free_shipping ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                </div>
              </label>
              <span className="switch-hint">
                {form.free_shipping ? 'Free shipping enabled' : 'Free shipping disabled'}
              </span>
            </div>
          </div>
        </div>

        {/* Usage Limits Card */}
        <div className="form-card">
          <div className="card-header">
            <Package size={20} />
            <h3>Usage Limits</h3>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Global Max Usage <span className="optional">(Leave empty for unlimited)</span></label>
              <input
                type="number"
                name="max_usage_count"
                value={form.max_usage_count}
                onChange={handleChange}
                placeholder="∞ Unlimited"
                min="1"
              />
            </div>

            <div className="form-group">
              <label>Per-User Max Usage <span className="optional">(Leave empty for unlimited)</span></label>
              <input
                type="number"
                name="max_usage_per_user"
                value={form.max_usage_per_user}
                onChange={handleChange}
                placeholder="∞ Unlimited"
                min="1"
              />
            </div>

            <div className="form-group readonly">
              <label>Current Usage Counter</label>
              <div className="readonly-value">{form.usage_count}</div>
            </div>
          </div>
        </div>

        {/* Order Requirements Card */}
        <div className={`form-card ${shakeFields.minimum_order_amount ? 'shake' : ''} ${shakeFields.valid_until ? 'shake' : ''}`}>
          <div className="card-header">
            <ShoppingBag size={20} />
            <h3>Order Requirements</h3>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Minimum Order Amount (₹)</label>
              <div className="input-wrapper">
                <IndianRupee size={16} />
                <input
                  type="number"
                  name="minimum_order_amount"
                  value={form.minimum_order_amount}
                  onChange={handleChange}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className={errors.minimum_order_amount ? 'error' : ''}
                />
              </div>
              {errors.minimum_order_amount && <span className="error-text">{errors.minimum_order_amount}</span>}
            </div>

            <div className="form-group">
              <label>Valid From</label>
              <div className="input-wrapper">
                <Calendar size={16} />
                <input
                  type="datetime-local"
                  name="valid_from"
                  value={form.valid_from}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Valid Until</label>
              <div className="input-wrapper">
                <Calendar size={16} />
                <input
                  type="datetime-local"
                  name="valid_until"
                  value={form.valid_until}
                  onChange={handleChange}
                  className={errors.valid_until ? 'error' : ''}
                />
              </div>
              {errors.valid_until && <span className="error-text">{errors.valid_until}</span>}
            </div>
          </div>
        </div>

        {/* Applicability Card */}
        <div className={`form-card ${shakeFields.applicable_categories ? 'shake' : ''} ${shakeFields.applicable_restaurants ? 'shake' : ''}`}>
          <div className="card-header">
            <Store size={20} />
            <h3>Applicability</h3>
          </div>

          <div className="form-grid">
            {/* Categories Section */}
            <div className="form-group full-width">
              <div className="applicability-header">
                <label>Applicable Categories</label>
                <label className="switch-inline">
                  <span>Apply to all</span>
                  <div 
                    className={`custom-switch small ${form.apply_to_all_categories ? 'active' : ''}`}
                    onClick={() => handleAllCategoriesToggle(!form.apply_to_all_categories)}
                  >
                    {form.apply_to_all_categories ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                  </div>
                </label>
              </div>

              {!form.apply_to_all_categories && (
                <div className="category-grid">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`category-chip ${form.applicable_categories.includes(cat.id) ? 'selected' : ''}`}
                      onClick={() => handleCategoryToggle(cat.id)}
                    >
                      <span className="category-icon">{cat.icon}</span>
                      <span>{cat.label}</span>
                      {form.applicable_categories.includes(cat.id) && <Check size={14} />}
                    </button>
                  ))}
                </div>
              )}
              {errors.applicable_categories && !form.apply_to_all_categories && (
                <span className="error-text">{errors.applicable_categories}</span>
              )}
            </div>

            {/* Restaurants Section */}
            <div className="form-group full-width">
              <div className="applicability-header">
                <label>Applicable Restaurants</label>
                <label className="switch-inline">
                  <span>Apply to all</span>
                  <div 
                    className={`custom-switch small ${form.apply_to_all_restaurants ? 'active' : ''}`}
                    onClick={() => handleAllRestaurantsToggle(!form.apply_to_all_restaurants)}
                  >
                    {form.apply_to_all_restaurants ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                  </div>
                </label>
              </div>

              {!form.apply_to_all_restaurants && (
                <div className="restaurant-selector" ref={restaurantDropdownRef}>
                  <div className="search-wrapper">
                    <Search size={16} />
                    <input
                      type="text"
                      placeholder="Search restaurants..."
                      value={restaurantSearch}
                      onChange={(e) => {
                        setRestaurantSearch(e.target.value);
                        setShowRestaurantDropdown(true);
                      }}
                      onFocus={() => setShowRestaurantDropdown(true)}
                    />
                  </div>

                  {/* Selected Restaurants Tags */}
                  {selectedRestaurants.length > 0 && (
                    <div className="selected-restaurants">
                      {selectedRestaurants.map((restaurant) => (
                        <span key={restaurant.id} className="restaurant-tag">
                          {restaurant.name}
                          <button
                            type="button"
                            onClick={() => handleRestaurantToggle(restaurant.id)}
                          >
                            <X size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Dropdown */}
                  {showRestaurantDropdown && (
                    <div className="restaurant-dropdown">
                      {filteredRestaurants.length === 0 ? (
                        <div className="dropdown-empty">No restaurants found</div>
                      ) : (
                        filteredRestaurants.map((restaurant) => (
                          <button
                            key={restaurant.id}
                            type="button"
                            className={`dropdown-item ${form.applicable_restaurants.includes(restaurant.id) ? 'selected' : ''}`}
                            onClick={() => handleRestaurantToggle(restaurant.id)}
                          >
                            <Store size={16} />
                            <span>{restaurant.name}</span>
                            {form.applicable_restaurants.includes(restaurant.id) && <Check size={16} />}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
              {errors.applicable_restaurants && !form.apply_to_all_restaurants && (
                <span className="error-text">{errors.applicable_restaurants}</span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Creating...
              </>
            ) : (
              <>
                <Plus size={20} />
                Create Promo Code
              </>
            )}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleReset}
            disabled={loading}
          >
            <RotateCcw size={20} />
            Reset Form
          </button>
        </div>
      </form>
    </section>
  );
}
