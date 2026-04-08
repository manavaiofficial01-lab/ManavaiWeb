import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import './PromoBannerManager.css';

/**
 * Banner object shape returned from Supabase.
 * @typedef {Object} Banner
 * @property {string} id
 * @property {string} image_url
 * @property {string} action_type
 * @property {string|null} target_id
 * @property {string|null} target_name
 * @property {boolean} is_active
 * @property {number} position
 * @property {string} title
 * @property {string} subtitle
 * @property {string|null} zone
 */

export default function PromoBannerManager() {
  // State for restaurants (plain JS objects)
  const [restaurants, setRestaurants] = useState([]);
  const [banners, setBanners] = useState([]);
  const [form, setForm] = useState({
    image_url: '',
    action_type: 'restaurant',
    target_id: '',
    title: null,
    subtitle: null,
    position: 1,
    is_active: true,
    zone: 'Manapparai',
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  // Load restaurants and existing banners
  useEffect(() => {
    const fetchData = async () => {
      const { data: rest, error: restErr } = await supabase
        .from('restaurants')
        .select('id, name')
        .order('name');
      if (restErr) console.error(restErr);
      else setRestaurants(rest);

      const { data: ban, error: banErr } = await supabase
        .from('promo_banners')
        .select('*')
        .order('position');
      if (banErr) console.error(banErr);
      else setBanners(ban);
    };
    fetchData();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    // Upload to Supabase Storage
    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `banners/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('promo-banners')
      .upload(fileName, file);

    if (error) {
      setToast(`❌ Upload failed: ${error.message}`);
      setPreviewUrl(null);
    } else {
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('promo-banners')
        .getPublicUrl(fileName);
      
      setForm((prev) => ({ ...prev, image_url: publicUrl }));
      setToast('✅ Image uploaded successfully!');
    }
    setUploading(false);
  };

  const handleDelete = async (banner) => {
    if (!confirm('Are you sure you want to delete this banner?')) return;

    setLoading(true);
    
    // Delete from database
    const { error } = await supabase
      .from('promo_banners')
      .delete()
      .eq('id', banner.id);

    if (error) {
      setToast(`❌ ${error.message}`);
    } else {
      // Try to delete from storage if it's our bucket
      if (banner.image_url && banner.image_url.includes('promo-banners')) {
        const path = banner.image_url.split('/').slice(-2).join('/');
        await supabase.storage.from('promo-banners').remove([path]);
      }
      
      setBanners((prev) => prev.filter((b) => b.id !== banner.id));
      setToast('✅ Banner deleted successfully!');
    }
    setLoading(false);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = {
      ...form,
      target_id: form.target_id || null,
    };
    const { data, error } = await supabase.from('promo_banners').insert([payload]);
    if (error) {
      setToast(`❌ ${error.message}`);
    } else {
      setBanners((prev) => [...prev, data[0]]);
      setToast('✅ Banner added successfully!');
      setForm({
        image_url: '',
        action_type: 'restaurant',
        target_id: '',
        title: null,
        subtitle: null,
        position: 1,
        is_active: true,
        zone: 'Manapparai',
      });
      setPreviewUrl(null);
    }
    setLoading(false);
  };

  // Auto‑dismiss toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  return (
    <section className="promo-manager">
      <h1 className="title">Promo Banner Management</h1>

      {toast && <div className="toast">{toast}</div>}

      {/* New banner form */}
      <form className="banner-form glass" onSubmit={handleSubmit}>
        <div className="grid">
          <label className="image-upload-label">
            Banner Image
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <div className="image-upload-area" onClick={triggerFileInput}>
              {previewUrl || form.image_url ? (
                <img 
                  src={previewUrl || form.image_url} 
                  alt="Preview" 
                  className="image-preview"
                />
              ) : (
                <div className="upload-placeholder">
                  <span className="upload-icon">📷</span>
                  <span>{uploading ? 'Uploading...' : 'Click to upload image'}</span>
                </div>
              )}
            </div>
            {form.image_url && (
              <input type="hidden" name="image_url" value={form.image_url} />
            )}
          </label>

          <label>
            Target Restaurant
            <select name="target_id" value={form.target_id ?? ''} onChange={handleChange}>
              <option value="">— Global (no specific restaurant) —</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Zone
            <select name="zone" value={form.zone ?? 'Manapparai'} onChange={handleChange}>
              <option value="Manapparai">Manapparai</option>
              <option value="Other">Other</option>
            </select>
          </label>

          <label>
            Position
            <input
              type="number"
              name="position"
              min={1}
              value={form.position ?? 1}
              onChange={handleChange}
            />
          </label>

          <label className="switch">
            <span className="switch-label">Active</span>
            <input
              type="checkbox"
              name="is_active"
              checked={form.is_active ?? true}
              onChange={handleChange}
            />
            <span className="slider" />
          </label>
        </div>
        <button type="submit" className="btn-primary" disabled={loading || uploading || !form.image_url}>
          {loading ? 'Saving…' : 'Add Banner'}
        </button>
      </form>

      {/* Existing banners list */}
      <div className="section-header">
        <h2>📢 Active Banners</h2>
        <span className="banner-count">{banners.length} banner{banners.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="banner-list">
        {banners.length === 0 ? (
          <div className="empty-state glass">
            <div className="empty-state-icon">📭</div>
            <p>No promo banners yet. Create your first banner above!</p>
          </div>
        ) : (
          banners.map((b) => (
            <article key={b.id} className="banner-card glass">
              <div className="image-container">
                <img src={b.image_url} alt={b.title ?? 'Promo'} loading="lazy" />
                <span className={`status-badge ${b.is_active ? 'active' : 'inactive'}`}>
                  {b.is_active ? 'Active' : 'Inactive'}
                </span>
                <button 
                  className="delete-btn" 
                  onClick={() => handleDelete(b)}
                  title="Delete banner"
                >
                  🗑️
                </button>
              </div>
              <div className="info">
                <div className="meta">
                  <span>{b.target_name || '🌍 Global'}</span>
                  <span className="separator">•</span>
                  <span>Position #{b.position}</span>
                  <span className="separator">•</span>
                  <span>{b.zone || 'Manapparai'}</span>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
