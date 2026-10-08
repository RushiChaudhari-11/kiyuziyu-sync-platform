import React, { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  setDoc,
  doc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import './CouponAdmin.css';

/* 🔑 MUST MATCH roles.js EXACTLY */
const ROLES = [
  'retailer',
  'wholesaler',
  'distributor',
  'dealer',
  'vip',
  'dropshipping',
];

const CouponAdmin = () => {
  const navigate = useNavigate();

  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);

  const [form, setForm] = useState({
    code: '',
    type: 'percentage',
    value: '',
    minOrderValue: '',
    maxUses: '',
    maxUsesPerUser: '',
    allowedRoles: [],
    expiry: '',
    isActive: true,
  });

  /* =====================
     FETCH COUPONS
  ===================== */
  const fetchCoupons = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, 'coupons'));
    setCoupons(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  /* =====================
     FORM HANDLERS
  ===================== */
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleRoleToggle = (role, target = 'form') => {
    const updater = target === 'edit' ? setEditingCoupon : setForm;

    updater(prev => ({
      ...prev,
      allowedRoles: prev.allowedRoles.includes(role)
        ? prev.allowedRoles.filter(r => r !== role)
        : [...prev.allowedRoles, role],
    }));
  };

  /* =====================
     CREATE COUPON
  ===================== */
  const handleSubmit = async (e) => {
    e.preventDefault();

    const code = form.code.trim().toUpperCase();
    if (!code) return alert('Coupon code required');

    await setDoc(doc(db, 'coupons', code), {
      code,
      type: form.type,
      value: Number(form.value),
      minOrderValue: Number(form.minOrderValue || 0),
      maxUses: Number(form.maxUses || 0),
      maxUsesPerUser: Number(form.maxUsesPerUser || 0),
      usedCount: 0,
      allowedRoles: form.allowedRoles,
      isActive: form.isActive,
      expiry: Timestamp.fromDate(new Date(form.expiry)),
      createdAt: Timestamp.now(),
    });

    setForm({
      code: '',
      type: 'percentage',
      value: '',
      minOrderValue: '',
      maxUses: '',
      maxUsesPerUser: '',
      allowedRoles: [],
      expiry: '',
      isActive: true,
    });

    fetchCoupons();
  };

  /* =====================
     UPDATE COUPON
  ===================== */
  const handleUpdateCoupon = async () => {
    await updateDoc(doc(db, 'coupons', editingCoupon.code), {
      type: editingCoupon.type,
      value: Number(editingCoupon.value),
      minOrderValue: Number(editingCoupon.minOrderValue || 0),
      maxUses: Number(editingCoupon.maxUses || 0),
      maxUsesPerUser: Number(editingCoupon.maxUsesPerUser || 0),
      allowedRoles: editingCoupon.allowedRoles,
      isActive: editingCoupon.isActive,
      expiry: Timestamp.fromDate(new Date(editingCoupon.expiry)),
    });

    setEditingCoupon(null);
    fetchCoupons();
  };

  /* =====================
     TOGGLE ACTIVE
  ===================== */
  const toggleActive = async (coupon) => {
    await updateDoc(doc(db, 'coupons', coupon.code), {
      isActive: !coupon.isActive,
    });
    fetchCoupons();
  };

  /* =====================
     DELETE
  ===================== */
  const deleteCoupon = async (code) => {
    if (!window.confirm('Delete this coupon?')) return;
    await deleteDoc(doc(db, 'coupons', code));
    fetchCoupons();
  };

  return (
    <div className="coupon-admin-page">
      <button
  className="view-analytics-btn"
  onClick={() => navigate('/admin/coupon-analytics')}
>
  📊 View Analytics
</button>

      <h2>Coupon Admin</h2>

      {/* CREATE FORM */}
      <form className="coupon-form" onSubmit={handleSubmit}>
        <input
          name="code"
          placeholder="Coupon Code"
          value={form.code}
          onChange={handleChange}
          required
        />

        <select name="type" value={form.type} onChange={handleChange}>
          <option value="percentage">Percentage (%)</option>
          <option value="flat">Flat Amount (₹)</option>
        </select>

        <input
          name="value"
          type="number"
          placeholder="Discount value"
          value={form.value}
          onChange={handleChange}
          required
        />

        <input
          name="minOrderValue"
          type="number"
          placeholder="Minimum Order"
          value={form.minOrderValue}
          onChange={handleChange}
        />

        <input
          name="maxUses"
          type="number"
          placeholder="Global Max Uses"
          value={form.maxUses}
          onChange={handleChange}
        />

        <input
          name="maxUsesPerUser"
          type="number"
          placeholder="Max Uses Per User"
          value={form.maxUsesPerUser}
          onChange={handleChange}
        />

        <input
          type="date"
          name="expiry"
          value={form.expiry}
          onChange={handleChange}
          required
        />

        <div className="role-selector">
          {ROLES.map(r => (
            <label key={r}>
              <input
                type="checkbox"
                checked={form.allowedRoles.includes(r)}
                onChange={() => handleRoleToggle(r)}
              />
              {r}
            </label>
          ))}
        </div>

        <label className="active-toggle">
          <input
            type="checkbox"
            name="isActive"
            checked={form.isActive}
            onChange={handleChange}
          />
          Active
        </label>

        <button type="submit">Create Coupon</button>
      </form>

      {/* LIST */}
      <h3>Existing Coupons</h3>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="coupon-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Type</th>
              <th>Value</th>
              <th>Used</th>
              <th>Per User</th>
              <th>Active</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {coupons.map(c => (
              <tr key={c.code}>
                <td>{c.code}</td>
                <td>{c.type}</td>
                <td>{c.value}</td>
                <td>{c.usedCount}/{c.maxUses || '∞'}</td>
                <td>{c.maxUsesPerUser || '∞'}</td>
                <td>{c.isActive ? 'Yes' : 'No'}</td>
                <td className="actions-cell">
                  <button onClick={() => setEditingCoupon(c)}>Edit</button>

                  <button onClick={() => toggleActive(c)}>
                    {c.isActive ? 'Disable' : 'Enable'}
                  </button>

                  <button
                    className="view-usage-btn"
                    onClick={() =>
                      navigate('/admin/coupons/usage', {
                        state: { couponCode: c.code },
                      })
                    }
                  >
                    View Usage
                  </button>

                  <button onClick={() => deleteCoupon(c.code)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* EDIT MODAL */}
      {editingCoupon && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Edit Coupon: {editingCoupon.code}</h3>

            <select
              value={editingCoupon.type}
              onChange={(e) =>
                setEditingCoupon({ ...editingCoupon, type: e.target.value })
              }
            >
              <option value="percentage">Percentage (%)</option>
              <option value="flat">Flat Amount (₹)</option>
            </select>

            <input
              type="number"
              value={editingCoupon.value}
              onChange={(e) =>
                setEditingCoupon({ ...editingCoupon, value: e.target.value })
              }
            />

            <input
              type="number"
              value={editingCoupon.minOrderValue}
              onChange={(e) =>
                setEditingCoupon({
                  ...editingCoupon,
                  minOrderValue: e.target.value,
                })
              }
            />

            <input
              type="number"
              value={editingCoupon.maxUses}
              onChange={(e) =>
                setEditingCoupon({ ...editingCoupon, maxUses: e.target.value })
              }
            />

            <input
              type="number"
              value={editingCoupon.maxUsesPerUser || ''}
              onChange={(e) =>
                setEditingCoupon({
                  ...editingCoupon,
                  maxUsesPerUser: e.target.value,
                })
              }
            />

            <input
              type="date"
              value={
                editingCoupon.expiry?.toDate
                  ? editingCoupon.expiry.toDate().toISOString().split('T')[0]
                  : editingCoupon.expiry
              }
              onChange={(e) =>
                setEditingCoupon({ ...editingCoupon, expiry: e.target.value })
              }
            />

            <div className="role-selector">
              {ROLES.map(r => (
                <label key={r}>
                  <input
                    type="checkbox"
                    checked={editingCoupon.allowedRoles?.includes(r)}
                    onChange={() => handleRoleToggle(r, 'edit')}
                  />
                  {r}
                </label>
              ))}
            </div>

            <label className="active-toggle">
              <input
                type="checkbox"
                checked={editingCoupon.isActive}
                onChange={(e) =>
                  setEditingCoupon({
                    ...editingCoupon,
                    isActive: e.target.checked,
                  })
                }
              />
              Active
            </label>

            <div className="modal-actions">
              <button onClick={handleUpdateCoupon}>Save</button>
              <button onClick={() => setEditingCoupon(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CouponAdmin;
