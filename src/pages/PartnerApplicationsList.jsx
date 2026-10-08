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
import "./BulkEnquiryList.css"; // reuse same admin styling

const PartnerApplicationsList = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortByBudget, setSortByBudget] = useState("");

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const q = query(
          collection(db, "partnerApplications"),
          orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setApplications(data);
      } catch (error) {
        console.error("Error fetching partner applications:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, []);

  /* ========================
     STATUS UPDATE
  ======================== */

  const handleStatusChange = async (id, newStatus) => {
    try {
      const ref = doc(db, "partnerApplications", id);

      await updateDoc(ref, {
        status: newStatus,
        updatedAt: new Date(),
      });

      setApplications((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: newStatus } : item
        )
      );
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  /* ========================
     FILTERING
  ======================== */

  const filtered = applications
    .filter((item) =>
      item.name?.toLowerCase().includes(search.toLowerCase()) ||
      item.phone?.toLowerCase().includes(search.toLowerCase()) ||
      item.businessType?.toLowerCase().includes(search.toLowerCase())
    )
    .filter((item) =>
      statusFilter ? item.status === statusFilter : true
    );

  const sorted = [...filtered].sort((a, b) => {
    if (!sortByBudget) return 0;

    const budgetOrder = {
      "below-50k": 1,
      "50k-1l": 2,
      "1l-5l": 3,
      "5l-plus": 4,
    };

    const valA = budgetOrder[a.budget] || 0;
    const valB = budgetOrder[b.budget] || 0;

    return sortByBudget === "asc" ? valA - valB : valB - valA;
  });

  /* ========================
     KPI COUNTS
  ======================== */

  const total = applications.length;
  const newCount = applications.filter((e) => e.status === "new").length;
  const contactedCount = applications.filter((e) => e.status === "contacted").length;
  const closedCount = applications.filter((e) => e.status === "closed").length;

  if (loading) {
    return <div className="bulk-loading">Loading partner applications...</div>;
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
      </div>

      {/* ================= HEADER ================= */}
      <div className="bulk-table-header">
        <h2>Partner Applications</h2>

        <div className="bulk-controls">
          <input
            type="text"
            placeholder="Search by name, phone, business..."
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
            value={sortByBudget}
            onChange={(e) => setSortByBudget(e.target.value)}
          >
            <option value="">Sort by Budget</option>
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
              <th>Business Type</th>
              <th>Budget</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan="6" className="no-data">
                  No partner applications found
                </td>
              </tr>
            ) : (
              sorted.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>{item.name || "—"}</td>
                  <td>{item.phone || "—"}</td>
                  <td>{item.businessType || "—"}</td>
                  <td>{item.budget || "—"}</td>

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
    </div>
  );
};

export default PartnerApplicationsList;