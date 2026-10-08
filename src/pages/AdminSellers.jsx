import React, { useEffect, useState } from "react";
import {
collection,
getDocs,
doc,
updateDoc
} from "firebase/firestore";

import { db } from "../firebase";

import "./AdminSellers.css";

const AdminSellers = () => {

const [sellers,setSellers] = useState([]);
const [orders,setOrders] = useState([]);
const [expanded,setExpanded] = useState(null);

const [editing,setEditing] = useState(null);

const [newPayment,setNewPayment] = useState({});

const [sortField,setSortField] = useState("revenue");
const [sortDirection,setSortDirection] = useState("desc");

const [loading,setLoading] = useState(true);

/* =========================
LOAD DATA
========================= */

useEffect(()=>{

const loadData = async()=>{

const sellersSnap = await getDocs(collection(db,"users"));

const sellersList = sellersSnap.docs
.map(doc=>({
id:doc.id,
...doc.data()
}))
.filter(u=>u.role==="dropshipper");

const ordersSnap = await getDocs(collection(db,"storeOrders"));

const ordersList = ordersSnap.docs.map(doc=>({
id:doc.id,
...doc.data()
}));

setSellers(sellersList);
setOrders(ordersList);

setLoading(false);

};

loadData();

},[]);

/* =========================
SELLER STATS
========================= */

const getStats = (sellerId)=>{

const sellerOrders = orders.filter(
o=>o.sellerId===sellerId
);

let revenue = 0;
let profit = 0;

sellerOrders.forEach(order=>{

revenue += order.totalAmount || 0;

(order.items||[]).forEach(item=>{

profit += (
(item.priceAtTimeOfOrder||0)
-
(item.costPrice||0)
)
*
(item.quantity||0);

});

});

return{
orders:sellerOrders.length,
revenue,
profit
};

};

/* =========================
SUBSCRIPTION TOTALS
========================= */

const getTotalPaid = (seller)=>{

return (
seller?.subscription?.payments || []
).reduce(
(sum,p)=>sum + Number(p.amount || 0),
0
);

};

const getRemainingAmount = (seller)=>{

const total = Number(
seller?.subscription?.totalAmount || 0
);

return total - getTotalPaid(seller);

};

/* =========================
ADD PAYMENT
========================= */

const addPayment = (seller)=>{

const payment = newPayment[seller.id];

if(!payment?.amount) return;

const updatedPayments = [
...(editing?.subscription?.payments ||
seller.subscription?.payments ||
[]),

payment
];

setEditing({

...seller,

subscription:{

...(editing?.subscription ||
seller.subscription ||
{}),

payments:updatedPayments

}

});

setNewPayment({

...newPayment,

[seller.id]:{
amount:"",
paidDate:"",
method:"",
note:""
}

});

};

/* =========================
SORT
========================= */

const handleSort = (field)=>{

if(sortField===field){

setSortDirection(
sortDirection==="asc"
?"desc"
:"asc"
);

}else{

setSortField(field);
setSortDirection("asc");

}

};

/* =========================
SORTED SELLERS
========================= */

const sortedSellers = [...sellers].sort((a,b)=>{

const aStats = getStats(a.id);
const bStats = getStats(b.id);

let aValue,bValue;

if(sortField==="name"){

aValue = a.name || "";
bValue = b.name || "";

}

if(sortField==="orders"){

aValue = aStats.orders;
bValue = bStats.orders;

}

if(sortField==="revenue"){

aValue = aStats.revenue;
bValue = bStats.revenue;

}

if(sortField==="profit"){

aValue = aStats.profit;
bValue = bStats.profit;

}

if(aValue < bValue)
return sortDirection==="asc"?-1:1;

if(aValue > bValue)
return sortDirection==="asc"?1:-1;

return 0;

});

/* =========================
SAVE SELLER
========================= */

const saveSeller = async()=>{

await updateDoc(
doc(db,"users",editing.id),
editing
);

setSellers(prev=>
prev.map(s=>
s.id===editing.id
?editing
:s
)
);

setEditing(null);

};

/* =========================
LOADING
========================= */

if(loading){

return(
<div className="admin-loading">
Loading sellers...
</div>
);

}

/* =========================
UI
========================= */

return(

<div className="admin-sellers">

<h1>Marketplace Sellers</h1>

<div className="sellers-table">

{/* HEADER */}

<div className="table-header">

<div onClick={()=>handleSort("name")}>
Seller
</div>

<div>
Store
</div>

<div>
Email
</div>

<div onClick={()=>handleSort("orders")}>
Orders
</div>

<div onClick={()=>handleSort("revenue")}>
Revenue
</div>

<div onClick={()=>handleSort("profit")}>
Profit
</div>

<div>
Subscription
</div>

</div>

{/* ROWS */}

{sortedSellers.map(seller=>{

const stats = getStats(seller.id);

const isExpanded =
expanded===seller.id;

const currentData =
editing?.id===seller.id
?editing
:seller;

return(

<div
key={seller.id}
className="seller-row"
>

<div
className="table-row"
onClick={()=>{

setExpanded(
isExpanded
?null
:seller.id
);

setEditing(seller);

}}
>

<div>{seller.name}</div>

<div>{seller.storeName}</div>

<div>{seller.email}</div>

<div>{stats.orders}</div>

<div>₹{stats.revenue}</div>

<div className="profit">
₹{stats.profit}
</div>

<div>
{seller.subscription?.status || "N/A"}
</div>

</div>

{/* DETAILS */}

{isExpanded && (

<div className="seller-details">

{/* PERSONAL */}

<div className="details-card">

<h3>Personal Details</h3>

<label>Name</label>

<input
value={currentData.name || ""}
onChange={e=>
setEditing({
...currentData,
name:e.target.value
})
}
/>

<label>Email</label>

<input
value={currentData.email || ""}
onChange={e=>
setEditing({
...currentData,
email:e.target.value
})
}
/>

<label>Phone</label>

<input
value={currentData.phone || ""}
onChange={e=>
setEditing({
...currentData,
phone:e.target.value
})
}
/>

</div>

{/* STORE */}

<div className="details-card">

<h3>Store Details</h3>

<label>Store Name</label>

<input
value={currentData.storeName || ""}
onChange={e=>
setEditing({
...currentData,
storeName:e.target.value
})
}
/>

<label>Store Slug</label>

<input
value={currentData.storeSlug || ""}
onChange={e=>
setEditing({
...currentData,
storeSlug:e.target.value
})
}
/>

<label>Domain</label>

<input
value={currentData.storeDomain || ""}
onChange={e=>
setEditing({
...currentData,
storeDomain:e.target.value
})
}
/>

<label>Pricing Type</label>

<select
value={currentData.pricingKey || ""}
onChange={e=>
setEditing({
...currentData,
pricingKey:e.target.value
})
}
>

<option value="retail">Retail</option>
<option value="wholesale">Wholesale</option>
<option value="dealer">Dealer</option>
<option value="distributor">Distributor</option>
<option value="vip">VIP</option>
<option value="dropshipping">
Dropshipper
</option>

</select>

</div>

{/* SUBSCRIPTION */}

<div className="details-card">

<h3>Subscription Details</h3>

<label>Current Plan</label>

<input
value={
currentData.subscription?.currentPlan || ""
}
onChange={e=>
setEditing({
...currentData,

subscription:{
...(currentData.subscription || {}),
currentPlan:e.target.value
}
})
}
/>

<label>Start Date</label>

<input
type="date"
value={
currentData.subscription?.startDate || ""
}
onChange={e=>
setEditing({
...currentData,

subscription:{
...(currentData.subscription || {}),
startDate:e.target.value
}
})
}
/>

<label>End Date</label>

<input
type="date"
value={
currentData.subscription?.endDate || ""
}
onChange={e=>
setEditing({
...currentData,

subscription:{
...(currentData.subscription || {}),
endDate:e.target.value
}
})
}
/>

<label>Total Amount</label>

<input
type="number"
value={
currentData.subscription?.totalAmount || ""
}
onChange={e=>
setEditing({
...currentData,

subscription:{
...(currentData.subscription || {}),
totalAmount:e.target.value
}
})
}
/>

<label>Status</label>

<select
value={
currentData.subscription?.status || "active"
}
onChange={e=>
setEditing({
...currentData,

subscription:{
...(currentData.subscription || {}),
status:e.target.value
}
})
}
>

<option value="active">Active</option>
<option value="expired">Expired</option>
<option value="pending">Pending</option>
<option value="cancelled">Cancelled</option>

</select>

<div className="subscription-summary">

<h4>
Paid:
₹{getTotalPaid(currentData)}
</h4>

<h4>
Remaining:
₹{getRemainingAmount(currentData)}
</h4>

</div>

</div>

{/* PAYMENTS */}

<div className="details-card">

<h3>Payment History</h3>

<div className="payment-add">

<input
type="number"
placeholder="Amount"
value={
newPayment[seller.id]?.amount || ""
}
onChange={e=>
setNewPayment({
...newPayment,

[seller.id]:{
...newPayment[seller.id],
amount:e.target.value
}
})
}
/>

<input
type="date"
value={
newPayment[seller.id]?.paidDate || ""
}
onChange={e=>
setNewPayment({
...newPayment,

[seller.id]:{
...newPayment[seller.id],
paidDate:e.target.value
}
})
}
/>

<input
placeholder="Method"
value={
newPayment[seller.id]?.method || ""
}
onChange={e=>
setNewPayment({
...newPayment,

[seller.id]:{
...newPayment[seller.id],
method:e.target.value
}
})
}
/>

<input
placeholder="Note"
value={
newPayment[seller.id]?.note || ""
}
onChange={e=>
setNewPayment({
...newPayment,

[seller.id]:{
...newPayment[seller.id],
note:e.target.value
}
})
}
/>

<button
onClick={()=>
addPayment(currentData)
}
>
Add Payment
</button>

</div>

<div className="payments-list">

{(
currentData.subscription?.payments || []
).map((payment,index)=>(

<div
key={index}
className="payment-item"
>

<div>
₹{payment.amount}
</div>

<div>
{payment.paidDate}
</div>

<div>
{payment.method}
</div>

<div>
{payment.note}
</div>

</div>

))}

</div>

</div>

{/* SAVE */}

<div className="save-area">

<button onClick={saveSeller}>
Save Changes
</button>

</div>

</div>

)}

</div>

);

})}

</div>

</div>

);

};

export default AdminSellers;