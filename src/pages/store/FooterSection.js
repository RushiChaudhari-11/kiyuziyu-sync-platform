import React, { useEffect, useState } from "react";

const FooterSection = ({ data, theme }) => {

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);

  }, []);

  if (!data) return null;

  /* COLOR PRIORITY
     footer colors → theme colors → defaults
  */

  const background =
    data?.colors?.background ||
    theme?.colors?.background ||
    "#111";

  const text =
    data?.colors?.text ||
    theme?.colors?.text ||
    "#ffffff";

  const primary =
    data?.colors?.accent ||
    theme?.colors?.primary ||
    "#C9A34E";

  return (
    <footer
      style={{
        background: background,
        color: text,
        padding: isMobile ? "60px 20px" : "90px 20px",
        fontFamily: theme?.font || "sans-serif"
      }}
    >

      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(4,1fr)",
          gap: "40px"
        }}
      >

        {/* BRAND */}
        <div>

          <h3
            style={{
              color: primary,
              marginBottom: "15px",
              fontSize: "22px"
            }}
          >
            {data.brand}
          </h3>

          <p
            style={{
              opacity: 0.85,
              lineHeight: "1.7",
              fontSize: "15px"
            }}
          >
            {data.description}
          </p>

        </div>


        {/* QUICK LINKS */}
        <div>

          <h4
            style={{
              marginBottom: "15px",
              fontSize: "16px"
            }}
          >
            Quick Links
          </h4>

          {data.links?.map((l, i) => (

            <div key={i} style={{ marginBottom: "8px" }}>

              <a
                href={l.url}
                style={{
                  color: text,
                  opacity: 0.85,
                  textDecoration: "none",
                  fontSize: "14px"
                }}
              >
                {l.label}
              </a>

            </div>

          ))}

        </div>


        {/* CONTACT */}
        <div>

          <h4
            style={{
              marginBottom: "15px",
              fontSize: "16px"
            }}
          >
            Contact
          </h4>

          <div
            style={{
              fontSize: "14px",
              lineHeight: "1.8",
              opacity: 0.9
            }}
          >

            {data.address && <div>📍 {data.address}</div>}

            {data.phone && <div>📞 {data.phone}</div>}

            {data.email && <div>📧 {data.email}</div>}

            {data.hours && <div>🕒 {data.hours}</div>}

          </div>

        </div>


        {/* SOCIAL */}
        <div>

          <h4
            style={{
              marginBottom: "15px",
              fontSize: "16px"
            }}
          >
            Follow Us
          </h4>

          <div
            style={{
              display: "flex",
              gap: "15px",
              flexWrap: "wrap"
            }}
          >

            {data.socials?.instagram && (
              <a href={data.socials.instagram} style={{ color: text }}>
                Instagram
              </a>
            )}

            {data.socials?.facebook && (
              <a href={data.socials.facebook} style={{ color: text }}>
                Facebook
              </a>
            )}

            {data.socials?.twitter && (
              <a href={data.socials.twitter} style={{ color: text }}>
                Twitter
              </a>
            )}

          </div>

        </div>

      </div>


      {/* BOTTOM BAR */}

      <div
        style={{
          marginTop: "60px",
          borderTop: `1px solid ${text}20`,
          paddingTop: "20px",
          textAlign: "center",
          fontSize: "14px",
          opacity: 0.7
        }}
      >
        © {new Date().getFullYear()} {data.brand}. All Rights Reserved.
      </div>

    </footer>
  );
};

export default FooterSection;