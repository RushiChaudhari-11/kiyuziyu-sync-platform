import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Routes, Route } from "react-router-dom";

import { db} from "../../firebase";
import { StoreAuthProvider } from "./StoreAuthContext";

import SellerStore from "../dropshipper/SellerStore";
import StoreLogin from "./StoreLogin";
import StoreSignup from "./StoreSignup";
import StoreCartPage from "./StoreCartPage";
import StoreCheckoutPage from "./StoreCheckoutPage";
import StoreMyOrders from "./StoreMyOrders";
import StoreNavbar from "./StoreNavbar";
import { StoreCartProvider } from "./StoreCartContext";
import { getCleanDomain } from "../../utils/domain";
import { doc, getDoc, } from "firebase/firestore";
import { Helmet } from "react-helmet-async";
const StoreLoader = () => {

    const [seller, setSeller] = useState(null);
    const [loading, setLoading] = useState(true);
    const [homepage, setHomepage] = useState(null);
  useEffect(()=>{

const loadStore = async()=>{

try{

const domain = getCleanDomain();

/* ================= SELLER ================= */

const q = query(
collection(db,"users"),
where("storeDomain","==",domain)
);

const snap = await getDocs(q);

if(!snap.empty){

const sellerData = {
id:snap.docs[0].id,
...snap.docs[0].data()
};

setSeller(sellerData);

/* ================= HOMEPAGE ================= */
const homepageRef = doc(db,"storeHomepages",domain);
const homepageSnap = await getDoc(homepageRef);

if(homepageSnap.exists()){
setHomepage(homepageSnap.data());
}

}

}catch(err){
console.error("Store load error:",err);
}

setLoading(false);

};

loadStore();

},[]);


/* load homepage config */

const domain = getCleanDomain();

const storeName =
  homepage?.navbar?.brandName || seller?.storeName || "Online Store";

const description =
  homepage?.hero?.subtitle ||
  `Shop premium products from ${storeName}`;
    if (loading) {
        return <h2 style={{ padding: "40px" }}>Loading store...</h2>;
    }

    if (!seller) {
        return <h2 style={{ padding: "40px" }}>Store not found</h2>;
    }

    return (

        <StoreAuthProvider sellerId={seller.id}>
            <Helmet>

<title>{storeName}</title>

<meta name="description" content={description} />

<meta property="og:title" content={storeName} />
<meta property="og:description" content={description} />
<meta property="og:type" content="website" />
<meta property="og:url" content={`https://${domain}`} />

<meta
  property="og:image"
  content={homepage?.hero?.images?.[0]?.src || "/default-og.jpg"}
/>

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content={storeName} />
<meta name="twitter:description" content={description} />

<meta
  name="twitter:image"
  content={homepage?.hero?.images?.[0]?.src || "/default-og.jpg"}
/>

</Helmet>
            <StoreCartProvider>
               <StoreNavbar
data={homepage?.navbar}
theme={homepage?.theme}
/>

                <Routes>
                    <Route path="/" element={<SellerStore seller={seller} />} />

                    <Route path="login" element={<StoreLogin />} />

                    <Route path="signup" element={<StoreSignup />} />
                    <Route path="cart" element={<StoreCartPage />} />

                    <Route path="checkout" element={<StoreCheckoutPage />} />
                    <Route path="orders" element={<StoreMyOrders />} />

                </Routes>
            </StoreCartProvider>

        </StoreAuthProvider>

    );

};

export default StoreLoader;
