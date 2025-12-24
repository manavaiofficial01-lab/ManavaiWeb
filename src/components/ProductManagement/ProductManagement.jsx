import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabase';
import Navbar from '../Navbar/Navbar';
import "./ProductManagement.css";

const ProductManagement = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'ascending' });
  const [stats, setStats] = useState({
    total: 0,
    inStock: 0,
    outOfStock: 0,
    totalValue: 0
  });
  const [categories, setCategories] = useState([]); // New state for categories
  const [loadingCategories, setLoadingCategories] = useState(false); // Loading state for categories

  // Fetch all categories from product_categories table
  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      const { data, error } = await supabase
        .from('product_categories')
        .select('id, name')
        .order('position', { ascending: true });

      if (error) throw error;

      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setError('Failed to load categories');
    } finally {
      setLoadingCategories(false);
    }
  };

  // Fetch all products
  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError('');

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (error) throw error;

      setProducts(data || []);
      setFilteredProducts(data || []);
      updateStats(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      setError('Failed to load products. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Update statistics
  const updateStats = (productList) => {
    const total = productList.length;
    const inStock = productList.filter(p => p.stock > 0).length;
    const outOfStock = productList.filter(p => p.stock === 0).length;
    const totalValue = productList.reduce((sum, product) => sum + (product.price * product.stock), 0);
    
    setStats({
      total,
      inStock,
      outOfStock,
      totalValue
    });
  };

  // Update product in Supabase
  const updateProduct = async (product) => {
    try {
      setLoading(true);
      setError('');

      const { data, error } = await supabase
        .from('products')
        .update({
          name: product.name,
          brand: product.brand,
          category: product.category,
          price: parseFloat(product.price) || 0,
          profit: parseFloat(product.profit) || 0,
          stock: parseInt(product.stock) || 0,
          rating: parseFloat(product.rating) || 0,
          reviews: parseInt(product.reviews) || 0,
          discount: product.discount,
          main_image_url: product.main_image_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', product.id)
        .select();

      if (error) throw error;

      return data?.[0];
    } catch (error) {
      console.error('Error updating product:', error);
      setError('Failed to update product');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Delete product from Supabase
  const deleteProduct = async (productId) => {
    try {
      setLoading(true);
      setError('');

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error deleting product:', error);
      setError('Failed to delete product');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Create new product in Supabase
  const createProduct = async (productData) => {
    try {
      setLoading(true);
      setError('');

      const { data, error } = await supabase
        .from('products')
        .insert([{
          name: productData.name,
          brand: productData.brand || '',
          category: productData.category || (categories.length > 0 ? categories[0].name : 'Uncategorized'),
          price: parseFloat(productData.price) || 0,
          profit: parseFloat(productData.profit) || 0,
          stock: parseInt(productData.stock) || 0,
          rating: parseFloat(productData.rating) || 0,
          reviews: parseInt(productData.reviews) || 0,
          discount: productData.discount || '',
          main_image_url: productData.main_image_url || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select();

      if (error) throw error;

      return data?.[0];
    } catch (error) {
      console.error('Error creating product:', error);
      setError('Failed to create product');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = async (productId) => {
    try {
      await deleteProduct(productId);
      setProducts(prevProducts => 
        prevProducts.filter(product => product.id !== productId)
      );
      setFilteredProducts(prev => 
        prev.filter(product => product.id !== productId)
      );
      setDeleteConfirm(null);
      fetchProducts(); // Refresh stats
    } catch (error) {
      // Error is handled in deleteProduct function
    }
  };

  const startDeleteConfirm = (product) => {
    setDeleteConfirm(product);
  };

  const cancelDeleteConfirm = () => {
    setDeleteConfirm(null);
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories(); // Fetch categories when component mounts
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.brand && product.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (product.category && product.category.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredProducts(filtered);
    }
  }, [searchTerm, products]);

  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }

    setSortConfig({ key, direction });

    const sortedProducts = [...filteredProducts].sort((a, b) => {
      if (a[key] < b[key]) {
        return direction === 'ascending' ? -1 : 1;
      }
      if (a[key] > b[key]) {
        return direction === 'ascending' ? 1 : -1;
      }
      return 0;
    });

    setFilteredProducts(sortedProducts);
  };

  const handleEditClick = (product) => {
    setEditingProduct({ ...product });
    setDeleteConfirm(null);
  };

  const handleSaveClick = async () => {
    if (!editingProduct) return;

    try {
      const updatedProduct = await updateProduct(editingProduct);
      
      if (updatedProduct) {
        setProducts(prevProducts => 
          prevProducts.map(product => 
            product.id === updatedProduct.id ? updatedProduct : product
          )
        );
        setFilteredProducts(prevProducts => 
          prevProducts.map(product => 
            product.id === updatedProduct.id ? updatedProduct : product
          )
        );
        setEditingProduct(null);
        updateStats(products.map(p => p.id === updatedProduct.id ? updatedProduct : p));
      }
    } catch (error) {
      // Error is handled in updateProduct function
    }
  };

  const handleCancelClick = () => {
    setEditingProduct(null);
  };

  const handleFieldChange = (field, value) => {
    if (editingProduct) {
      setEditingProduct(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleAddNewProduct = () => {
    setEditingProduct({
      id: 'new',
      name: '',
      brand: '',
      category: categories.length > 0 ? categories[0].name : '',
      price: 0,
      profit: 0,
      stock: 0,
      rating: 0,
      reviews: 0,
      discount: '',
      main_image_url: ''
    });
  };

  const handleSaveNewProduct = async () => {
    if (!editingProduct || editingProduct.id !== 'new') return;

    try {
      const newProduct = await createProduct(editingProduct);
      
      if (newProduct) {
        setProducts(prev => [...prev, newProduct]);
        setFilteredProducts(prev => [...prev, newProduct]);
        setEditingProduct(null);
        fetchProducts(); // Refresh stats
      }
    } catch (error) {
      // Error is handled in createProduct function
    }
  };

  const handleCancelNewProduct = () => {
    setEditingProduct(null);
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return '↕️';
    return sortConfig.direction === 'ascending' ? '↑' : '↓';
  };

  return (
    <>
      <Navbar />
      <div className="product-management">
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

          <div className="products-section">
            <div className="section-header">
              <div className="header-title">
                <h1>Product Management</h1>
                <p>Manage all products in your inventory</p>
              </div>
              
              <div className="products-stats">
                <div className="stat-card">
                  <div className="stat-icon">📦</div>
                  <div className="stat-content">
                    <div className="stat-value">{stats.total}</div>
                    <div className="stat-label">Total Products</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">✅</div>
                  <div className="stat-content">
                    <div className="stat-value">{stats.inStock}</div>
                    <div className="stat-label">In Stock</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">⏸️</div>
                  <div className="stat-content">
                    <div className="stat-value">{stats.outOfStock}</div>
                    <div className="stat-label">Out of Stock</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">💰</div>
                  <div className="stat-content">
                    <div className="stat-value">₹{stats.totalValue.toLocaleString()}</div>
                    <div className="stat-label">Total Value</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="controls-section">
              <div className="search-container">
                <i className="icon-search">🔍</i>
                <input
                  type="text"
                  placeholder="Search products by name, brand, or category..."
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
              
              <div className="action-buttons-header">
                <button 
                  className="add-product-btn"
                  onClick={handleAddNewProduct}
                  disabled={loading || editingProduct}
                >
                  <span className="btn-icon">➕</span>
                  Add New Product
                </button>
              </div>
            </div>

            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Loading products...</p>
              </div>
            ) : (
              <div className="products-table-container">
                <table className="products-table">
                  <thead>
                    <tr>
                      <th onClick={() => handleSort('name')} className="sortable-header">
                        Product Information {getSortIcon('name')}
                      </th>
                      <th onClick={() => handleSort('brand')} className="sortable-header">
                        Brand {getSortIcon('brand')}
                      </th>
                      <th onClick={() => handleSort('category')} className="sortable-header">
                        Category {getSortIcon('category')}
                      </th>
                      <th onClick={() => handleSort('price')} className="sortable-header">
                        Price {getSortIcon('price')}
                      </th>
                      <th onClick={() => handleSort('profit')} className="sortable-header">
                        Profit {getSortIcon('profit')}
                      </th>
                      <th onClick={() => handleSort('stock')} className="sortable-header">
                        Stock {getSortIcon('stock')}
                      </th>
                      <th onClick={() => handleSort('rating')} className="sortable-header">
                        Rating {getSortIcon('rating')}
                      </th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editingProduct && editingProduct.id === 'new' && (
                      <tr className="new-product-row">
                        <td className="product-info">
                          <div className="edit-input-container">
                            <input
                              type="text"
                              placeholder="Product Name"
                              value={editingProduct.name}
                              onChange={(e) => handleFieldChange('name', e.target.value)}
                              className="edit-input"
                            />
                            <input
                              type="text"
                              placeholder="Image URL"
                              value={editingProduct.main_image_url}
                              onChange={(e) => handleFieldChange('main_image_url', e.target.value)}
                              className="edit-input image-url"
                            />
                          </div>
                        </td>
                        
                        <td>
                          <input
                            type="text"
                            placeholder="Brand"
                            value={editingProduct.brand}
                            onChange={(e) => handleFieldChange('brand', e.target.value)}
                            className="edit-input"
                          />
                        </td>
                        
                        <td>
                          {loadingCategories ? (
                            <div className="loading-categories">
                              <span>Loading categories...</span>
                            </div>
                          ) : (
                            <select
                              value={editingProduct.category}
                              onChange={(e) => handleFieldChange('category', e.target.value)}
                              className="category-select"
                            >
                              {categories.map(category => (
                                <option key={category.id} value={category.name}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        
                        <td>
                          <div className="edit-input-container">
                            <span className="currency-symbol">₹</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Price"
                              value={editingProduct.price}
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
                              placeholder="Profit"
                              value={editingProduct.profit}
                              onChange={(e) => handleFieldChange('profit', e.target.value)}
                              className="edit-input"
                            />
                          </div>
                        </td>
                        
                        <td>
                          <input
                            type="number"
                            min="0"
                            placeholder="Stock"
                            value={editingProduct.stock}
                            onChange={(e) => handleFieldChange('stock', e.target.value)}
                            className="edit-input"
                          />
                        </td>
                        
                        <td>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="5"
                            placeholder="Rating"
                            value={editingProduct.rating}
                            onChange={(e) => handleFieldChange('rating', e.target.value)}
                            className="edit-input"
                          />
                        </td>
                        
                        <td className="action-buttons">
                          <button 
                            className="save-btn"
                            onClick={handleSaveNewProduct}
                            disabled={loading || !editingProduct.name}
                          >
                            {loading ? 'Saving...' : 'Create'}
                          </button>
                          <button 
                            className="cancel-btn"
                            onClick={handleCancelNewProduct}
                            disabled={loading}
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    )}

                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="no-products">
                          <div className="empty-state">
                            <div className="empty-icon">🔍</div>
                            <h3>{searchTerm ? 'No products found' : 'No products available'}</h3>
                            <p>
                              {searchTerm 
                                ? 'Try adjusting your search terms' 
                                : 'Add your first product to get started'
                              }
                            </p>
                            {!searchTerm && (
                              <button 
                                className="add-first-product-btn"
                                onClick={handleAddNewProduct}
                              >
                                Add First Product
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map(product => (
                        <tr key={product.id} className={product.stock === 0 ? 'out-of-stock-row' : ''}>
                          {editingProduct?.id === product.id ? (
                            <>
                              <td className="product-info">
                                <div className="edit-input-container">
                                  <input
                                    type="text"
                                    value={editingProduct.name}
                                    onChange={(e) => handleFieldChange('name', e.target.value)}
                                    className="edit-input"
                                  />
                                  <input
                                    type="text"
                                    placeholder="Image URL"
                                    value={editingProduct.main_image_url}
                                    onChange={(e) => handleFieldChange('main_image_url', e.target.value)}
                                    className="edit-input image-url"
                                  />
                                </div>
                              </td>
                              
                              <td>
                                <input
                                  type="text"
                                  value={editingProduct.brand}
                                  onChange={(e) => handleFieldChange('brand', e.target.value)}
                                  className="edit-input"
                                />
                              </td>
                              
                              <td>
                                {loadingCategories ? (
                                  <div className="loading-categories">
                                    <span>Loading categories...</span>
                                  </div>
                                ) : (
                                  <select
                                    value={editingProduct.category}
                                    onChange={(e) => handleFieldChange('category', e.target.value)}
                                    className="category-select"
                                  >
                                    {categories.map(category => (
                                      <option key={category.id} value={category.name}>
                                        {category.name}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </td>
                              
                              <td>
                                <div className="edit-input-container">
                                  <span className="currency-symbol">₹</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editingProduct.price}
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
                                    value={editingProduct.profit}
                                    onChange={(e) => handleFieldChange('profit', e.target.value)}
                                    className="edit-input"
                                  />
                                </div>
                              </td>
                              
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  value={editingProduct.stock}
                                  onChange={(e) => handleFieldChange('stock', e.target.value)}
                                  className="edit-input"
                                />
                              </td>
                              
                              <td>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="5"
                                  value={editingProduct.rating}
                                  onChange={(e) => handleFieldChange('rating', e.target.value)}
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
                              <td className="product-info">
                                {product.main_image_url && (
                                  <img 
                                    src={product.main_image_url} 
                                    alt={product.name}
                                    className="product-image"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                    }}
                                  />
                                )}
                                <div className="product-details">
                                  <div className="product-name">{product.name}</div>
                                  {product.discount && (
                                    <div className="product-discount">{product.discount} off</div>
                                  )}
                                </div>
                              </td>
                              
                              <td className="product-brand">
                                <span className={!product.brand ? 'no-brand' : ''}>
                                  {product.brand || 'No brand'}
                                </span>
                              </td>
                              
                              <td className="product-category">
                                <span className="category-badge">{product.category || 'Uncategorized'}</span>
                              </td>
                              
                              <td className="price-cell">
                                <span className="price-amount">₹{product.price.toLocaleString()}</span>
                              </td>
                              
                              <td className="profit-cell">
                                <span className="profit-amount">₹{product.profit ? product.profit.toLocaleString() : 0}</span>
                              </td>
                              
                              <td>
                                <span className={`stock-badge ${product.stock > 0 ? 'in-stock' : 'out-of-stock'}`}>
                                  {product.stock}
                                  {product.stock > 0 && <span className="stock-dot"></span>}
                                </span>
                              </td>
                              
                              <td>
                                <div className="rating">
                                  <span className="stars">
                                    {"★".repeat(Math.floor(product.rating || 0))}
                                    {"☆".repeat(5 - Math.floor(product.rating || 0))}
                                  </span>
                                  <span className="rating-value">{product.rating || 0}</span>
                                </div>
                              </td>
                              
                              <td className="action-buttons">
                                <button 
                                  className="edit-btn"
                                  onClick={() => handleEditClick(product)}
                                  disabled={loading}
                                >
                                  <span className="btn-icon">✏️</span>
                                  Edit
                                </button>
                                <button 
                                  className="delete-btn"
                                  onClick={() => startDeleteConfirm(product)}
                                  disabled={loading}
                                >
                                  <span className="btn-icon">🗑️</span>
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

            <div className="table-footer">
              <div className="footer-info">
                Showing {filteredProducts.length} of {products.length} products
              </div>
              <div className="footer-actions">
                <button 
                  className="refresh-btn"
                  onClick={fetchProducts}
                  disabled={loading}
                >
                  <span className="btn-icon">🔄</span>
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProductManagement;