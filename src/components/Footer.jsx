import React, { useState, useEffect } from "react";
import logo from "../assets/logoj.png"; // circular logo
import "./Footer.css";

const SOCIALS = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/kiyuziyu.in",
    svg: (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 6.2a4.8 4.8 0 1 0 .001 9.601A4.8 4.8 0 0 0 12 8.2zm5.4-1.76a1.12 1.12 0 1 1 0 2.24 1.12 1.12 0 0 1 0-2.24z" />
      </svg>
    ),
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/",
    svg: (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M22 12a10 10 0 1 0-11.6 9.9v-7h-2.1V12h2.1V9.8c0-2.1 1.24-3.3 3.14-3.3.9 0 1.84.16 1.84.16v2h-1.03c-1.01 0-1.32.62-1.32 1.26V12h2.24l-.36 2.9h-1.88v7A10 10 0 0 0 22 12z" />
      </svg>
    ),
  },
  {
    name: "YouTube",
    href: "https://youtube.com/",
    svg: (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M23 7.2s-.2-1.6-.82-2.3C20.9 4.2 12 4.2 12 4.2s-8.9 0-10.18.7C1.2 5.6 1 7.2 1 7.2S1 9 1 10.8v2.4C1 16 1 17.8 1 17.8s.2 1.6.82 2.3c1.3.7 10.18.7 10.18.7s8.9 0 10.18-.7c.62-.7.82-2.3.82-2.3s0-1.8 0-3.6v-2.4C23 9 23 7.2 23 7.2zM9.75 15.02V8.98L15 12l-5.25 3.02z" />
      </svg>
    ),
  },
  {
    name: "WhatsApp",
    href: "https://wa.me/917897897441",
    svg: (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M20.5 3.5A11.9 11.9 0 0 0 12 1C6 1 1.73 4.9 1 10.2L1 23l12.9-2.1A11.9 11.9 0 0 0 24 10.9a11.8 11.8 0 0 0-3.5-7.4zM12 21.1l-.2.04L2.6 23l1.1-9.1.04-.21C4.1 7.9 7.6 5 12 5c2.8 0 5.4 1.3 7 3.6a7.7 7.7 0 0 1-2.2 5.4c-.1.1-.2.2-.3.3-.5.5-1.2.9-1.9 1.2-.5.2-1 .3-1.5.4-.6.1-1.2.3-1.7.6-.2.1-.5.2-.6.3-.2.1-.4.2-.6.3l-.1.1c-.2.1-.3.2-.4.3-.2 0-.8.2-1.3.4-.3.1-.6.2-.8.3l-.1.1z" />
      </svg>
    ),
  },
];

const Footer = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(""); // "", "success", "error"
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setShowTop(window.scrollY > 240);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setStatus("error");
      setTimeout(() => setStatus(""), 2500);
      return;
    }
    // client-side only: in real app send to API
    console.log("subscribe:", email);
    setEmail("");
    setStatus("success");
    setTimeout(() => setStatus(""), 3500);
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <>
      <footer className="fj-footer" role="contentinfo">
        <div className="fj-inner">
          <div className="fj-col fj-about" aria-labelledby="fj-about-heading">
            <img src={logo} alt="Kiyuziyu-By Tanishka logo" className="fj-logo" />
            <p className="fj-about-text">
              We supply anti-tarnish imitation jewellery to wholesalers and resellers across India — crafted with care, finished with excellence.
            </p>

            <div className="fj-social" aria-label="Social links">
              {SOCIALS.map((s) => (
                <a
                  key={s.name}
                  className="fj-social-link"
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.name}
                >
                  <span className="fj-social-icon" aria-hidden="true">{s.svg}</span>
                </a>
              ))}
            </div>
          </div>

          <div className="fj-col fj-contact" aria-labelledby="fj-contact-heading">
            <h4 id="fj-contact-heading" className="fj-h">Contact Us</h4>
            <address className="fj-contact-list">
              <div>📍 <span>Shop No 201 ,Xion Mall ,Hinjewadi,Pune-411057</span></div>
              <div>📞 <a href="tel:+917897897441">+91 78978 97441</a></div>
              <div>✉️ <a href="mailto:kiyuziyujewellery@gmail.com">kiyuziyujewellery@gmail.com</a></div>
              <div>📍 <span>For Wholsale Contact On +91 78978 97441</span></div>

            </address>
          </div>

          <div className="fj-col fj-links" aria-labelledby="fj-links-heading">
            <h4 id="fj-links-heading" className="fj-h">Important Links</h4>
            <ul className="fj-links-list" role="list">
              <li><a href="/">Home</a></li>
              <li><a href="/collections">Collections</a></li>
              <li><a href="/gallery">Gallery</a></li>
              <li><a href="/about">About</a></li>
              <li><a href="/contact">Contact</a></li>
            </ul>

            <form className="fj-newsletter" onSubmit={handleSubscribe} aria-label="Subscribe to newsletter">
              <label htmlFor="fj-email" className="visually-hidden">Email address</label>
              <div className="fj-news-input">
                <input
                  id="fj-email"
                  type="email"
                  inputMode="email"
                  placeholder="Your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={status === "error"}
                />
                <button type="submit" className="fj-btn">Subscribe</button>
              </div>
              <div aria-live="polite" className="fj-status">
                {status === "success" && <span className="fj-success">Subscribed ✅</span>}
                {status === "error" && <span className="fj-error">Enter a valid email</span>}
              </div>
            </form>
          </div>
        </div>

       <div className="fj-bottom">
  <p>© {new Date().getFullYear()} Kiyuziyu-By Tanishka · All rights reserved</p>

  <p className="fj-credits">
    Made with ♥ · 
    <a href="/terms">Terms</a> · 
    <a href="/privacy">Privacy</a> · 
    <a href="/refund-policy">Refund Policy</a> · 
    <a href="/cancellation-policy">Cancellation Policy</a>
  </p>
</div>
      </footer>

      {/* back-to-top */}
      <button
        className={`fj-topbtn ${showTop ? "visible" : ""}`}
        onClick={scrollToTop}
        aria-label="Scroll to top"
      >
        ↑
      </button>
    </>
  );
};

export default Footer;
