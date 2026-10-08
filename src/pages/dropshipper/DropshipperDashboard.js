import React, { useEffect, useState } from "react";
import {
doc,
getDoc,
collection,
query,
where,
getDocs,
updateDoc
} from "firebase/firestore";

import { db } from "../../firebase";
import { useAuth } from "../../components/AuthContext";

import "./DropshipperDashboard.css";

const DropshipperDashboard = () => {

const { currentUser } = useAuth();

const [userData,setUserData] = useState(null);
const [orders,setOrders] = useState([]);
const [payouts,setPayouts] = useState([]);
const [minimumOrderValue,setMinimumOrderValue] =
useState("");

const [shippingType,setShippingType] =
useState("free");

const [shippingCharge,setShippingCharge] =
useState("");

const [shippingLabel,setShippingLabel] =
useState("");

const [saving,setSaving] =
useState(false);
const [loading,setLoading] = useState(true);

/* =========================
LOAD USER + DATA
========================= */

useEffect(()=>{

if(!currentUser) return;

const loadData = async()=>{

try{

/* LOAD USER DOC */

const userRef = doc(db,"users",currentUser.uid);
const userSnap = await getDoc(userRef);

if(userSnap.exists()){

const data = userSnap.data();

setUserData(data);

setMinimumOrderValue(
data.minimumOrderValue || ""
);

setShippingType(
data.shippingSettings?.type || "free"
);

setShippingCharge(
data.shippingSettings?.charge || ""
);

setShippingLabel(
data.shippingSettings?.label || ""
);

}

/* LOAD ORDERS */

const ordersSnap = await getDocs(
query(
collection(db,"storeOrders"),
where("sellerId","==",currentUser.uid)
)
);

const ordersList = ordersSnap.docs.map(doc=>({
id:doc.id,
...doc.data()
}));

setOrders(ordersList);

/* LOAD PAYOUTS */

const payoutSnap = await getDocs(
query(
collection(db,"sellerPayouts"),
where("sellerId","==",currentUser.uid)
)
);

const payoutList = payoutSnap.docs.map(doc=>doc.data());

setPayouts(payoutList);

}catch(err){
console.error(err);
}

setLoading(false);

};

loadData();

},[currentUser]);

/* =========================
CALCULATIONS
========================= */

let totalRevenue = 0;
let totalProfit = 0;

orders.forEach(order=>{

totalRevenue += order.totalAmount || 0;

(order.items || []).forEach(item=>{

totalProfit +=
((item.priceAtTimeOfOrder || 0) - (item.costPrice || 0))
*
(item.quantity || 0);

});

});

const totalPaid = payouts.reduce(
(sum,p)=>sum + (p.amount || 0),
0
);

const pending = totalProfit - totalPaid;

/* =========================
COPY STORE LINK
========================= */

const copyLink = ()=>{

const link = `${window.location.origin}/store/${userData?.storeSlug}`;

navigator.clipboard.writeText(link);

alert("Store link copied");

};
/* =========================
SAVE STORE SETTINGS
========================= */

const saveStoreSettings = async()=>{

try{

setSaving(true);

await updateDoc(
doc(db,"users",currentUser.uid),
{

minimumOrderValue:
Number(minimumOrderValue || 0),

shippingSettings:{

type:shippingType,

charge:
shippingType === "fixed"
? Number(shippingCharge || 0)
: 0,

label:
shippingType === "customText"
? shippingLabel
: ""

}

}
);

alert("Settings updated");

}catch(err){

console.error(err);

alert("Failed to save settings");

}

setSaving(false);

};

/* =========================
LOADING
========================= */

if(loading){
return <div className="seller-loading">Loading dashboard...</div>;
}

/* =========================
UI
========================= */

return(

<div className="seller-dashboard">

<h1>Seller Dashboard</h1>

<p className="welcome">
Welcome back, <strong>{userData?.name}</strong>
</p>

{/* STORE INFO */}

<div className="store-card">

<h2>Your Store</h2>

<div className="store-link">

<a
href={`/store/${userData?.storeSlug}`}
target="_blank"
rel="noreferrer"
>

{window.location.origin}/store/{userData?.storeSlug}

</a>

<button onClick={copyLink}>
Copy
</button>

</div>

<div className="store-meta">

<p><b>Store Name:</b> {userData?.storeName}</p>

<p><b>Store Slug:</b> {userData?.storeSlug}</p>

<p><b>Store Domain:</b> {userData?.storeDomain}</p>

<p><b>Email:</b> {userData?.email}</p>

</div>

</div>
{/* =========================
STORE SETTINGS
========================= */}

<div className="store-card">

<h2>Store Settings</h2>

{/* MINIMUM ORDER */}

<div className="settings-group">

<label>Minimum Order Value</label>

<input
type="number"
placeholder="Enter minimum order value"
value={minimumOrderValue}
onChange={(e)=>
setMinimumOrderValue(e.target.value)
}
/>

</div>

{/* SHIPPING TYPE */}

<div className="settings-group">

<label>Shipping Type</label>

<select
value={shippingType}
onChange={(e)=>
setShippingType(e.target.value)
}
>

<option value="free">
Free Shipping
</option>

<option value="fixed">
Fixed Shipping
</option>

<option value="customText">
Custom Text
</option>

</select>

</div>

{/* FIXED SHIPPING */}

{shippingType === "fixed" && (

<div className="settings-group">

<label>Shipping Charge</label>

<input
type="number"
placeholder="Enter shipping amount"
value={shippingCharge}
onChange={(e)=>
setShippingCharge(e.target.value)
}
/>

</div>

)}

{/* CUSTOM TEXT */}

{shippingType === "customText" && (

<div className="settings-group">

<label>Shipping Label</label>

<input
type="text"
placeholder="Applicable as per location"
value={shippingLabel}
onChange={(e)=>
setShippingLabel(e.target.value)
}
/>

</div>

)}

<button
className="save-settings-btn"
onClick={saveStoreSettings}
disabled={saving}
>

{saving
? "Saving..."
: "Save Settings"}

</button>

</div>


{/* STATS */}

<div className="dashboard-stats">

<div className="stat-card">

<h3>Total Orders</h3>

<p>{orders.length}</p>

</div>

<div className="stat-card">

<h3>Total Revenue</h3>

<p>₹{totalRevenue}</p>

</div>

<div className="stat-card">

<h3>Total Profit</h3>

<p className="profit">₹{totalProfit}</p>

</div>

<div className="stat-card">

<h3>Total Paid</h3>

<p className="paid">₹{totalPaid}</p>

</div>

<div className="stat-card">

<h3>Pending Payout</h3>

<p className="pending">₹{pending}</p>

</div>

</div>

</div>

);

};

export default DropshipperDashboard;