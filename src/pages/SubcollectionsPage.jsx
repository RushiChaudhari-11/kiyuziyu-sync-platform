import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom'; // Import useParams and Link
import { db, collection, getDocs, doc, getDoc } from '../firebase'; // Import Firestore functions
import CollectionCard from '../components/CollectionCard';
import Footer from '../components/Footer';

const SubcollectionsPage = () => {
  const { collectionId } = useParams();
  const [mainCollection, setMainCollection] = useState(null);
  const [subcollections, setSubcollections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCollectionData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const mainCollectionDocRef = doc(db, "collections", collectionId);
        const mainCollectionDocSnap = await getDoc(mainCollectionDocRef);

        if (mainCollectionDocSnap.exists()) {
          setMainCollection({ id: mainCollectionDocSnap.id, ...mainCollectionDocSnap.data() });
          const subcollectionRef = collection(db, "collections", collectionId, "subcollections");
          const querySnapshot = await getDocs(subcollectionRef);
          const fetchedSubcollections = querySnapshot.docs.map(subDoc => ({
            ...subDoc.data(),
            id: subDoc.id
          }));
          setSubcollections(fetchedSubcollections.sort((a, b) => a.showNumber - b.showNumber));
        } else {
          setError("Main collection not found.");
          setMainCollection(null);
          setSubcollections([]);
        }
      } catch (err) {
        console.error("Error fetching collection data:", err);
        setError("Failed to load collection data.");
      } finally {
        setIsLoading(false);
      }
    };

    if (collectionId) {
      fetchCollectionData();
    } else {
      setError("No collection ID provided.");
      setIsLoading(false);
    }
  }, [collectionId]);

  if (isLoading) {
    return (
      <div className="subcollections-page-container">
        <p>Loading subcollections...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="subcollections-page-container">
        <p className="error-message">{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="subcollections-page-container">
        <h2 className="page-title">
          Subcollections for: "{mainCollection?.title || 'Unknown Collection'}"
        </h2>
        {subcollections.length === 0 ? (
          <p className="no-subcollections-message">No subcollections found for this main collection.</p>
        ) : (
          <div className="subcollections-grid collections-grid">
            {subcollections.map((sub) => (
              <Link to={`/collections/${collectionId}/subcollections/${sub.id}`} key={sub.id}>
                <CollectionCard title={`${sub.name} (#${sub.showNumber})`} image={sub.image} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default SubcollectionsPage;
