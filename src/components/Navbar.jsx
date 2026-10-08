import React, {
  useState,
  useRef,
  useEffect
} from "react";

import { Link } from "react-router-dom";

import MiniCart from "./MiniCart";

import logo from "../assets/logoj.png";

import "./Navbar.css";

import { useAuth } from "./AuthContext";

import { FaUserCircle } from "react-icons/fa";

import {
  FiMenu,
  FiX
} from "react-icons/fi";


const Navbar = () => {

  const {
    currentUser,
    userRole,
    logout
  } = useAuth();


  /* =========================
     STATE
  ========================= */

  const [mobileOpen, setMobileOpen] =
    useState(false);

  const [profileOpen, setProfileOpen] =
    useState(false);

  const [isSticky, setIsSticky] =
    useState(false);


  /* =========================
     REFS
  ========================= */

  const profileBtnRef =
    useRef(null);

  const mobileMenuRef =
    useRef(null);


  /* =========================
     STICKY HEADER
  ========================= */

  useEffect(() => {

    const onScroll = () => {

      const y =
        window.scrollY ||
        window.pageYOffset;

      setIsSticky(y > 60);

    };


    window.addEventListener(
      "scroll",
      onScroll,
      { passive: true }
    );


    onScroll();


    return () =>
      window.removeEventListener(
        "scroll",
        onScroll
      );

  }, []);


  /* =========================
     ESCAPE KEY
  ========================= */

  useEffect(() => {

    const onKey = (e) => {

      if (e.key === "Escape") {

        setMobileOpen(false);

        setProfileOpen(false);

      }

    };


    window.addEventListener(
      "keydown",
      onKey
    );


    return () =>
      window.removeEventListener(
        "keydown",
        onKey
      );

  }, []);


  /* =========================
     CLOSE PROFILE
     WHEN CLICKING OUTSIDE
  ========================= */

  useEffect(() => {

    const onDocClick = (e) => {

      if (
        profileBtnRef.current &&
        !profileBtnRef.current.contains(
          e.target
        )
      ) {

        setProfileOpen(false);

      }

    };


    document.addEventListener(
      "click",
      onDocClick
    );


    return () =>
      document.removeEventListener(
        "click",
        onDocClick
      );

  }, []);


  /* =========================
     LOGOUT
  ========================= */

  const handleLogout = async () => {

    try {

      await logout();

      setProfileOpen(false);

      setMobileOpen(false);

    } catch (err) {

      console.error(
        "Logout failed:",
        err
      );

    }

  };


  /* =========================
     MOBILE MENU FOCUS
  ========================= */

  useEffect(() => {

    if (
      !mobileOpen ||
      !mobileMenuRef.current
    ) {
      return;
    }


    const first =
      mobileMenuRef.current.querySelector(
        "a, button"
      );


    if (first) {

      first.focus();

    }

  }, [mobileOpen]);


  /* =========================
     RENDER
  ========================= */

  return (

    <>

      {/* =========================
          DESKTOP HEADER
      ========================= */}

      <header
        className={`kj-header ${
          isSticky
            ? "kj-sticky"
            : ""
        }`}
        role="banner"
      >

        <nav
          className="kj-nav"
          aria-label="Main navigation"
        >


          {/* =========================
              LEFT LOGO
          ========================= */}

          <div className="kj-nav-left">

            {/* <Link
              to="/"
              className="kj-logo-link"
              aria-label="Go to homepage"
            >

              <img
                src={logo}
                alt="logo"
                className={`kj-logo ${
                  isSticky
                    ? "small"
                    : ""
                }`}
              />

            </Link> */}

          </div>


          {/* =========================
              CENTER TEXT
          ========================= */}

          <div
            className="kj-nav-center"
            aria-hidden={mobileOpen}
          >

            <Link
              to="/"
              className="kj-wholesale-title"
              aria-label="Homepage"
            >

              Wholesale Jewellery

            </Link>

          </div>


          {/* =========================
              RIGHT NAVIGATION
          ========================= */}

          <div className="kj-nav-right">


            {/* =========================
                DESKTOP LINKS
            ========================= */}

            <ul
              className="kj-links"
              role="menubar"
              aria-hidden={mobileOpen}
            >

              {/* HOME */}

              <li
                role="none"
                className="kj-link-item"
              >

                <Link
                  to="/"
                  role="menuitem"
                  className="kj-link"
                >
                  Home
                </Link>

              </li>


              {/* ORDERS */}

              {currentUser && (

                <li
                  role="none"
                  className="kj-link-item"
                >

                  <Link
                    to="/order-history"
                    role="menuitem"
                    className="kj-link"
                  >
                    Orders
                  </Link>

                </li>

              )}


              {/* ADMIN */}

              {userRole === "admin" && (

                <li
                  role="none"
                  className="kj-link-item"
                >

                  <Link
                    to="/admin"
                    role="menuitem"
                    className="kj-link"
                  >
                    Admin
                  </Link>

                </li>

              )}

            </ul>


            {/* =========================
                ICON AREA
            ========================= */}

            <div className="kj-icons">


              {/* CART */}

              <div
                className="kj-minicart-wrapper"
                aria-hidden={mobileOpen}
              >

                <MiniCart />

              </div>


              {/* =========================
                  PROFILE
              ========================= */}

              <div className="kj-profile">

                {currentUser ? (

                  <div
                    className="kj-profile-wrapper"
                    ref={profileBtnRef}
                  >

                    <button
                      className="kj-profile-btn"

                      onClick={() =>
                        setProfileOpen(
                          (s) => !s
                        )
                      }

                      aria-haspopup="true"

                      aria-expanded={
                        profileOpen
                      }

                      aria-label="Open profile menu"
                    >

                      <FaUserCircle
                        size={22}
                      />

                    </button>


                    {profileOpen && (

                      <div
                        className="kj-profile-menu"
                        role="menu"
                      >

                        <button
                          className="kj-menu-item"

                          onClick={
                            handleLogout
                          }

                          role="menuitem"
                        >

                          Sign out

                        </button>

                      </div>

                    )}

                  </div>

                ) : (

                  <Link
                    to="/login"
                    className="kj-login-link"
                  >

                    Login

                  </Link>

                )}

              </div>


              {/* =========================
                  HAMBURGER
              ========================= */}

              <button
                className={`kj-hamburger ${
                  mobileOpen
                    ? "open"
                    : ""
                }`}

                aria-label={
                  mobileOpen
                    ? "Close menu"
                    : "Open menu"
                }

                aria-expanded={
                  mobileOpen
                }

                onClick={() =>
                  setMobileOpen(
                    (s) => !s
                  )
                }
              >

                {mobileOpen ? (

                  <FiX size={22} />

                ) : (

                  <FiMenu size={22} />

                )}

              </button>

            </div>

          </div>

        </nav>

      </header>


      {/* =========================
          MOBILE BACKDROP
      ========================= */}

      <div
        className={`kj-mobile-backdrop ${
          mobileOpen
            ? "visible"
            : ""
        }`}

        onClick={() =>
          setMobileOpen(false)
        }

        aria-hidden={!mobileOpen}
      />


      {/* =========================
          MOBILE MENU
      ========================= */}

      <aside
        ref={mobileMenuRef}

        className={`kj-mobile-menu ${
          mobileOpen
            ? "open"
            : ""
        }`}

        aria-hidden={!mobileOpen}

        aria-label="Mobile menu"
      >

        <div className="kj-mobile-inner">


          {/* =========================
              MOBILE TOP
          ========================= */}

          <div className="kj-mobile-top">


            <Link
              to="/"
              onClick={() =>
                setMobileOpen(false)
              }

              className="kj-mobile-logo"
            >

              <img
                src={logo}
                alt="logo"
              />

            </Link>


            <button
              className="kj-mobile-close"

              onClick={() =>
                setMobileOpen(false)
              }

              aria-label="Close menu"
            >

              <FiX size={22} />

            </button>

          </div>


          {/* =========================
              MOBILE NAV
          ========================= */}

          <nav
            className="kj-mobile-nav"
            role="navigation"
          >

            <ul>


              {/* HOME */}

              <li>

                <Link
                  to="/"

                  onClick={() =>
                    setMobileOpen(false)
                  }
                >

                  Home

                </Link>

              </li>


              {/* ORDER HISTORY */}

              {currentUser && (

                <li>

                  <Link
                    to="/order-history"

                    onClick={() =>
                      setMobileOpen(false)
                    }
                  >

                    Order History

                  </Link>

                </li>

              )}


              {/* ADMIN */}

              {userRole === "admin" && (

                <li>

                  <Link
                    to="/admin"

                    onClick={() =>
                      setMobileOpen(false)
                    }
                  >

                    Admin

                  </Link>

                </li>

              )}


              {/* CONTACT */}

              <li>

                <Link
                  to="/contact"

                  onClick={() =>
                    setMobileOpen(false)
                  }
                >

                  Contact

                </Link>

              </li>

            </ul>

          </nav>


          {/* =========================
              MOBILE ACTIONS
          ========================= */}

          <div className="kj-mobile-actions">


            {/* CART */}

            <div className="kj-mobile-cart">

              <MiniCart />

            </div>


            {/* AUTH */}

            {currentUser ? (

              <div className="kj-mobile-profile">

                <button
                  onClick={handleLogout}
                  className="kj-btn-plain"
                >

                  Sign out

                </button>

              </div>

            ) : (

              <Link
                to="/login"
                className="kj-btn-solid"

                onClick={() =>
                  setMobileOpen(false)
                }
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


export default Navbar;