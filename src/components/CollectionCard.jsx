import React, { useEffect, useMemo, useState } from "react";
import "./CollectionCard.css";

/**
 * CollectionCard
 *
 * Features:
 * - Main + additional images
 * - Preloads images
 * - Cross-fade rotation every 5 seconds
 * - Title below image
 * - Explore button below image
 * - Admin actions support
 * - Keyboard accessible
 */

const CollectionCard = ({
  id,
  title,
  image,
  additionalImages = [],
  alt,
  onClick,
  children,
}) => {

  /* =========================
     IMAGE LIST
  ========================= */

  const imagesToDisplay = useMemo(() => {
    return [
      ...(image ? [image] : []),
      ...(Array.isArray(additionalImages)
        ? additionalImages.filter(Boolean)
        : []),
    ];
  }, [image, additionalImages]);


  /* =========================
     STATE
  ========================= */

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const [loadedImages, setLoadedImages] = useState({});


  /* =========================
     RESET IMAGE INDEX
  ========================= */

  useEffect(() => {
    setCurrentImageIndex(0);
  }, [imagesToDisplay.length]);


  /* =========================
     PRELOAD IMAGES
  ========================= */

  useEffect(() => {

    if (!imagesToDisplay.length) return;

    imagesToDisplay.forEach((src) => {

      if (loadedImages[src] !== undefined) return;

      const img = new Image();

      img.src = src;

      img.onload = () => {
        setLoadedImages((prev) => ({
          ...prev,
          [src]: true,
        }));
      };

      img.onerror = () => {
        setLoadedImages((prev) => ({
          ...prev,
          [src]: false,
        }));
      };

    });

  }, [imagesToDisplay, loadedImages]);


  /* =========================
     AUTO ROTATION
     5 SECONDS
  ========================= */

  useEffect(() => {

    if (imagesToDisplay.length <= 1) return;

    const interval = setInterval(() => {

      setCurrentImageIndex((prev) =>
        (prev + 1) % imagesToDisplay.length
      );

    }, 5000);

    return () => clearInterval(interval);

  }, [imagesToDisplay.length]);


  /* =========================
     KEYBOARD
  ========================= */

  const handleKeyDown = (e) => {

    if (!onClick) return;

    if (e.key === "Enter" || e.key === " ") {

      e.preventDefault();

      onClick(e);

    }

  };


  /* =========================
     RENDER
  ========================= */

  return (

    <article
      className="collection-card"
      role="group"
      aria-labelledby={
        id
          ? `collection-title-${id}`
          : undefined
      }
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >

      {/* =========================
          ADMIN ACTIONS
      ========================= */}

      {children && (
        <div
          className="collection-admin-actions"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      )}


      {/* =========================
          IMAGE
      ========================= */}

      <div className="collection-card-media">

        {imagesToDisplay.length > 0 ? (

          imagesToDisplay.map((src, index) => (

            <img
              key={`${src}-${index}`}
              src={src}
              alt={
                alt ||
                title ||
                "Collection image"
              }
              className={`collection-image ${
                index === currentImageIndex
                  ? "active"
                  : ""
              }`}
              loading={
                index === 0
                  ? "eager"
                  : "lazy"
              }
              decoding="async"
              draggable={false}
            />

          ))

        ) : (

          <div
            className="collection-image-placeholder"
            aria-hidden="true"
          />

        )}

      </div>


      {/* =========================
          CONTENT BELOW IMAGE
      ========================= */}

     <div className="collection-card-content">

  {/* COLLECTION NAME */}

  <span
    className="product-pill"
    id={
      id
        ? `collection-title-${id}`
        : undefined
    }
    title={title}
  >
    {title || "Collection"}
  </span>


  {/* EXPLORE COLLECTION */}

  {/* <span
    className="btn-pill"
    aria-hidden="true"
  >
    <span>
      Explore Collection
    </span>

    <span className="arrow">
      →
    </span>
  </span> */}

</div>

    </article>

  );
};

export default CollectionCard;