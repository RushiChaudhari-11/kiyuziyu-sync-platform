import React from "react";
import "./TermsAndPolicies.css";

export default function RefundPolicy() {
  return (
    <main className="terms-page" aria-labelledby="refund-heading">
      <section className="terms-content">
        <h2 id="refund-heading">Refund Policy</h2>

        <article className="terms-section">
          <h3>1. No Refund Policy</h3>
          <p>
            All purchases made on Kiyu Ziyu By Tanishka are final. Once the payment
            is successfully completed, we do not offer refunds or exchanges.
          </p>
        </article>

        <article className="terms-section">
          <h3>2. Damaged Product Exception</h3>
          <p>
            Refunds or replacements will only be considered if the product
            received is damaged during transit.
          </p>
          <ul>
            <li>The issue must be reported within 24 hours of delivery.</li>
            <li>An unboxing video is required as proof.</li>
            <li>Our team will verify the issue before processing.</li>
          </ul>
        </article>

        <article className="terms-section">
          <h3>3. Refund Processing</h3>
          <p>
            If a refund is approved, the amount will be processed to the original
            payment method within 5–7 business days.
          </p>
        </article>

        <article className="terms-section">
          <h3>4. Contact for Refund Issues</h3>
          <p>
            For refund related queries, please contact our support team with
            your order details.
          </p>
        </article>

        <div className="terms-footer">
          <p>
            By purchasing from Kiyu Ziyu By Tanishka, you agree to this Refund Policy.
          </p>
        </div>
      </section>
    </main>
  );
}