import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  getDocs,
  query,
  orderBy,
} from 'firebase/firestore';
import { useLocation } from 'react-router-dom';
import { db } from '../firebase';
import './CouponUsageHistory.css';

/* 🔑 Must match roles */
const ROLES = [
  'retailer',
  'wholesaler',
  'distributor',
  'dealer',
  'vip',
  'dropshipping'
];

const CouponUsageHistory = () => {
  const location = useLocation();

  const preselectedCoupon =
    location.state?.couponCode || '';

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  /* 🔎 Filters */
  const [search, setSearch] = useState(preselectedCoupon);
  const [roleFilter, setRoleFilter] = useState('all');

  /* =========================
     FETCH HISTORY
  ========================= */
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const q = query(
          collection(db, 'couponUsages'),
          orderBy('usedAt', 'desc')
        );
        const snap = await getDocs(q);

        setLogs(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
      } catch (err) {
        console.error(
          'Failed to fetch coupon usage history',
          err
        );
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  /* =========================
     FILTERED DATA
  ========================= */
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const searchLower = search.toLowerCase();

      const matchesSearch =
        log.couponCode?.toLowerCase().includes(searchLower) ||
        log.userId?.toLowerCase().includes(searchLower) ||
        log.orderId?.toLowerCase().includes(searchLower);

      const matchesRole =
        roleFilter === 'all' || log.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [logs, search, roleFilter]);

  /* =========================
     HELPERS
  ========================= */
  const shortId = (id) =>
    id ? `${id.slice(0, 6)}…${id.slice(-4)}` : '—';

  /* =========================
     RENDER
  ========================= */
  return (
    <div className="coupon-history-page">
      <h2>Coupon Usage History</h2>

      {/* FILTER BAR */}
      <div className="coupon-history-filters">
        <input
          type="text"
          placeholder="Search coupon, user or order ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="all">All Roles</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>

      {/* CONTENT */}
      {loading ? (
        <p className="loading-text">
          Loading coupon usage…
        </p>
      ) : filteredLogs.length === 0 ? (
        <p className="empty-text">
          No coupon usage found.
        </p>
      ) : (
        <div className="table-wrapper">
          <table className="coupon-history-table">
            <thead>
              <tr>
                <th>Coupon</th>
                <th>Order ID</th>
                <th>User</th>
                <th>Role</th>
                <th>Discount</th>
                <th>Order Total</th>
                <th>Used At</th>
              </tr>
            </thead>

            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  {/* Coupon */}
                  <td className="coupon-code">
                    {log.couponCode || '—'}
                  </td>

                  {/* Order ID */}
                  <td
                    className="order-id"
                    title={log.orderId}
                  >
                    {shortId(log.orderId)}
                  </td>

                  {/* User */}
                  <td
                    className="user-id"
                    title={log.userId}
                  >
                    {shortId(log.userId) || 'Guest'}
                  </td>

                  {/* Role */}
                  <td>
                    <span
                      className={`role-badge ${log.role}`}
                    >
                      {log.role || '—'}
                    </span>
                  </td>

                  {/* Discount */}
                  <td className="discount-amount">
                    ₹
                    {Number(
                      log.discountAmount || 0
                    ).toFixed(2)}
                  </td>

                  {/* Order Total */}
                  <td>
                    ₹
                    {Number(
                      log.orderTotal || 0
                    ).toFixed(2)}
                  </td>

                  {/* Used At */}
                  <td>
                    {log.usedAt?.toDate
                      ? log.usedAt
                          .toDate()
                          .toLocaleString()
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CouponUsageHistory;
