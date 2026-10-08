import React, { useState } from "react";
import BulkEnquiryList from "./BulkEnquiryList";
import PartnerApplicationsList from "./PartnerApplicationsList";
import "./AdminLeadsDashboard.css";

const AdminLeadsDashboard = () => {
  const [activeTab, setActiveTab] = useState("bulk");

  return (
    <div className="admin-leads-wrapper">

      {/* PAGE HEADER */}
      <div className="admin-header">
        <h1>Leads Management</h1>
        <p>Manage bulk enquiries and partner applications in one place.</p>
      </div>

      {/* TAB SWITCHER */}
      <div className="admin-tabs">
        <div
          className={`tab-indicator ${
            activeTab === "partner" ? "right" : ""
          }`}
        ></div>

        <button
          className={activeTab === "bulk" ? "active" : ""}
          onClick={() => setActiveTab("bulk")}
        >
          📦 Bulk Enquiries
        </button>

        <button
          className={activeTab === "partner" ? "active" : ""}
          onClick={() => setActiveTab("partner")}
        >
          🤝 Partner Applications
        </button>
      </div>

      {/* CONTENT */}
      <div className="admin-content">
        {activeTab === "bulk" ? (
          <BulkEnquiryList />
        ) : (
          <PartnerApplicationsList />
        )}
      </div>

    </div>
  );
};

export default AdminLeadsDashboard;