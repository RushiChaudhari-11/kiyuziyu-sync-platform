import React from "react";
import "./PrivacyPolicy.css";

const PrivacyPolicy = () => {
  return (
    <div className="privacy-container">
      <h1>Privacy Policy</h1>
      <p className="updated-date">Last updated: 20 January 2026</p>

      <p>
        Kiyu Ziyu Jewellery we operates the website
        https://kiyuziyuofficial.com. This Privacy Policy describes how we
        collect, use, disclose, and protect your personal information when you
        use our website or make a purchase from us.
      </p>

      <h2>1. Information We Collect</h2>
      <p>We may collect the following information from you:</p>
      <ul>
        <li>Full name</li>
        <li>Email address</li>
        <li>Phone number</li>
        <li>Billing and shipping address</li>
        <li>Order details and purchase history</li>
      </ul>

      <h2>2. Payment Information</h2>
      <p>
        All payments on our website are processed securely through third-party
        payment gateways such as <strong>Razorpay</strong>. We do not store,
        process, or retain your debit card, credit card, UPI, or net banking
        details on our servers. Payment information is handled directly by the
        payment gateway provider in accordance with their privacy policies.
      </p>

      <h2>3. How We Use Your Information</h2>
      <ul>
        <li>To process orders and payments</li>
        <li>To confirm transactions and deliveries</li>
        <li>To provide customer support and respond to queries</li>
        <li>To improve our products, services, and website experience</li>
        <li>To prevent fraud, unauthorized transactions, and abuse</li>
        <li>To comply with legal and regulatory requirements</li>
      </ul>

      <h2>4. Sharing of Information</h2>
      <p>
        We do not sell, trade, or rent your personal information to third
        parties. We may share your information only with:
      </p>
      <ul>
        <li>Payment service providers such as Razorpay</li>
        <li>Shipping and logistics partners for order fulfillment</li>
        <li>Government or legal authorities when required by law</li>
      </ul>

      <h2>5. Cookies</h2>
      <p>
        Our website uses cookies and similar technologies to enhance user
        experience, analyze traffic, and understand user behavior. You may
        disable cookies through your browser settings, however some features of
        the website may not function properly.
      </p>

      <h2>6. Data Security</h2>
      <p>
        We implement reasonable security measures to protect your personal
        information. However, no method of transmission over the internet or
        electronic storage is completely secure, and we cannot guarantee
        absolute security.
      </p>

      <h2>7. Data Retention</h2>
      <p>
        We retain personal information only for as long as necessary to fulfill
        the purposes outlined in this policy and to comply with applicable laws.
      </p>

      <h2>8. Children’s Privacy</h2>
      <p>
        Our website is not intended for individuals under the age of 18. We do
        not knowingly collect personal information from children.
      </p>

      <h2>9. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Any changes will be
        posted on this page with an updated revision date.
      </p>

      <h2>10. Contact Information</h2>
      <p>
        If you have any questions regarding this Privacy Policy, please contact
        us:
        <br />
        <strong>Kiyu Ziyu Jewellery</strong>
        <br />
        Email: support@kiyuziyuofficial.com
        <br />
        Website: https://kiyuziyuofficial.com
      </p>
    </div>
  );
};

export default PrivacyPolicy;
