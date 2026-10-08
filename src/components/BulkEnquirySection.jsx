import React, { useState } from "react";
import "./BulkEnquirySection.css";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";

const MIN_QTY = 200;

const BulkEnquirySection = () => {
  const [activeTab, setActiveTab] = useState("bulk");

  /* =========================
     BULK FORM STATE
  ========================= */
  const [bulkForm, setBulkForm] = useState({
    name: "",
    phone: "",
    productName: "",
    productCode: "",
    quantity: "",
    message: "",
    image: null,
  });

  /* =========================
     PARTNER FORM STATE
  ========================= */
  const [partnerForm, setPartnerForm] = useState({
    name: "",
    phone: "",
    businessType: "",
    budget: "",
    message: "",
  });

  /* =========================
     HANDLERS
  ========================= */
  const handleBulkChange = (e) => {
    const { name, value } = e.target;
    setBulkForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePartnerChange = (e) => {
    const { name, value } = e.target;
    setPartnerForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBulkForm((prev) => ({ ...prev, image: file }));
  };

  const uploadImage = async (file) => {
    if (!file) return null;

    const fileName = `${Date.now()}_${file.name}`;
    const storageRef = ref(storage, `bulk-enquiries/${fileName}`);

    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);

    return { name: fileName, url: downloadURL };
  };

  /* =========================
     BULK SUBMIT
  ========================= */
  const handleBulkSubmit = async (e) => {
    e.preventDefault();

    try {
      let imageData = null;

      if (bulkForm.image) {
        imageData = await uploadImage(bulkForm.image);
      }

      await addDoc(collection(db, "bulkEnquiries"), {
        name: bulkForm.name || "",
        phone: bulkForm.phone || "",
        productName: bulkForm.productName || "",
        productCode: bulkForm.productCode || "",
        quantity: bulkForm.quantity ? Number(bulkForm.quantity) : null,
        message: bulkForm.message || "",
        imageName: imageData?.name || "",
        imageURL: imageData?.url || "",
        source: "website",
        type: "bulk",
        status: "new",
        createdAt: serverTimestamp(),
      });

      alert("Thank you! Our wholesale team will contact you shortly.");

      setBulkForm({
        name: "",
        phone: "",
        productName: "",
        productCode: "",
        quantity: "",
        message: "",
        image: null,
      });
    } catch (error) {
      console.error("Bulk enquiry failed:", error);
      alert("Something went wrong. Please try again.");
    }
  };

  /* =========================
     PARTNER SUBMIT
  ========================= */
  const handlePartnerSubmit = async (e) => {
    e.preventDefault();

    try {
      await addDoc(collection(db, "partnerApplications"), {
        name: partnerForm.name || "",
        phone: partnerForm.phone || "",
        businessType: partnerForm.businessType || "",
        budget: partnerForm.budget || "",
        message: partnerForm.message || "",
        source: "website",
        type: "partner",
        status: "new",
        createdAt: serverTimestamp(),
      });

      alert("Thank you! Our partnership team will contact you shortly.");

      setPartnerForm({
        name: "",
        phone: "",
        businessType: "",
        budget: "",
        message: "",
      });
    } catch (error) {
      console.error("Partner application failed:", error);
      alert("Something went wrong. Please try again.");
    }
  };

  return (
    <section className="bulk-enquiry-section">

      {/* ================= HEADER ================= */}
      <div className="bulk-enquiry-header">
        <h2>Grow With Us — Bulk Orders & Selling Partnership</h2>
        <p>
          Whether you’re placing a high-volume order or looking to become a
          reseller, we’re here to help you scale with premium products and
          unmatched support.
        </p>

      
      </div>

      {/* ================= TAB SWITCHER ================= */}
      <div className="wholesale-tabs">
        <div
          className={`tab-indicator ${
            activeTab === "partner" ? "right" : ""
          }`}
        ></div>

        <button
          type="button"
          className={activeTab === "bulk" ? "active" : ""}
          onClick={() => setActiveTab("bulk")}
        >
          Bulk Order
        </button>

        <button
          type="button"
          className={activeTab === "partner" ? "active" : ""}
          onClick={() => setActiveTab("partner")}
        >
          Become Partner
        </button>
      </div>

      {/* ================= BULK FORM ================= */}
      {activeTab === "bulk" && (
        <form className="bulk-enquiry-form" onSubmit={handleBulkSubmit}>
          <div className="bulk-form-grid">

            <div className="bulk-form-group">
              <label>Your Name</label>
              <input
                name="name"
                value={bulkForm.name}
                onChange={handleBulkChange}
                placeholder="Your name"
                required
              />
            </div>

            <div className="bulk-form-group">
              <label>Contact Number</label>
              <input
                name="phone"
                value={bulkForm.phone}
                onChange={handleBulkChange}
                placeholder="WhatsApp / Phone "
                required
              />
            </div>

            <div className="bulk-form-group">
              <label>Product Name</label>
              <input
                name="productName"
                value={bulkForm.productName}
                onChange={handleBulkChange}
                placeholder="Product name (optional)"
              />
            </div>

            <div className="bulk-form-group">
              <label>Product Code</label>
              <input
                name="productCode"
                value={bulkForm.productCode}
                onChange={handleBulkChange}
                placeholder="SKU / Model (optional)"
              />
            </div>

            <div className="bulk-form-group">
              <label>Required Quantity</label>
              <input
                type="number"
                name="quantity"
                value={bulkForm.quantity}
                onChange={handleBulkChange}
                placeholder={`Minimum ${MIN_QTY}+ (optional)`}
              />
            </div>

            <div className="bulk-form-group">
              <label>Product Image</label>
              <label className="bulk-file-upload">
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={handleImageChange}
                />
                <span>
                  {bulkForm.image
                    ? bulkForm.image.name
                    : "Upload image (optional)"}
                </span>
              </label>
            </div>

            <div className="bulk-form-group full">
              <label>Additional Details</label>
              <textarea
                name="message"
                rows="4"
                value={bulkForm.message}
                onChange={handleBulkChange}
                placeholder="Any extra details (optional)"
              />
            </div>

          </div>

          <div className="bulk-submit">
            <button type="submit">Submit Bulk Enquiry</button>
          </div>

          <div className="bulk-trust">
            🔒 Your details are secure. We usually respond within 24 hours.
          </div>
        </form>
      )}

      {/* ================= PARTNER FORM ================= */}
      {activeTab === "partner" && (
        <form className="bulk-enquiry-form" onSubmit={handlePartnerSubmit}>
          <div className="bulk-form-grid">

            <div className="bulk-form-group">
              <label>Your Name</label>
              <input
                name="name"
                value={partnerForm.name}
                onChange={handlePartnerChange}
                placeholder="Your full name"
              />
            </div>

            <div className="bulk-form-group">
              <label>Contact Number</label>
              <input
                name="phone"
                value={partnerForm.phone}
                onChange={handlePartnerChange}
                placeholder="WhatsApp / Phone"
              />
            </div>

            <div className="bulk-form-group">
              <label>Business Type</label>
              <select
                name="businessType"
                value={partnerForm.businessType}
                onChange={handlePartnerChange}
              >
                <option value="">Select business type</option>
                <option value="wholesaler">Wholesaler</option>
                <option value="retail">Retail Shop</option>
                <option value="instagram">Sell on Instagram</option>
                <option value="ecommerce">Sell on E-commerce</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="bulk-form-group">
              <label>Estimated Budget</label>
              <select
                name="budget"
                value={partnerForm.budget}
                onChange={handlePartnerChange}
              >
                <option value="">Select budget range</option>
                <option value="below-5k">Below ₹5k</option>
                <option value="5k-20k">₹5k – ₹20k</option>
                <option value="20k-50k">₹20k – ₹50K</option>
                <option value="50K-1L">₹50K-₹1L</option>
                <option value="1l-plus">₹1L+</option>
              </select>
            </div>

            <div className="bulk-form-group full">
              <label>Additional Details</label>
              <textarea
                name="message"
                rows="4"
                value={partnerForm.message}
                onChange={handlePartnerChange}
                placeholder="Tell us about your business..."
              />
            </div>

          </div>

          <div className="bulk-submit">
            <button type="submit">Apply for Partnership</button>
          </div>

          <div className="bulk-trust">
            🤝 We review partnership applications within 24–48 hours.
          </div>
        </form>
      )}
    </section>
  );
};

export default BulkEnquirySection;