import React, { useEffect, useState } from "react";

const TestimonialsSection = ({ data, theme }) => {

  const textColor = theme?.colors?.text || "#000";
  const primaryColor = theme?.colors?.primary || "#000";

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [current, setCurrent] = useState(0);

  /* HANDLE SCREEN RESIZE */
  useEffect(() => {

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);

  }, []);

  /* AUTO SLIDE MOBILE */
  useEffect(() => {

    if (!isMobile || !data?.items?.length) return;

    const interval = setInterval(() => {

      setCurrent((prev) => (prev + 1) % data.items.length);

    }, 3500);

    return () => clearInterval(interval);

  }, [isMobile, data?.items]);

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
          textAlign: "center"
        }}
      >

        {/* TITLE */}
        <h2
          style={{
            fontSize: isMobile ? "30px" : "42px",
            marginBottom: "10px",
            color: textColor
          }}
        >
          {data.title || "What Our Customers Say"}
        </h2>

        {/* DIVIDER */}
        <div
          style={{
            width: "60px",
            height: "3px",
            background: primaryColor,
            margin: "10px auto 50px auto"
          }}
        />

        {/* MOBILE CAROUSEL */}
        {isMobile ? (

          <div
            style={{
              overflow: "hidden",
              position: "relative"
            }}
          >

            {data.items?.map((t, i) => (

              <div
                key={i}
                style={{
                  display: i === current ? "block" : "none",
                  padding: "28px",
                  borderRadius: "16px",
                  background: "rgba(0,0,0,0.03)",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
                  transition: "all 0.4s ease"
                }}
              >

                {/* STARS */}
                <div
                  style={{
                    color: primaryColor,
                    marginBottom: "15px",
                    fontSize: "18px"
                  }}
                >
                  {"★".repeat(t.rating || 5)}
                </div>

                {/* TEXT */}
                <p
                  style={{
                    fontSize: "16px",
                    lineHeight: "1.7",
                    opacity: 0.85,
                    color: textColor
                  }}
                >
                  {t.text}
                </p>

                {/* NAME */}
                <div
                  style={{
                    marginTop: "20px",
                    fontWeight: "600",
                    color: textColor
                  }}
                >
                  {t.name}
                </div>

              </div>

            ))}

          </div>

        ) : (

          /* DESKTOP GRID */

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: "30px"
            }}
          >

            {data.items?.map((t, i) => (

              <div
                key={i}
                style={{
                  padding: "30px",
                  borderRadius: "14px",
                  background: "rgba(0,0,0,0.03)",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.08)"
                }}
              >

                <div
                  style={{
                    color: primaryColor,
                    marginBottom: "15px",
                    fontSize: "18px"
                  }}
                >
                  {"★".repeat(t.rating || 5)}
                </div>

                <p
                  style={{
                    fontSize: "16px",
                    lineHeight: "1.7",
                    opacity: 0.85,
                    color: textColor
                  }}
                >
                  {t.text}
                </p>

                <div
                  style={{
                    marginTop: "20px",
                    fontWeight: "600",
                    color: textColor
                  }}
                >
                  {t.name}
                </div>

              </div>

            ))}

          </div>

        )}

      </div>
    </section>
  );
};

export default TestimonialsSection;