import React, { useEffect, useState, useCallback } from "react";
import ReelCard from "./ReelCard";
import "./ReelsCarousel.css";

const AUTO_INTERVAL = 5000;

const getWindowIndexes = (active, total) => {
  const mod = (n) => (n + total) % total;
  return [
    mod(active - 2),
    mod(active - 1),
    active,
    mod(active + 1),
    mod(active + 2),
  ];
};

const POSITIONS = ["far-left", "left", "center", "right", "far-right"];

const ReelsCarousel = ({ reels = [] }) => {
  const total = reels.length;
  const [activeIndex, setActiveIndex] = useState(0);

  /* ---------- AUTO ROTATE ---------- */
  useEffect(() => {
    if (total <= 1) return;
    const id = setInterval(() => {
      setActiveIndex((i) => (i + 1) % total);
    }, AUTO_INTERVAL);
    return () => clearInterval(id);
  }, [total]);

  const goNext = useCallback(
    () => setActiveIndex((i) => (i + 1) % total),
    [total]
  );

  const goPrev = useCallback(
    () => setActiveIndex((i) => (i - 1 + total) % total),
    [total]
  );

  if (!total) return null;

  const windowIndexes = getWindowIndexes(activeIndex, total);

  return (
    <div className="reels-carousel">
      <button className="nav-btn left" onClick={goPrev} aria-label="Previous">
        ←
      </button>

      <div className="reels-stage">
        <div className="reels-track">
          {windowIndexes.map((reelIndex, i) => {
            const reel = reels[reelIndex];
            const position = POSITIONS[i];

            return (
              <div
                key={reel.id}                 
                className={`reel-slot ${position}`}
              >
                <ReelCard
                  videoUrl={reel.videoUrl}
                  poster={reel.poster}
                  caption={reel.caption}
                  instaUrl={reel.instaUrl}
                  isActive={position === "center"}
                />
              </div>
            );
          })}
        </div>
      </div>

      <button className="nav-btn right" onClick={goNext} aria-label="Next">
        →
      </button>
    </div>
  );
};

export default ReelsCarousel;
