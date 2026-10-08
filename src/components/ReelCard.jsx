import React, { useEffect, useRef } from "react";
import "./ReelCard.css";

const ReelCard = ({
  videoUrl,
  poster,
  caption,
  instaUrl,
  isActive,
}) => {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [isActive]);

  const handleClick = () => {
    if (instaUrl) {
      window.open(instaUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      className={`reel-card ${isActive ? "active" : ""}`}
      onClick={isActive ? handleClick : undefined}
      role={isActive ? "button" : undefined}
      aria-label={caption || "Instagram reel"}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        poster={poster}
        muted
        loop
        playsInline
        preload="metadata"
      />

      {/* 🔥 CAPTION OVERLAY (ACTIVE ONLY) */}
      {isActive && caption && (
        <div className="reel-caption">
          <p>{caption}</p>

          {instaUrl && (
            <span className="reel-instagram">
              View on Instagram →
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default ReelCard;
