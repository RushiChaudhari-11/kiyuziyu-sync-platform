import { useEffect, useState } from "react";

import {
  doc,
  onSnapshot,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

import "../styles/breakingNews.css";

function BreakingNews() {

  const [news, setNews] =
    useState(
      "Loading latest updates..."
    );

  useEffect(() => {

    const unsubscribe =
      onSnapshot(

        doc(
          db,
          "breakingNews",
          "latest"
        ),

        (snapshot) => {

          if (
            !snapshot.exists()
          ) {
            return;
          }

          const data =
            snapshot.data();

          setNews(
            data.text ||
            "No updates available"
          );

        }

      );

    return () =>
      unsubscribe();

  }, []);

  return (

    <div className="breaking-news">

      <div className="breaking-label">
        🔴 BREAKING NEWS
      </div>

      <div className="breaking-content">

        <div className="breaking-track">

          {news}

        </div>

      </div>

    </div>

  );

}

export default BreakingNews;