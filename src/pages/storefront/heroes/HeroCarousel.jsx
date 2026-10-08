import React, { useState, useEffect } from "react";
import "./HeroCarousel.css";

const HeroCarousel = ({ data, theme }) => {

  const [index, setIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  /* ================= SLIDES ================= */

  const slides = data?.slides || [];

  /* ================= MOBILE DETECT ================= */

  useEffect(() => {

    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();

    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);

  }, []);

  /* ================= AUTO SLIDE ================= */

  useEffect(() => {

    if (slides.length <= 1) return;

    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, 6000);

    return () => clearInterval(interval);

  }, [slides.length]);

  /* ================= SAFE GUARD ================= */

  if (!data) return null;

  /* ================= COLORS ================= */

  const primary =
    data?.colors?.primary || theme?.colors?.primary;

  const background =
    data?.colors?.background || theme?.colors?.background;

  const text =
    data?.colors?.text || theme?.colors?.text;

  const heroStyle = {
    "--accent": primary,
    "--bg-light": background,
    "--text": text
  };

  /* ================= NAVIGATION ================= */

  const nextSlide = () => {
    setIndex((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setIndex((prev) =>
      prev === 0 ? slides.length - 1 : prev - 1
    );
  };

  return (

    <section className="hcr-slider" style={heroStyle}>

      {slides.map((slide, i) => {

        const bgImage =
          isMobile && slide.mobileImage
            ? slide.mobileImage
            : slide.image;

        return (

          <div
            key={i}
            className={`hcr-slide ${i === index ? "active" : ""}`}
            style={{ backgroundImage: `url(${bgImage})` }}
          >

            <div className="hcr-overlay" />

            <div className="hcr-content">

              {slide.tagline && (
                <p className="hcr-tagline hcr-animate hcr-animate-1">
                  {slide.tagline}
                </p>
              )}

              {slide.title && (
                <h2 className="hcr-title hcr-animate hcr-animate-2">
                  {slide.title}
                </h2>
              )}

              {slide.desc && (
                <p className="hcr-desc hcr-animate hcr-animate-3">
                  {slide.desc}
                </p>
              )}

             {slide.buttonText && (

  <div className="hcr-actions hcr-animate hcr-animate-4">

    <a
      href={slide.link}
      className="hcr-btn"
    >
      {slide.buttonText}
    </a>

  </div>

)}

            </div>

          </div>

        );

      })}

      {slides.length > 1 && (

        <>

          <div
            className="hcr-nav hcr-prev"
            onClick={prevSlide}
          >
            ‹
          </div>

          <div
            className="hcr-nav hcr-next"
            onClick={nextSlide}
          >
            ›
          </div>

          <div className="hcr-dots">

            {slides.map((_, i) => (

              <span
                key={i}
                className={`hcr-dot ${i === index ? "active" : ""}`}
                onClick={() => setIndex(i)}
              />

            ))}

          </div>

        </>

      )}

    </section>

  );

};

export default HeroCarousel;