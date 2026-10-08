import React from "react";
import "./TermsAndPolicies.css";

export default function TermsAndPolicies() {
  return (
    <main className="terms-page" aria-labelledby="terms-heading">
      <nav className="terms-toc" aria-label="Terms navigation">
        <h2 id="terms-heading">Terms & Policies</h2>
        <ul>
          <li><a href="#product-quality">Product Quality</a></li>
          <li><a href="#pricing-policy">Pricing Policy</a></li>
          <li><a href="#order-payment">Order & Payment</a></li>
          <li><a href="#return-refund">Return & Refund Policy</a></li>
          <li><a href="#disclaimer">Disclaimer</a></li>
        </ul>
      </nav>

      <section className="terms-content">
        <article id="product-quality" className="terms-section">
          <h3>1. Product Quality</h3>
          <p>
            All Kiyu Ziyu By Tanishka jewellery pieces are made with anti-tarnish, high-quality
            materials designed for long-lasting shine and durability.
          </p>
        </article>

        <article id="pricing-policy" className="terms-section">
          <h3>2. Pricing Policy</h3>
          <p>
            We offer our products at very affordable wholesale prices to support small
            business owners and resellers.
          </p>
        </article>

        <article id="order-payment" className="terms-section">
          <h3>3. Order & Payment</h3>
          <ul>
            <li>Once an order is confirmed, no cancellations will be accepted.</li>
            <li>Full payment or token amount must be made before order processing.</li>
            <li>Orders are processed only after successful payment confirmation.</li>
          </ul>
        </article>

        <article id="return-refund" className="terms-section">
          <h3>4. Return & Refund Policy</h3>
          <ul>
            <li>No refund or exchange once payment is done.</li>
            <li>
              We do not accept returns unless the product received is damaged during
              transit (must be reported within 24 hours of delivery with unboxing
              video proof).
            </li>
            <li>Please check your order details carefully before confirming.</li>
          </ul>
        </article>
        <article id="shipping-delivery" className="terms-section">
  <h3>5. Shipping & Delivery Policy</h3>
  <ul>
    <li>Orders are processed within 1–2 business days after confirmation.</li>
    <li>Minimum delivery timeline: <strong>3 business days</strong>.</li>
    <li>Maximum delivery timeline: <strong>10 business days</strong>.</li>
    <li>
      Delivery timelines may vary depending on location, courier availability,
      public holidays, and bulk order volume.
    </li>
    <li>
      Bulk or custom orders may require additional processing time and will be
      communicated separately.
    </li>
  </ul>
</article>


        <article id="disclaimer" className="terms-section">
          <h3>6. Disclaimer</h3>
          <p>
            Minor color or design variations may occur due to lighting or screen
            settings. This will not be considered as a defect.
          </p>
        </article>

        <div className="terms-footer">
          <p>
            By placing an order with Kiyu Ziyu-By Tanishka, you acknowledge that you have read
            and agree to these Terms & Policies.
          </p>
        </div>
      </section>

      {/* Simple inline style fallback if external CSS isn't loaded */}
      <style jsx="true">{`
        .terms-page { display: grid; grid-template-columns: 320px 1fr; gap: 32px; max-width: 1200px; margin: 48px auto; padding: 24px; }
        .terms-toc { position: sticky; top: 28px; align-self: start; }
        .terms-toc h2 { font-size: 1.25rem; margin: 0 0 12px; background: linear-gradient(90deg, var(--gold, #e73e35), var(--light-gold, #ff8c82)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .terms-toc ul { list-style: none; padding: 0; margin: 12px 0 0; display: grid; gap: 8px; }
        .terms-toc a { text-decoration: none; color: var(--text, #1a1a1a); font-weight: 700; }
        .terms-content { background: white; padding: 28px; border-radius: 12px; box-shadow: 0 10px 30px rgba(14,23,36,0.06); }
        .terms-section { margin-bottom: 20px; }
        .terms-section h3 { margin: 0 0 8px; font-size: 1.05rem; }
        .terms-section p, .terms-section li { color: var(--muted, #6c7a8a); line-height: 1.6; }
        .terms-footer { margin-top: 24px; border-top: 1px solid rgba(14,23,36,0.04); padding-top: 16px; color: var(--text, #1a1a1a); font-weight: 700; }

        @media (max-width: 900px) {
          .terms-page { grid-template-columns: 1fr; padding: 16px; }
          .terms-toc { position: relative; top: auto; }
        }
      `}</style>
    </main>
  );
}
