import React, { useState, useEffect } from "react";
import "./HeroSection.css";

import hero1 from "../assets/hero/hero8.webp";
import hero2 from "../assets/hero/hero9.webp";
import hero3 from "../assets/hero/hero10.webp";
import hero4 from "../assets/hero/hero11.webp";
import hero5 from "../assets/hero/hero12.webp";
import herom1 from "../assets/hero/hero17.webp";
import herom2 from "../assets/hero/hero13.webp";
import herom3 from "../assets/hero/hero14.webp";
import herom4 from "../assets/hero/hero15.webp";
import herom5 from "../assets/hero/hero16.webp";

const HeroSection = () => {

  const [index, setIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  const slides = [
    {
      image: hero1,
      mobileImage: herom1,
      title: "",
      desc: "",
      buttonText: ""
    },
    {
      image: hero2,
      mobileImage: herom2,
      title: "",
      desc: "",
      buttonText: ""
    },
    {
      image: hero3,
      mobileImage: herom3,
      title: "",
      desc: "",
      buttonText: ""
    },
    {
      image: hero4,
      mobileImage: herom4,
      title: "",
      desc: "",
      buttonText: ""
    },
    {
      image: hero5,
      mobileImage: herom5,
      title: "",
      desc: "",
      buttonText: ""
    }
  ];

  /* MOBILE DETECT */

  useEffect(() => {

    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();

    window.addEventListener("resize", checkMobile);

    return () =>
      window.removeEventListener("resize", checkMobile);

  }, []);

  /* AUTO SLIDE */

  useEffect(() => {

    if (slides.length <= 1) return;

    const interval = setInterval(() => {

      setIndex(prev =>
        (prev + 1) % slides.length
      );

    }, 6000);

    return () => clearInterval(interval);

  }, [slides.length]);

  /* NAVIGATION */

  const nextSlide = () => {

    setIndex(prev =>
      (prev + 1) % slides.length
    );

  };

  const prevSlide = () => {

    setIndex(prev =>
      prev === 0
        ? slides.length - 1
        : prev - 1
    );

  };

  return (

    <section className="hcr-slider">

      {slides.map((slide, i) => {

        const bgImage =
          isMobile && slide.mobileImage
            ? slide.mobileImage
            : slide.image;

        return (

          <div
            key={i}
            className={`hcr-slide ${
              i === index ? "active" : ""
            }`}
            style={{
              backgroundImage: `url(${bgImage})`
            }}
          >

            <div className="hcr-overlay" />

            <div className="hcr-content">

              {slide.tagline && (
                <p className="hcr-tagline">
                  {slide.tagline}
                </p>
              )}

              {slide.title && (
                <h2 className="hcr-title">
                  {slide.title}
                </h2>
              )}

              {slide.desc && (
                <p className="hcr-desc">
                  {slide.desc}
                </p>
              )}

              {slide.buttonText && (

                <div className="hcr-actions">

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
                className={`hcr-dot ${
                  i === index ? "active" : ""
                }`}
                onClick={() => setIndex(i)}
              />

            ))}

          </div>

        </>

      )}

    </section>

  );

};

export default HeroSection;