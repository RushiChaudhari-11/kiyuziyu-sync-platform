import React, { useEffect, useState } from "react";
import { collection, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import "./OrdersProductsPage.css";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const OrdersProductsPage = () => {

const [oppProducts,setOppProducts] = useState([]);
const [oppOrders,setOppOrders] = useState([]);
const [oppExpandedOrder,setOppExpandedOrder] = useState(null);
const [oppActiveTab,setOppActiveTab] = useState("products");

const [oppEditingProduct,setOppEditingProduct] = useState(null);
const [oppEditData,setOppEditData] = useState({});


/* LOAD DATA */

useEffect(()=>{

const loadOppData = async()=>{

const prodSnap = await getDocs(collection(db,"customProducts"));
const orderSnap = await getDocs(collection(db,"customOrders"));

setOppProducts(prodSnap.docs.map(d=>({id:d.id,...d.data()})));
setOppOrders(orderSnap.docs.map(d=>({id:d.id,...d.data()})));

};

loadOppData();

},[]);


/* ORDER TOGGLE */

const toggleOppOrder = (id)=>{
setOppExpandedOrder(oppExpandedOrder===id ? null : id);
};


/* DELETE PRODUCT */

const deleteOppProduct = async(id)=>{

if(!window.confirm("Delete this product?")) return;

await deleteDoc(doc(db,"customProducts",id));

setOppProducts(prev=>prev.filter(p=>p.id!==id));

};


/* EDIT PRODUCT */

const startEditProduct = (product)=>{

setOppEditingProduct(product.id);

setOppEditData({
productName:product.productName,
purchaseRate:product.purchaseRate,
...product.prices
});

};


/* SAVE PRODUCT */

const saveOppProduct = async(id)=>{

await updateDoc(doc(db,"customProducts",id),{

productName:oppEditData.productName,
purchaseRate:Number(oppEditData.purchaseRate),

prices:{
retailer:Number(oppEditData.retailer),
wholesaler:Number(oppEditData.wholesaler),
distributor:Number(oppEditData.distributor),
dealer:Number(oppEditData.dealer),
vip:Number(oppEditData.vip),
dropshipping:Number(oppEditData.dropshipping)
}

});

setOppProducts(prev=>
prev.map(p=>
p.id===id
?{
...p,
productName:oppEditData.productName,
purchaseRate:oppEditData.purchaseRate,
prices:{
retailer:oppEditData.retailer,
wholesaler:oppEditData.wholesaler,
distributor:oppEditData.distributor,
dealer:oppEditData.dealer,
vip:oppEditData.vip,
dropshipping:oppEditData.dropshipping
}
}
:p
)
);

setOppEditingProduct(null);

};

const oppViewInvoice = (order) => {

const doc = new jsPDF();

const today = new Date(order.createdAt?.seconds * 1000)
.toLocaleDateString("en-GB");

doc.setFontSize(20);


doc.setFontSize(11);
doc.text("M/s: TANTISHKA ENTERPRISES", 14, 30);
doc.text("Shop No 1, Xion Mall, Behind D-Mart", 14, 36);
doc.text("Hinjewadi Phase 1, Hinjewadi", 14, 42);
doc.text("GSTIN:27CRAPA0906N1Z0 ", 14, 48)

doc.text(`Customer Name : ${order.customerName}`, 14, 55);
doc.text(`GSTIN : ${order.customerGST}`, 14, 61);
doc.text(`Address : ${order.customerAddress}`, 14, 67);

doc.text(`Invoice No : ${order.invoiceNo}`, 150, 55);
doc.text(`Date : ${today}`, 150, 61);


/* TABLE */

const tableRows = order.items.map((item,index)=>[
index+1,
item.productName,
item.qty,
item.rate,
item.total
]);

autoTable(doc,{
startY:75,
head:[["Sr","Particulars","Qty","Rate","Amount"]],
body:tableRows
});


const finalY = doc.lastAutoTable.finalY + 10;

const totalQty = order.items.reduce((sum,i)=>sum+i.qty,0);

doc.text(`Total Qty : ${totalQty}`,14,finalY);
doc.text(`Subtotal : ${order.subtotal}`,140,finalY);
doc.text(`GST : ${order.gstAmount}`,140,finalY+6);

doc.setFontSize(12);
doc.text(`Grand Total : ${order.grandTotal}`,140,finalY+14);

doc.text("KYU ZYU",90,finalY+30);
doc.text("Authorised Signatory",150,finalY+40);


/* OPEN PDF */

window.open(doc.output("bloburl"));

};

return (

<div className="opp-page">

<h2 className="opp-title">Orders & Products</h2>


{/* TABS */}

<div className="opp-tabs">

<button
className={`opp-tab-btn ${oppActiveTab==="products" ? "opp-tab-active":""}`}
onClick={()=>setOppActiveTab("products")}
>
Products
</button>

<button
className={`opp-tab-btn ${oppActiveTab==="orders" ? "opp-tab-active":""}`}
onClick={()=>setOppActiveTab("orders")}
>
Orders
</button>

</div>



{/* PRODUCTS TAB */}

{oppActiveTab==="products" && (

<div className="opp-products-section">

<table className="opp-products-table">

<thead>

<tr>
<th>Name</th>
<th>Purchase</th>
<th>Retailer</th>
<th>Wholesaler</th>
<th>Distributor</th>
<th>Dealer</th>
<th>VIP</th>
<th>Dropship</th>
<th>Actions</th>
</tr>

</thead>

<tbody>

{oppProducts.map(p=>{

const editing = oppEditingProduct === p.id;

return(

<tr key={p.id}>

<td>
{editing ? (
<input
value={oppEditData.productName}
onChange={(e)=>setOppEditData({...oppEditData,productName:e.target.value})}
/>
):p.productName}
</td>


<td>
{editing ? (
<input
value={oppEditData.purchaseRate}
onChange={(e)=>setOppEditData({...oppEditData,purchaseRate:e.target.value})}
/>
):p.purchaseRate}
</td>


{["retailer","wholesaler","distributor","dealer","vip","dropshipping"].map(role=>(

<td key={role}>

{editing ? (

<input
value={oppEditData[role]}
onChange={(e)=>setOppEditData({...oppEditData,[role]:e.target.value})}
/>

):(p.prices?.[role] || 0)}

</td>

))}


<td>

{editing ? (

<>

<button
className="opp-save-btn"
onClick={()=>saveOppProduct(p.id)}
>
Save
</button>

<button
className="opp-cancel-btn"
onClick={()=>setOppEditingProduct(null)}
>
Cancel
</button>

</>

):( 

<>

<button
className="opp-edit-btn"
onClick={()=>startEditProduct(p)}
>
Edit
</button>

<button
className="opp-delete-btn"
onClick={()=>deleteOppProduct(p.id)}
>
Delete
</button>

</>

)}

</td>

</tr>

);

})}

</tbody>

</table>

</div>

)}



{/* ORDERS TAB */}

{oppActiveTab==="orders" && (

<div className="opp-orders-section">

<div className="opp-orders-list">

{oppOrders.map(order=>{

const isOpen = oppExpandedOrder === order.id;

return(

<div key={order.id} className="opp-order-card">

<div
className="opp-order-header"
onClick={()=>toggleOppOrder(order.id)}
>

<div>

<strong>{order.customerName}</strong>

<div className="opp-small-text">
Role: {order.role}
</div>

</div>

<div>

<div>Total ₹{order.grandTotal}</div>

<div className="opp-small-text">
GST ₹{order.gstAmount}
</div>
<div className="opp-small-text">
Profit ₹{order.totalProfit}
</div>
<button
className="opp-invoice-btn"
onClick={()=>oppViewInvoice(order)}
>
View Invoice
</button>

</div>

</div>


{isOpen && (

<div className="opp-order-items">

<table className="opp-items-table">

<thead>
<tr>
<th>Product</th>
<th>Qty</th>
<th>Rate</th>
<th>Total</th>
</tr>
</thead>

<tbody>

{order.items?.map((item,i)=>(
<tr key={i}>
<td>{item.productName}</td>
<td>{item.qty}</td>
<td>{item.rate}</td>
<td>{item.total}</td>
</tr>
))}

</tbody>

</table>

</div>

)}

</div>

);

})}

</div>

</div>

)}

</div>

);

};

export default OrdersProductsPage;