import React, { useState, useEffect } from "react";

const AboutSection = ({ data, theme }) => {

  const isMobile = window.innerWidth < 768;

  const textColor = theme?.colors?.text || "#000";
  const primaryColor = theme?.colors?.primary || "#000";

const images =
  Array.isArray(data.images) && data.images.length > 0
    ? data.images
    : data.image
    ? [data.image]
    : [];

  const [currentImage, setCurrentImage] = useState(0);

  // Auto change image every 3 seconds
  useEffect(() => {
    if (images.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % images.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [images.length]);
    if (!data) return null;


  return (
    <section
      style={{
        padding: isMobile ? "60px 20px" : "120px 20px",
        background: theme?.colors?.background || "#fff",
        fontFamily: theme?.font || "sans-serif"
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: isMobile ? "40px" : "80px",
          alignItems: "center"
        }}
      >
        {/* IMAGE SLIDER */}
        {images.length > 0 && (
          <div
            style={{
              borderRadius: "18px",
              overflow: "hidden",
              boxShadow: "0 25px 60px rgba(0,0,0,0.25)",
              position: "relative"
            }}
          >
            <img
              src={images[currentImage]}
              alt="About"
              style={{
                width: "100%",
                height: isMobile ? "600px" : "800px",
                objectFit: "cover",
                display: "block",
                transition: "all 0.5s ease"
              }}
            />

            {/* Navigation Dots */}
            {images.length > 1 && (
              <div
                style={{
                  position: "absolute",
                  bottom: "15px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  display: "flex",
                  gap: "8px"
                }}
              >
                {images.map((_, index) => (
                  <div
                    key={index}
                    onClick={() => setCurrentImage(index)}
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      cursor: "pointer",
                      background:
                        currentImage === index
                          ? "#fff"
                          : "rgba(255,255,255,0.5)",
                      transition: "0.3s"
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TEXT */}
        <div>
          {/* Small Label */}
          <div
            style={{
              color: primaryColor,
              fontWeight: "600",
              letterSpacing: "2px",
              marginBottom: "15px",
              fontSize: "13px"
            }}
          >
            OUR STORY
          </div>

          {/* Title */}
          <h2
            style={{
              fontSize: isMobile ? "32px" : "44px",
              marginBottom: "25px",
              fontWeight: "700",
              lineHeight: "1.2",
              color: textColor
            }}
          >
            {data.title}
          </h2>

          {/* Divider */}
          <div
            style={{
              width: "60px",
              height: "3px",
              background: primaryColor,
              marginBottom: "25px"
            }}
          />

          {/* Description */}
          <p
            style={{
              lineHeight: "1.8",
              opacity: 0.9,
              fontSize: isMobile ? "15px" : "17px",
              marginBottom: "35px",
              color: textColor
            }}
          >
            {data.description}
          </p>

          {/* FEATURES */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)",
              gap: "25px"
            }}
          >
            {data.features?.map((f, i) => (
              <div
                key={i}
                style={{
                  padding: "15px",
                  borderRadius: "10px",
                  background: "rgba(0,0,0,0.03)"
                }}
              >
                <strong
                  style={{
                    color: textColor,
                    fontSize: "16px"
                  }}
                >
                  {f.title}
                </strong>

                <p
                  style={{
                    opacity: 0.75,
                    fontSize: "14px",
                    marginTop: "6px",
                    color: textColor
                  }}
                >
                  {f.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;