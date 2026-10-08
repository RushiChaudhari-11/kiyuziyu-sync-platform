import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import './CouponAnalytics.css';

const CouponAnalytics = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDocs(collection(db, 'couponUsages'));
      setLogs(snap.docs.map(d => d.data()));
      setLoading(false);
    };
    fetch();
  }, []);

  /* =========================
     KPIs
  ========================= */

  const totalRevenue = useMemo(
    () => logs.reduce((s, l) => s + (l.orderTotal || 0), 0),
    [logs]
  );

  const totalDiscount = useMemo(
    () => logs.reduce((s, l) => s + (l.discountAmount || 0), 0),
    [logs]
  );

  const totalOrders = logs.length;

  /* =========================
     CHART DATA
  ========================= */

  const usageByDate = useMemo(() => {
    const map = {};
    logs.forEach(l => {
      const d = l.usedAt?.toDate?.().toLocaleDateString();
      if (!d) return;
      map[d] = (map[d] || 0) + 1;
    });
    return Object.entries(map).map(([date, count]) => ({ date, count }));
  }, [logs]);

  const revenueByCoupon = useMemo(() => {
    const map = {};
    logs.forEach(l => {
      map[l.couponCode] = (map[l.couponCode] || 0) + (l.orderTotal || 0);
    });
    return Object.entries(map).map(([coupon, revenue]) => ({
      coupon,
      revenue
    }));
  }, [logs]);

  if (loading) return <p>Loading analytics…</p>;

  return (
    <div className="coupon-analytics-page">
      <h2>Coupon Analytics</h2>

      {/* KPIs */}
      <div className="analytics-kpis">
        <div className="kpi-card">
          <p>Total Coupon Revenue</p>
          <h3>₹{totalRevenue.toLocaleString()}</h3>
        </div>
        <div className="kpi-card">
          <p>Total Discount Given</p>
          <h3>₹{totalDiscount.toLocaleString()}</h3>
        </div>
        <div className="kpi-card">
          <p>Orders Using Coupon</p>
          <h3>{totalOrders}</h3>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">

        <div className="chart-card">
          <h4>Coupon Usage Over Time</h4>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={usageByDate}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line dataKey="count" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h4>Revenue by Coupon</h4>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={revenueByCoupon}>
              <XAxis dataKey="coupon" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="revenue" />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
};

export default CouponAnalytics;
