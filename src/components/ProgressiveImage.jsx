import { useState } from "react";

/**
 * Remove Firebase token → allows browser caching
 */
const stripFirebaseToken = (url) => {
  try {
    const u = new URL(url);
    u.searchParams.delete("token");
    return u.toString();
  } catch {
    return url;
  }
};

/**
 * Build optimized Firebase image URL
 */
const getOptimizedUrl = (url, { w, q }) => {
  if (!url) return "";

  const cleanUrl = stripFirebaseToken(url);

  // If params already exist, append safely
  return `${cleanUrl}${cleanUrl.includes("?") ? "&" : "?"}w=${w}&quality=${q}`;
};

export default function ProgressiveImage({ src, alt, className = "" }) {
  const [loaded, setLoaded] = useState(false);

  // 🔹 Very small blurred placeholder (≈5–10 KB)
  const lowQualitySrc = getOptimizedUrl(src, {
    w: 40,
    q: 10,
  });

  // 🔹 Main image (≈150–250 KB instead of MBs)
  const fullQualitySrc = getOptimizedUrl(src, {
    w: 450,
    q: 65,
  });

  return (
    <div className={`progressive-img ${className}`}>
      {/* Placeholder */}
      <img
        src={lowQualitySrc}
        alt=""
        aria-hidden="true"
        className="img-placeholder"
      />

      {/* Main image */}
      <img
        src={fullQualitySrc}
        alt={alt}
        loading="lazy"
        className={`img-full ${loaded ? "visible" : ""}`}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
