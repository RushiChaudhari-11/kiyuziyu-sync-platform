import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";
import "./BulkEnquiryList.css";

const BulkEnquiryList = () => {
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortByQty, setSortByQty] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    const fetchEnquiries = async () => {
      try {
        const q = query(
          collection(db, "bulkEnquiries"),
          orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setEnquiries(data);
      } catch (error) {
        console.error("Error fetching bulk enquiries:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEnquiries();
  }, []);

  /* ========================
     STATUS UPDATE
  ======================== */

  const handleStatusChange = async (id, newStatus) => {
    try {
      const ref = doc(db, "bulkEnquiries", id);

      await updateDoc(ref, {
        status: newStatus,
        updatedAt: new Date(),
      });

      setEnquiries((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: newStatus } : item
        )
      );
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  /* ========================
     FILTERING LOGIC
  ======================== */

  const filtered = enquiries
    .filter((item) =>
      item.name?.toLowerCase().includes(search.toLowerCase()) ||
      item.phone?.toLowerCase().includes(search.toLowerCase()) ||
      item.productName?.toLowerCase().includes(search.toLowerCase())
    )
    .filter((item) =>
      statusFilter ? item.status === statusFilter : true
    );

  const sortedEnquiries = [...filtered].sort((a, b) => {
    if (!sortByQty) return 0;
    const qtyA = a.quantity || 0;
    const qtyB = b.quantity || 0;
    return sortByQty === "asc" ? qtyA - qtyB : qtyB - qtyA;
  });

  /* ========================
     KPI COUNTS
  ======================== */

  const total = enquiries.length;
  const newCount = enquiries.filter((e) => e.status === "new").length;
  const contactedCount = enquiries.filter((e) => e.status === "contacted").length;
  const closedCount = enquiries.filter((e) => e.status === "closed").length;
  const highQty = enquiries.filter((e) => (e.quantity || 0) >= 1000).length;

  if (loading) {
    return <div className="bulk-loading">Loading bulk enquiries...</div>;
  }

  return (
    <div className="bulk-admin-wrapper">

      {/* ================= KPI CARDS ================= */}
      <div className="bulk-stats">
        <div
          className={`stat-card ${statusFilter === "" ? "active" : ""}`}
          onClick={() => setStatusFilter("")}
        >
          <h4>Total</h4>
          <h2>{total}</h2>
        </div>

        <div
          className={`stat-card ${statusFilter === "new" ? "active" : ""}`}
          onClick={() => setStatusFilter("new")}
        >
          <h4>New</h4>
          <h2>{newCount}</h2>
        </div>

        <div
          className={`stat-card ${statusFilter === "contacted" ? "active" : ""}`}
          onClick={() => setStatusFilter("contacted")}
        >
          <h4>Contacted</h4>
          <h2>{contactedCount}</h2>
        </div>

        <div
          className={`stat-card ${statusFilter === "closed" ? "active" : ""}`}
          onClick={() => setStatusFilter("closed")}
        >
          <h4>Closed</h4>
          <h2>{closedCount}</h2>
        </div>

        <div className="stat-card">
          <h4>High Qty (1000+)</h4>
          <h2>{highQty}</h2>
        </div>
      </div>

      {/* ================= HEADER ================= */}
      <div className="bulk-table-header">
        <h2>Bulk Enquiries</h2>

        <div className="bulk-controls">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="closed">Closed</option>
          </select>

          <select
            value={sortByQty}
            onChange={(e) => setSortByQty(e.target.value)}
          >
            <option value="">Sort by Qty</option>
            <option value="asc">Low → High</option>
            <option value="desc">High → Low</option>
          </select>
        </div>
      </div>

      {/* ================= TABLE ================= */}
      <div className="bulk-table-scroll">
        <table className="bulk-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Product</th>
              <th>Qty</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {sortedEnquiries.length === 0 ? (
              <tr>
                <td colSpan="6" className="no-data">
                  No enquiries found
                </td>
              </tr>
            ) : (
              sortedEnquiries.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>{item.name || "—"}</td>
                  <td>{item.phone || "—"}</td>
                  <td>{item.productName || "—"}</td>
                  <td>{item.quantity || "—"}</td>

                  <td>
                    <select
                      className={`status-dropdown ${item.status || "new"}`}
                      value={item.status || "new"}
                      onChange={(e) =>
                        handleStatusChange(item.id, e.target.value)
                      }
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="closed">Closed</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedImage && (
        <div
          className="image-modal"
          onClick={() => setSelectedImage(null)}
        >
          <img src={selectedImage} alt="Preview" />
        </div>
      )}
    </div>
  );
};

export default BulkEnquiryList;