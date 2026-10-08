import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import "./StoreNavbar.css";

import { useStoreAuth } from "./StoreAuthContext";
import { useStoreCart } from "./StoreCartContext";

import { FaUserCircle } from "react-icons/fa";
import { FiMenu, FiX, FiShoppingCart } from "react-icons/fi";

const StoreNavbar = ({ data, theme }) => {

  const { user = null, logout = () => {} } = useStoreAuth() || {};
  const { cartItemsCount = 0 } = useStoreCart() || {};

  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isSticky, setIsSticky] = useState(false);

  const profileBtnRef = useRef(null);
  const mobileMenuRef = useRef(null);

  /* ================= THEME ================= */

  useEffect(() => {

    if (!theme?.colors) return;

    document.documentElement.style.setProperty("--kj-gold", theme.colors.primary);
    document.documentElement.style.setProperty("--kj-bg", theme.colors.background);

  }, [theme]);

  /* ================= STICKY ================= */

  useEffect(() => {

    const onScroll = () => setIsSticky(window.scrollY > 60);

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);

  }, []);

  /* ================= ESC CLOSE ================= */

  useEffect(() => {

    const onKey = (e) => {

      if (e.key === "Escape") {

        setMobileOpen(false);
        setProfileOpen(false);

      }

    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);

  }, []);

  /* ================= OUTSIDE CLICK ================= */

  useEffect(() => {

    const onDocClick = (e) => {

      if (profileBtnRef.current && !profileBtnRef.current.contains(e.target)) {

        setProfileOpen(false);

      }

    };

    document.addEventListener("click", onDocClick);

    return () => document.removeEventListener("click", onDocClick);

  }, []);

  /* ================= LOGOUT ================= */

  const handleLogout = async () => {

    try {

      await logout();
      setProfileOpen(false);

    } catch (err) {

      console.error(err);

    }

  };

  /* ================= MOBILE FOCUS ================= */

  useEffect(() => {

    if (!mobileOpen || !mobileMenuRef.current) return;

    const first = mobileMenuRef.current.querySelector("a,button");

    if (first) first.focus();

  }, [mobileOpen]);

 return (

  <>

    <header className={`snv-root ${isSticky ? "snv-fixed" : ""}`}>

      <nav className="snv-bar">

        {/* LEFT LOGO */}

        <div className="snv-left">

          <Link to="/">

            <img
              src={data?.logo || "/fallback-logo.png"}
              alt="logo"
              className="snv-logo"
            />

          </Link>

        </div>

        {/* CENTER BRAND */}

        <div className="snv-center">

          <Link to="/" style={{ textDecoration: "none" }}>

            {data?.textLogo ? (

              <img src={data.textLogo} className="snv-textlogo" />

            ) : (

              <div className="snv-brand">

                <span className="snv-brand-name">
                  {data?.brandName || "YOUR BRAND"}
                </span>

                

              </div>

            )}

          </Link>

        </div>

        {/* RIGHT */}

        <div className="snv-right">

          <ul className="snv-links">

            <li>
              <Link to="/" className="snv-link">
                Home
              </Link>
            </li>

          </ul>

          <div className="snv-icons">

            {/* CART */}

            <Link to="/store/cart" className="snv-cart">

              <FiShoppingCart size={22} />

              {cartItemsCount > 0 && (
                <span className="snv-cart-count">
                  {cartItemsCount}
                </span>
              )}

            </Link>

            {/* PROFILE */}

            <div className="snv-user">

              {user ? (

                <div ref={profileBtnRef}>

                  <button
                    className="snv-user-btn"
                    onClick={() => setProfileOpen((s) => !s)}
                  >

                    <FaUserCircle size={22} />

                  </button>

                  {profileOpen && (

                    <div className="snv-user-menu">

                      <Link
                        to="/store/orders"
                        className="snv-menu-item"
                        onClick={() => setProfileOpen(false)}
                      >
                        My Orders
                      </Link>

                      <button
                        onClick={handleLogout}
                        className="snv-menu-item"
                      >
                        Sign out
                      </button>

                    </div>

                  )}

                </div>

              ) : (

                <Link to="/store/login" className="snv-login">
                  Login
                </Link>

              )}

            </div>

            {/* MOBILE MENU */}

            <button
              className={`snv-menu-toggle ${mobileOpen ? "open" : ""}`}
              onClick={() => setMobileOpen((s) => !s)}
            >

              {mobileOpen ? <FiX size={22} /> : <FiMenu size={22} />}

            </button>

          </div>

        </div>

      </nav>

    </header>

    {/* BACKDROP */}

    <div
      className={`snv-overlay ${mobileOpen ? "visible" : ""}`}
      onClick={() => setMobileOpen(false)}
    />

    {/* MOBILE MENU */}

    <aside
      ref={mobileMenuRef}
      className={`snv-drawer ${mobileOpen ? "open" : ""}`}
    >

      <div className="snv-drawer-inner">

        <div className="snv-drawer-top">

          <img src={data?.logo} alt="logo" />

          <button onClick={() => setMobileOpen(false)}>
            <FiX size={22} />
          </button>

        </div>

        <nav className="snv-drawer-nav">

          <ul>

            <li>
              <Link to="/" onClick={() => setMobileOpen(false)}>
                Home
              </Link>
            </li>

            <li>
              <Link to="/store/orders" onClick={() => setMobileOpen(false)}>
                My Orders
              </Link>
            </li>

            <li>
              <Link to="/store/cart" onClick={() => setMobileOpen(false)}>
                Cart
              </Link>
            </li>

          </ul>

        </nav>

        <div className="snv-drawer-actions">

          {user ? (

            <button
              onClick={handleLogout}
              className="snv-btn-plain"
            >
              Sign out
            </button>

          ) : (

            <Link
              to="/store/login"
              className="snv-btn-solid"
            >
              Login
            </Link>

          )}

        </div>

      </div>

    </aside>

  </>

);

};

export default StoreNavbar;