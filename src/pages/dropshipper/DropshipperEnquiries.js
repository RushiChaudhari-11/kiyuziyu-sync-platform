import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  getDocs,
  getDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../components/AuthContext";
import "./DropshipperEnquiries.css";

const DropshipperEnquiries = () => {
  const { currentUser } = useAuth();

  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storeDomain, setStoreDomain] = useState("");

  useEffect(() => {
    if (!currentUser) return;

    const loadEnquiries = async () => {
      try {
        setLoading(true);

        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          setLoading(false);
          return;
        }

        const userData = userSnap.data();

        if (!userData.storeDomain) {
          setLoading(false);
          return;
        }

        setStoreDomain(userData.storeDomain);

        const enquiriesRef = collection(
          db,
          "storeEnquiries",
          userData.storeDomain,
          "enquiries"
        );

        const enquiriesQuery = query(
          enquiriesRef,
          orderBy("createdAt", "desc")
        );

        const enquiriesSnap = await getDocs(enquiriesQuery);

        const enquiryList = enquiriesSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setEnquiries(enquiryList);
      } catch (error) {
        console.error("Error loading enquiries:", error);
      }

      setLoading(false);
    };

    loadEnquiries();
  }, [currentUser]);

return (
  <div className="dropshipper-enquiries-page">
    <div className="dropshipper-enquiries-header">
      <div>
        <h2>Store Enquiries</h2>
        <p>
          View all enquiries submitted through your storefront enquiry form.
        </p>
      </div>

      <div className="dropshipper-enquiries-stats">
        <span>{enquiries.length} Enquiries</span>
      </div>
    </div>

    {storeDomain && (
      <div className="dropshipper-enquiries-domain">
        Store: {storeDomain}
      </div>
    )}

    {loading ? (
      <div className="dropshipper-enquiries-loading">
        Loading enquiries...
      </div>
    ) : enquiries.length === 0 ? (
      <div className="dropshipper-enquiries-empty">
        <h3>No enquiries yet</h3>
        <p>
          When customers submit the enquiry form from your store,
          they will appear here.
        </p>
      </div>
    ) : (
      <div className="dropshipper-enquiries-table-wrapper">

        <table className="dropshipper-enquiries-table">

          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Message</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>

            {enquiries.map((enquiry) => (

              <tr key={enquiry.id}>

                <td>
                  {enquiry.name || "-"}
                </td>

                <td>
                  {enquiry.phone ? (
                    <a href={`tel:${enquiry.phone}`}>
                      {enquiry.phone}
                    </a>
                  ) : (
                    "-"
                  )}
                </td>

                <td>
                  {enquiry.email ? (
                    <a href={`mailto:${enquiry.email}`}>
                      {enquiry.email}
                    </a>
                  ) : (
                    "-"
                  )}
                </td>

                <td className="enquiry-message-cell">
                  {enquiry.message || "-"}
                </td>

                <td>
                  {enquiry.createdAt?.toDate
                    ? enquiry.createdAt
                        .toDate()
                        .toLocaleDateString("en-IN")
                    : "-"}
                </td>

                <td>
                  <div className="enquiry-actions">

                    {enquiry.phone && (
                      <a
                        href={`tel:${enquiry.phone}`}
                        className="table-action-btn"
                      >
                        Call
                      </a>
                    )}

                    {enquiry.phone && (
                      <a
                        href={`https://wa.me/${enquiry.phone.replace(
                          /\D/g,
                          ""
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="table-action-btn"
                      >
                        WhatsApp
                      </a>
                    )}

                    {enquiry.email && (
                      <a
                        href={`mailto:${enquiry.email}`}
                        className="table-action-btn"
                      >
                        Email
                      </a>
                    )}

                  </div>
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

export default DropshipperEnquiries;