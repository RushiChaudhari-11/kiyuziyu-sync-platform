import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { db, collection, getDocs } from "../firebase";
import CollectionCard from "../components/CollectionCard";
import BrowseCollectionSection from "../components/BrowseCollectionSection";
import HeroSection from "../components/HeroSection";
import BestSellersSection from "../components/BestSellersSection";
import NewArrivalsSection from "../components/NewArrivalsSection";
import TrendingSection from "../components/TrendingSection";
import "./HomePage.css";
import BulkEnquirySection from '../components/BulkEnquirySection';
import InstagramReelsSection from "../components/InstagramReelsSection";
import Topbar from "../components/Topbar";
import { trackMetaEvent } from "../utils/pixels";
const HomePage = () => {
  const [collections, setCollections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCollections = async () => {
      setIsLoading(true);
      try {
        const qSnap = await getDocs(collection(db, "collections"));
        const fetched = qSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        fetched.sort((a, b) => (a.showNumber || 0) - (b.showNumber || 0));
        setCollections(fetched);
      } catch (err) {
        console.error("Error fetching collections:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCollections();
  }, []);

  // Reveal on scroll observer for .collection-link elements
  useEffect(() => {
    if (typeof window === "undefined") return;
    const observerOpts = {
      root: null,
      rootMargin: "0px 0px -10% 0px",
      threshold: 0.08,
    };
    const revealCb = (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("reveal");
          obs.unobserve(entry.target);
        }
      });
    };
    const io = new IntersectionObserver(revealCb, observerOpts);
    const nodes = document.querySelectorAll(".collection-link");
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [collections]);

  return (
    <>
      {/* <HeroSection /> */}

      {/* Featured Collections */}
      <section
  id="collections"
  className="collections-section"
  aria-labelledby="featured-collections-heading"
>
  <div className="collections-header">
    <h2 id="featured-collections-heading">
      Anti-Tarnish Catalogue
    </h2>

    <p className="collections-subtitle">
      Curated lines crafted with ethical gold and artisan finishes.
    </p>
  </div>

  {isLoading ? (
    <div
      className="collection-gridmain"
      role="status"
      aria-label="Loading collections"
    >
      {[1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="collection-loading-card"
        >
          <div className="collection-loading-image">
            <div className="collection-loading-shimmer" />
          </div>

          <div className="collection-loading-bottom">
            <div className="collection-loading-title" />
            <div className="collection-loading-button" />
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div
      className="collection-gridmain"
      role="list"
      aria-live="polite"
    >
      {collections.map((col) => (
        <Link
          to={`/collections/${col.id}/all-products`}
          key={col.id}
          className="collection-link"
          role="listitem"
          aria-label={`Open ${
            col.title || col.name || "Collection"
          } collection`}
          onClick={() => {
            trackMetaEvent("ViewContent", {
              content_name:
                col.title ||
                col.name ||
                "Collection",

              content_ids: [col.id],

              content_type: "product_group",
            });
          }}
        >
          <CollectionCard
            id={col.id}
            title={
              col.title ||
              col.name ||
              "Collection"
            }
            image={col.image || ""}
            additionalImages={
              col.additionalImages || []
            }
            alt={
              col.imageAlt ||
              col.title ||
              col.name ||
              "Collection image"
            }
          />
        </Link>
      ))}
    </div>
  )}
</section>
      {/* <InstagramReelsSection /> */}
    {/* <BulkEnquirySection /> */}
  


      {/* Other sections */}
      {/* <TrendingSection />
      <NewArrivalsSection />
       */}
    </>
  );
};

export default HomePage;
