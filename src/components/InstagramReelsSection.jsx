import React from "react";
import ReelsCarousel from "./ReelsCarousel";
import reelsData from "../data/reelsData";
import "./InstagramReelsSection.css";

const InstagramReelsSection = () => {
  return (
    <section
      className="reels-section"
      aria-labelledby="instagram-reels-heading"
    >
      <div className="reels-header-wrapper">
        <div className="reels-header">
          <h2 id="instagram-reels-heading">Trending on Instagram</h2>
          <p>Real styles. Real moments.</p>
        </div>
      </div>

      <ReelsCarousel reels={reelsData} />
    </section>
  );
};

export default InstagramReelsSection;
