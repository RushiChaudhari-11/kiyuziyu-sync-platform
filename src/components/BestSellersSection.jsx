// src/components/BestSellersSection.jsx
import React, { useState, useEffect } from 'react';
import { db, collection, getDocs } from '../firebase';
import ProductCard from './ProductCard'; // Assuming ProductCard is in the same folder
import { useCart, getPriceForQuantity, createStablePricingId, getCartItemId } from './CartContext';
import { useAuth } from './AuthContext';
import './BestSellersSection.css';

const BestSellersSection = () => {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { cart, addToCart, removeFromCart } = useCart();
  const { userRole } = useAuth();
  
  useEffect(() => {
    const fetchBestSellers = async () => {
      setIsLoading(true);
      try {
        // Fetch products, you can filter by a 'bestseller' flag in your database
        const querySnapshot = await getDocs(collection(db, "products"));
        const fetchedProducts = querySnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        }));

        // For now, let's just show the first 4 products as "best sellers"
        setProducts(fetchedProducts.slice(0, 4));
      } catch (error) {
        console.error("Error fetching best sellers:", error);
      }
      setIsLoading(false);
    };

    fetchBestSellers();
  }, []);

  return (
    <div className="bestsellers-section">
      <h3>Best Sellers</h3>
      {isLoading ? (
        <p>Loading best sellers...</p>
      ) : (
        <div className="bestsellers-grid">
          {products.map((product) => (
            <ProductCard 
              key={product.id} 
              product={product}
              cart={cart}
              onIncrement={() => addToCart(product)}
              onDecrement={(cartItemId) => removeFromCart(cartItemId)}
              isCart={true} // Add this prop to display quantity controls if you want
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default BestSellersSection;