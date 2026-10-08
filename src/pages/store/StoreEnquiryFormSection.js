import React, { useState } from "react";
import {
  addDoc,
  collection,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { getCleanDomain } from "../../utils/domain";
import "./StoreEnquiryFormSection.css";

const EnquiryFormSection = ({ data, theme }) => {
  const [storeEnquiryForm, setStoreEnquiryForm] = useState({
    name: "",
    phone: "",
    email: "",
    message: "",
  });

  const [storeEnquiryLoading, setStoreEnquiryLoading] = useState(false);
  const [storeEnquirySuccess, setStoreEnquirySuccess] = useState(false);
  const [storeEnquiryError, setStoreEnquiryError] = useState("");

  const handleStoreEnquiryChange = (e) => {
    setStoreEnquiryForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleStoreEnquirySubmit = async (e) => {
    e.preventDefault();

    setStoreEnquiryLoading(true);
    setStoreEnquiryError("");
    setStoreEnquirySuccess(false);

    try {
      const domain = getCleanDomain();

      await setDoc(
        doc(db, "storeEnquiries", domain),
        {
          domain,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await addDoc(
        collection(
          db,
          "storeEnquiries",
          domain,
          "enquiries"
        ),
        {
          ...storeEnquiryForm,
          domain,
          createdAt: serverTimestamp(),
        }
      );

      setStoreEnquirySuccess(true);

      setStoreEnquiryForm({
        name: "",
        phone: "",
        email: "",
        message: "",
      });
    } catch (error) {
      console.error("Enquiry submit error:", error);

      setStoreEnquiryError(
        "Unable to submit enquiry. Please try again."
      );
    }

    setStoreEnquiryLoading(false);
  };

  return (
    <section className="store-enquiry-section-wrapper">
      <div className="store-enquiry-section-container">
        <div className="store-enquiry-section-header">
          <h2 className="store-enquiry-section-title">
            {data?.title || "Send an Enquiry"}
          </h2>

          {data?.subtitle && (
            <p className="store-enquiry-section-subtitle">
              {data.subtitle}
            </p>
          )}
        </div>

        <form
          className="store-enquiry-section-form"
          onSubmit={handleStoreEnquirySubmit}
        >
          <div className="store-enquiry-section-grid">
            <div className="store-enquiry-section-field">
              <label>Name</label>
              <input
                type="text"
                name="name"
                value={storeEnquiryForm.name}
                onChange={handleStoreEnquiryChange}
                placeholder="Enter your name"
                required
              />
            </div>

            <div className="store-enquiry-section-field">
              <label>Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={storeEnquiryForm.phone}
                onChange={handleStoreEnquiryChange}
                placeholder="Enter your phone number"
                required
              />
            </div>

            <div className="store-enquiry-section-field store-enquiry-section-field-full">
              <label>Email Address</label>
              <input
                type="email"
                name="email"
                value={storeEnquiryForm.email}
                onChange={handleStoreEnquiryChange}
                placeholder="Enter your email"
              />
            </div>

            <div className="store-enquiry-section-field store-enquiry-section-field-full">
              <label>Message</label>
              <textarea
                name="message"
                rows={6}
                value={storeEnquiryForm.message}
                onChange={handleStoreEnquiryChange}
                placeholder="Tell us how we can help you"
                required
              />
            </div>
          </div>

          {storeEnquiryError && (
            <div className="store-enquiry-section-error">
              {storeEnquiryError}
            </div>
          )}

          {storeEnquirySuccess && (
            <div className="store-enquiry-section-success">
              Your enquiry has been submitted successfully.
            </div>
          )}

          <button
            type="submit"
            disabled={storeEnquiryLoading}
            className="store-enquiry-section-submit-btn"
            style={{
              background: theme?.colors?.primary || "#C9A34E",
            }}
          >
            {storeEnquiryLoading
              ? "Submitting..."
              : "Submit Enquiry"}
          </button>
        </form>
      </div>
    </section>
  );
};

export default EnquiryFormSection;