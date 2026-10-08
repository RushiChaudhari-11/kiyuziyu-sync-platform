import React, { useState, useEffect } from "react";
import "./StoreHeroSection.css";

const HeroSplit = ({ data, theme }) => {

  const [index, setIndex] = useState(0);

  /* ================= IMAGES ================= */

  const images =
    data?.images?.length
      ? data.images
      : data?.image
      ? [{ src: data.image }]
      : [];

  /* ================= SLIDER ================= */

  useEffect(() => {

    if (images.length <= 1) return;

    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, 4500);

    return () => clearInterval(interval);

  }, [images.length]);

  /* ================= GUARD ================= */

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
    "--accent-2": primary + "80",
    "--bg-light": background,
    "--text": text
  };

  const features =
    data?.features?.length
      ? data.features
      : [
          "Guaranteed Quality",
          "New Designs Every Week",
          "Premium Packaging"
        ];

  return (

    <div className="split-hero-wrap" style={heroStyle}>

      <section className="split-hero">

        {/* LEFT IMAGE */}

        <div className="split-left">

          {images.map((img, i) => (

            <figure
              key={i}
              className={`slide ${i === index ? "active" : ""}`}
            >

              <img
                src={img.src || img}
                alt={img.alt || "hero"}
                loading={i === index ? "eager" : "lazy"}
              />

            </figure>

          ))}

        </div>

        {/* RIGHT CONTENT */}

        <aside className="split-right">

          <div className="right-inner">

            <h2 className="right-title">
              {data.title || "Your Store Title"}
            </h2>

            <p className="right-sub">
              {data.subtitle || "Your subtitle goes here"}
            </p>

            <div className="feature-cards">

              {features.map((f, i) => (

                <div className="card" key={i}>

                  <div className="card-dot" />

                  <div>
                    <strong>{f}</strong>
                  </div>

                </div>

              ))}

            </div>

            <div className="right-actions">

              <a
                className="btn-primary"
                href={data.primaryLink || "#collections"}
              >
                {data.buttonText || "Shop Now"}
              </a>

              <a
                className="btn-ghost"
                href={data.secondaryLink || "#collections"}
              >
                {data.secondaryButton || "Explore"}
              </a>

            </div>

          </div>

        </aside>

      </section>

    </div>

  );

};

export default HeroSplit;