import React, { useEffect, useMemo, useState } from "react";
import { db, collectionGroup, getDocs, query, where } from "../firebase";
import { Link } from "react-router-dom";
import "./NewArrivalsSection.css";

const NEW_ARRIVAL_TAG = "new_arrival";

const NewArrivalsSection = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNewArrivals = async () => {
      try {
        const ref = collectionGroup(db, "products");
        const q = query(ref, where("tags", "array-contains", NEW_ARRIVAL_TAG));
        const snap = await getDocs(q);

        setProducts(
          snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            collectionId: doc.ref.path.split("/")[1],
            image: doc.data().image || doc.data().images?.[0]?.url,
            name: doc.data().productName || doc.data().name || "Untitled",
          }))
        );
      } catch (e) {
        console.error("New arrivals error:", e);
      }
      setLoading(false);
    };

    fetchNewArrivals();
  }, []);

  const data = useMemo(() => products.filter((p) => p.image), [products]);

  if (loading || data.length === 0) return null;

  const featured = data[0];
  const rest = data.slice(1);

  return (
    <section className="na-premium">
      {/* HERO */}
      <div className="na-hero">
        <div className="na-hero-media">
          <img src={featured.image} alt={featured.name} />
        </div>

        <div className="na-hero-content">
          <span className="na-eyebrow">New Arrival</span>
          <h2>{featured.name}</h2>

          <p>
            A refined expression of craftsmanship — designed to elevate
            everyday moments with timeless elegance.
          </p>

          {featured.price && (
            <div className="na-price">
              ₹{Number(featured.price).toLocaleString("en-IN")}
            </div>
          )}

          <Link
            to={`/collections/${featured.collectionId}/all-products`}
            className="na-cta"
          >
            Explore Collection →
          </Link>
        </div>
      </div>

      {/* CURATED STRIP */}
      <div className="na-strip">
        {rest.map((item) => (
          <Link
            key={item.id}
            to={`/collections/${item.collectionId}/all-products`}
            className="na-card"
          >
            <div className="na-card-image">
              <img src={item.image} alt={item.name} />
            </div>

            <div className="na-card-info">
              <h4>{item.name}</h4>
              {item.price && (
                <span>
                  ₹{Number(item.price).toLocaleString("en-IN")}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default NewArrivalsSection;
