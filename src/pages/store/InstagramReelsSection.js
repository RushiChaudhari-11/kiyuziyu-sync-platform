import React from "react";
import "./InstagramReelsSection.css";

const InstagramReelsSection = ({ data }) => {
  return (
    <section
      className="reels-section"
      aria-labelledby="instagram-reels-heading"
    >
      <div className="reels-header-wrapper">
        <div className="reels-header">
          <h2 id="instagram-reels-heading">
            {data?.title || "Trending on Instagram"}
          </h2>

          <p>
            {data?.subtitle || "Real styles. Real moments."}
          </p>
        </div>
      </div>

      <div className="reels-grid">
        {data?.reels?.map((reel, index) => (
          <div key={index} className="reel-card">
            <video
              src={reel.videoUrl}
              poster={reel.thumbnail}
              controls
              playsInline
              preload="metadata"
            />
          </div>
        ))}
      </div>
    </section>
  );
};

export default InstagramReelsSection;