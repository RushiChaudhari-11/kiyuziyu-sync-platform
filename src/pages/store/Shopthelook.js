import { useState } from "react";
import {
  Play,
  Volume2,
  VolumeX
} from "lucide-react";

import "./shopthelook.css";

export default function ShopTheLook({ data }) {

  const reels = data?.reels || [];

  const [viewerOpen, setViewerOpen] =
    useState(false);

  const [selectedIndex, setSelectedIndex] =
    useState(0);

  const [mutedVideos, setMutedVideos] =
    useState({});

  function openViewer(index) {

    setSelectedIndex(index);

    setViewerOpen(true);
  }

  function closeViewer() {

    setViewerOpen(false);
  }

  function toggleMute(e, index) {

    e.stopPropagation();

    setMutedVideos(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  }

  if (!data?.enabled) return null;

  return (
    <>
      <section className="shop-look">

        {/* HEADER */}

        <div className="shop-look-header">

          <span className="shop-look-tag">
            STYLE INSPIRATION
          </span>

          <h2>
            {data?.title || "Shop The Look"}
          </h2>

          <p>
            Discover real looks styled with our latest collection.
          </p>

        </div>

        {/* REELS */}

        <div className="shop-look-slider">

          {reels.map((reel, index) => (

            <div
              key={index}
              className="shop-look-card"
              onClick={() =>
                openViewer(index)
              }
            >

              {reel.videoUrl ? (

                <>
                  <video
                    src={reel.videoUrl}
                    muted={
                      mutedVideos[index] !== false
                    }
                    loop
                    autoPlay
                    playsInline
                    preload="metadata"
                  />

                  {/* SOUND BUTTON */}

                  <button
                    className="reel-sound-btn"
                    onClick={(e) =>
                      toggleMute(e, index)
                    }
                  >

                    {mutedVideos[index] === false ? (
                      <Volume2 size={18} />
                    ) : (
                      <VolumeX size={18} />
                    )}

                  </button>

                  {/* OVERLAY */}

                  
                </>

              ) : (

                <div className="shop-look-placeholder">

                  <span>
                    Reel Coming Soon
                  </span>

                </div>

              )}

            </div>

          ))}

        </div>

      </section>

      {/* VIEWER MODAL WILL COME LATER */}

      {viewerOpen && null}

    </>
  );
}