import React from "react";
import CollectionCard from "../../components/CollectionCard";
import "./CollectionsSection.css";
import { useNavigate } from "react-router-dom";
import { getCleanDomain } from "../../utils/domain";

const CollectionsSection = ({ data, theme }) => {

  const navigate = useNavigate();

  if (!data?.collections?.length) return null;

  /* ================= THEME ================= */

  const sectionStyle = {
    padding: "40px 20px",

    /* theme variables */
    "--accent": theme?.colors?.primary || "#e73e35",
    "--accent-light": theme?.colors?.primaryLight || "#ff8c82",
    "--text-dark": theme?.colors?.text || "#0e1724",
    "--bg-card": theme?.colors?.background || "#ffffff"
  };

  return (

    <section style={sectionStyle}>

      {/* SECTION TITLE */}

      {data.title && (
        <h2 className="collection-section-title">
          {data.title}
        </h2>
      )}

      {/* COLLECTION GRID */}

      <div className="collection-grid">

        {data.collections.map((col) => (

          <CollectionCard
            key={col.id}
            id={col.openCollectionId}
            title={col.title}
            image={col.image}
            additionalImages={col.additionalImages}

            onClick={() => {
              navigate("/store", {
                state: {
                  collectionId: col.openCollectionId,
                  storeDomain: getCleanDomain()
                }
              });
            }}

          />

        ))}

      </div>

    </section>

  );

};

export default CollectionsSection;