import React, { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { getCleanDomain } from "../../utils/domain";
import { Helmet } from "react-helmet-async";

/* COMPONENTS */
import StoreNavbar from "./StoreNavbar";
import CollectionsSection from "./CollectionsSection";
import { HERO_LAYOUTS } from "../storefront/heroes/HeroRegistry";
import AboutSection from "./AboutSection";
import TestimonialsSection from "./TestimonialsSection";
import FooterSection from "./FooterSection";
import StoreFloatingContact from "./StoreFloatingContact";
import StoreTopbar from "./StoreTopbar";
import EnquiryFormSection from "./StoreEnquiryFormSection";
import InstagramReelsSection from "./InstagramReelsSection";
import ShopTheLook from "./Shopthelook";
const StoreHomepage = () => {

  const [homepage, setHomepage] = useState(null);
  const [loading, setLoading] = useState(true);

  const HeroComponent =
    HERO_LAYOUTS[homepage?.hero?.layout] || HERO_LAYOUTS.split;

  /* ================= LOAD STORE ================= */

  useEffect(() => {

    const loadStore = async () => {
      try {

        const domain = getCleanDomain();

        const homepageRef = doc(db, "storeHomepages", domain);
        const homepageSnap = await getDoc(homepageRef);

        if (homepageSnap.exists()) {

          const data = homepageSnap.data();

          setHomepage(data);

        } else {

          console.warn("❌ No homepage found for:", domain);

        }

      } catch (err) {

        console.error("❌ Load error:", err);

      }

      setLoading(false);

    };

    loadStore();

  }, []);

  /* ================= THEME ================= */

  const theme = homepage?.theme || {
    colors: {
      primary: "#C9A34E",
      background: "#ffffff",
      text: "#111111"
    },
    font: "sans-serif"
  };

  /* ================= APPLY THEME GLOBALLY ================= */

  useEffect(() => {

    if (!theme?.colors) return;

    document.documentElement.style.setProperty("--accent", theme.colors.primary);
    document.documentElement.style.setProperty("--accent-2", theme.colors.primary + "80");
    document.documentElement.style.setProperty("--text", theme.colors.text);
    document.documentElement.style.setProperty("--bg-light", theme.colors.background);
    document.documentElement.style.setProperty("--bg-soft", theme.colors.background);

    document.documentElement.style.setProperty("--kj-gold", theme.colors.primary);
    document.documentElement.style.setProperty("--kj-gold-2", theme.colors.primary);
    document.documentElement.style.setProperty("--kj-bg", theme.colors.background);

  }, [theme]);

  /* ================= LOADING ================= */

  if (loading) {
    return (
      <div style={{ padding: "40px" }}>
        Loading store...
      </div>
    );
  }

  if (!homepage) {
    return (
      <div style={{ padding: "40px", color: "red" }}>
        ❌ Store not found for this domain
        <br />
        Check console for DOMAIN mismatch
      </div>
    );
  }

  /* ================= SEO ================= */

  const storeName =
    homepage?.navbar?.brandName || "Online Store";

  const description =
    homepage?.hero?.subtitle ||
    `Shop premium products from ${storeName}`;

  const domain = getCleanDomain();

  /* ================= UI ================= */

  return (
    <div
      style={{
        background: theme.colors.background,
        color: theme.colors.text,
        fontFamily: theme.font,
        minHeight: "100vh",
        margin: 0,
        padding: 0
      }}
    >

      {/* ===== SEO TAGS ===== */}
      <Helmet>
  <title>{storeName}</title>

  <meta
    name="description"
    content={description}
  />
  <meta
  name="keywords"
  content={`${storeName}, jewellery store, online shopping, fashion store`}
/>
  <link
  rel="canonical"
  href={`https://${domain}`}
/>

  <meta property="og:title" content={storeName} />
  <meta property="og:description" content={description} />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={`https://${domain}`} />

  <meta
    property="og:image"
    content={homepage?.hero?.images?.[0]?.src || "/default-og.jpg"}
  />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={storeName} />
  <meta name="twitter:description" content={description} />

  <meta
    name="twitter:image"
    content={homepage?.hero?.images?.[0]?.src || "/default-og.jpg"}
  />
</Helmet>
<StoreTopbar data={homepage?.topbar} />

      {/* NAVBAR */}
      <StoreNavbar
        data={homepage?.navbar}
        theme={theme}
      />

      {/* HERO */}
      <HeroComponent
        data={homepage.hero}
        theme={theme}
      />

      {/* OTHER SECTIONS */}
      {homepage?.sections?.map((sec) => {

        switch (sec.type) {

          case "collections":
            return (
              <CollectionsSection
                key={sec.id}
                data={sec}
                theme={theme}
              />
            );

          

          default:
            return null;
        }

      })}
    
{homepage?.shopTheLook?.enabled && (
  <ShopTheLook
    data={homepage.shopTheLook}
  />
)}
      {homepage?.enquiryForm?.enabled && (
  <EnquiryFormSection
    data={homepage.enquiryForm}
    theme={theme}
  />
)}
       <AboutSection
    data={homepage.about}
    theme={theme}
  />
  
    <TestimonialsSection
    data={homepage.testimonials}
    theme={theme}
  />
  <FooterSection
    data={homepage.footer}
    theme={theme}
  />
  <StoreFloatingContact
  data={homepage?.floatingContact}
/>

      {/* TRUST SECTION (optional) */}
      {/* <TrustSection theme={theme} /> */}

    </div>
  );
};

export default StoreHomepage;