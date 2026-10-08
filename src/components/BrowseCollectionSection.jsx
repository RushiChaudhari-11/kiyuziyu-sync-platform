// src/components/BrowseCollectionSection.jsx
import React from 'react';
import collecionimg from '../assets/collectionimg.jpg';
const BrowseCollectionSection = () => {
  return (
    <section className="browse-section">
      <div className="content">
        <h2 className="title">Charmed Memories</h2>
        <p className="subtitle">Celebrate a chapter (or two) from the story of her life.</p>
        <button className="browse-btn">Browse Collection</button>
      </div>
      <div className="image">
        <img src={collecionimg} alt="Model with Jewelry" />
      </div>
    </section>
  );
};

export default BrowseCollectionSection;
