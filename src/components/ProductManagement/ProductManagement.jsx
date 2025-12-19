import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabase';
import Navbar from '../Navbar/Navbar';
import "./ProductManagement.css";

const ProductManagement = () => {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Fetch categories from product_categories table
  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError('');

      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .order('position', { ascending: true, nullsFirst: false })
        .order('name');

      if (error) throw error;

      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setError('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  // Fetch products by category
  const fetchProductsByCategory = async (category) => {
    try {
      setLoading(true);
      setError('');

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('category', category.name)
        .order('name');

      if (error) throw error;

      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  // Update product in Supabase
  const updateProduct = async (product) => {
    try {
      setLoading(true);
      setError('');

      const { data, error } = await supabase
        .from('products')
        .update({
          price: product.price,
          profit: product.profit,
          stock: product.stock,
          rating: product.rating,
          reviews: product.reviews,
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

  const handleDeleteClick = async (productId) => {
    try {
      await deleteProduct(productId);
      setProducts(prevProducts => 
        prevProducts.filter(product => product.id !== productId)
      );
      setDeleteConfirm(null);
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
    fetchCategories();
  }, []);

  const handleCategoryClick = (category) => {
    setSelectedCategory(category);
    fetchProductsByCategory(category);
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
    setProducts([]);
    setSearchTerm('');
    setError('');
    setDeleteConfirm(null);
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
        setEditingProduct(null);
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
        [field]: field === 'price' || field === 'profit' || field === 'rating' 
          ? parseFloat(value) || 0
          : field === 'stock' || field === 'reviews'
          ? parseInt(value) || 0
          : value
      }));
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.brand && product.brand.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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

          {!selectedCategory ? (
            // Category Cards View
            <div className="categories-section">
              <div className="section-header">
                <h1>Product Management</h1>
                <p className="section-subtitle">Select a category to manage products</p>
              </div>
              
              {loading ? (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <p>Loading categories...</p>
                </div>
              ) : categories.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📁</div>
                  <h3>No Categories Found</h3>
                  <p>Please add categories to the product_categories table.</p>
                </div>
              ) : (
                <div className="categories-grid">
                  {categories.map(category => (
                    <div 
                      key={category.id}
                      className="category-card"
                      onClick={() => handleCategoryClick(category)}
                    >
                      <div className="category-card-inner">
                        {category.image && (
                          <div className="category-image">
                            <img 
                              src={category.image} 
                              alt={category.name}
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                        <div className={`category-content ${!category.image ? 'no-image' : ''}`}>
                          <div className="category-header">
                            <h3>{category.name}</h3>
                            {category.navigation && (
                              <div className="category-navigation-badge">
                                {category.navigation}
                              </div>
                            )}
                          </div>
                          <div className="category-meta">
                            {category.position && (
                              <span className="category-position">
                                Position: {category.position}
                              </span>
                            )}
                          </div>
                          <div className="category-footer">
                            <span className="category-cta">Manage Products</span>
                            <span className="category-arrow">→</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Products Table View
            <div className="products-section">
              <div className="section-header">
                <div className="header-top">
                  <button 
                    className="back-button"
                    onClick={handleBackToCategories}
                  >
                    <span className="back-arrow">←</span>
                    All Categories
                  </button>
                  <div className="header-title">
                    <h1>{selectedCategory.name}</h1>
                    <p>
                      {selectedCategory.navigation 
                        ? `Navigation: ${selectedCategory.navigation}` 
                        : `Manage ${selectedCategory.name} products`
                      }
                    </p>
                    {selectedCategory.image && (
                      <div className="category-image-info">
                        <small>Category Image: {selectedCategory.image}</small>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="products-stats">
                  <div className="stat-card">
                    <div className="stat-icon">📦</div>
                    <div className="stat-content">
                      <div className="stat-value">{products.length}</div>
                      <div className="stat-label">Total Products</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">🔍</div>
                    <div className="stat-content">
                      <div className="stat-value">{filteredProducts.length}</div>
                      <div className="stat-label">Filtered</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">✅</div>
                    <div className="stat-content">
                      <div className="stat-value">{products.filter(p => p.stock > 0).length}</div>
                      <div className="stat-label">In Stock</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">⏸️</div>
                    <div className="stat-content">
                      <div className="stat-value">{products.filter(p => p.stock === 0).length}</div>
                      <div className="stat-label">Out of Stock</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="search-section">
                <div className="search-container">
                  <i className="icon-search">🔍</i>
                  <input
                    type="text"
                    placeholder="Search products by name or brand..."
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
                  <p>Loading products...</p>
                </div>
              ) : (
                <div className="products-table-container">
                  <table className="products-table">
                    <thead>
                      <tr>
                        <th>Product Information</th>
                        <th>Brand</th>
                        <th>Price</th>
                        <th>Profit</th>
                        <th>Stock</th>
                        <th>Rating</th>
                        <th>Reviews</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="no-products">
                            <div className="empty-state">
                              <div className="empty-icon">🔍</div>
                              <h3>{searchTerm ? 'No products found' : 'No products in this category'}</h3>
                              <p>
                                {searchTerm 
                                  ? 'Try adjusting your search terms' 
                                  : 'Add products to get started'
                                }
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredProducts.map(product => (
                          <tr key={product.id} className={product.stock === 0 ? 'out-of-stock-row' : ''}>
                            <td className="product-info">
                              {product.main_image_url && (
                                <img 
                                  src={product.main_image_url} 
                                  alt={product.name}
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
                            
                            {editingProduct?.id === product.id ? (
                              <>
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
                                <td>
                                  <input
                                    type="number"
                                    min="0"
                                    value={editingProduct.reviews}
                                    onChange={(e) => handleFieldChange('reviews', e.target.value)}
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
                                  <span className="price-amount">₹{product.price}</span>
                                </td>
                                <td className="profit-cell">
                                  <span className="profit-amount">₹{product.profit || 0}</span>
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
                                <td className="reviews-cell">
                                  <span className="reviews-count">{product.reviews || 0}</span>
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
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ProductManagement;