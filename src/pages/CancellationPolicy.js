import React from "react";
import "./TermsAndPolicies.css";

export default function CancellationPolicy() {
  return (
    <main className="terms-page" aria-labelledby="cancel-heading">
      <section className="terms-content">
        <h2 id="cancel-heading">Cancellation Policy</h2>

        <article className="terms-section">
          <h3>1. Order Cancellation</h3>
          <p>
            Once an order is placed and payment is confirmed, cancellations are
            not allowed.
          </p>
        </article>

        <article className="terms-section">
          <h3>2. Before Order Processing</h3>
          <p>
            If you wish to cancel an order immediately after placing it, please
            contact our support team. Cancellation requests will only be
            considered if the order has not yet been processed.
          </p>
        </article>

        <article className="terms-section">
          <h3>3. Bulk Orders</h3>
          <p>
            Bulk or custom orders cannot be cancelled once production or
            packaging has started.
          </p>
        </article>

        <article className="terms-section">
          <h3>4. Refund After Cancellation</h3>
          <p>
            If a cancellation request is approved before processing, the refund
            will be initiated to the original payment method within 5–7 business
            days.
          </p>
        </article>

        <div className="terms-footer">
          <p>
            By placing an order with Kiyu Ziyu By Tanishka, you agree to this
            Cancellation Policy.
          </p>
        </div>
      </section>
    </main>
  );
}