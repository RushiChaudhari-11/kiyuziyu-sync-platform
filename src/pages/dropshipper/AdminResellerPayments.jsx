import React, { useEffect, useState, useMemo } from "react";
import {
collection,
query,
where,
orderBy,
getDocs,
addDoc,
serverTimestamp
} from "firebase/firestore";

import { db } from "../../firebase";
import { useAuth } from "../../components/AuthContext";

import "./DropshipperPayments.css";
import { useParams } from "react-router-dom";
const AdminResellerPayments = () => {
const { sellerId } = useParams();

const { currentUser } = useAuth();

const [orders,setOrders] = useState([]);
const [payments,setPayments] = useState([]);
const [loading,setLoading] = useState(true);
const getToday = () => {
  const d = new Date();
  return d.toISOString().split("T")[0];
};

const [fromDate, setFromDate] = useState(getToday);
const [toDate, setToDate] = useState(getToday);
const [search,setSearch] = useState("");
const [sortBy,setSortBy] = useState("date");

const [payAmount,setPayAmount] = useState("");
const [paying,setPaying] = useState(false);

/* ================= LOAD DATA ================= */

useEffect(()=>{

const loadOrders = async()=>{

if(!sellerId) return;

try{

/* LOAD ORDERS */

const ordersQuery = query(
collection(db,"storeOrders"),
where("sellerId","==",sellerId),
orderBy("createdAt","desc")
);

const ordersSnap = await getDocs(ordersQuery);

const ordersList = ordersSnap.docs.map(doc=>({
id:doc.id,
...doc.data()
}));

setOrders(ordersList);


/* LOAD PAYMENTS */

const paymentsQuery = query(
collection(db,"adminPayments"),
where("sellerId","==",sellerId)
);

const paymentsSnap = await getDocs(paymentsQuery);

const paymentsList = paymentsSnap.docs.map(doc=>({
id:doc.id,
...doc.data()
}));

setPayments(paymentsList);

}catch(err){
console.error("Dropshipper payments load error:",err);
}

setLoading(false);

};

loadOrders();

},[sellerId]);
/* ================= ORDER CALC ================= */

const calculateOrder = (order)=>{

let costTotal = 0;
let sellingTotal = 0;
let totalQty = 0;

(order.items || []).forEach(item=>{

const qty = item.quantity || 0;

costTotal += (item.costPrice || 0) * qty;
sellingTotal += (item.priceAtTimeOfOrder || 0) * qty;
totalQty += qty;

});

const profit = sellingTotal - costTotal;

const shipping = order.shippingFee || 0;

const payableToAdmin = costTotal + shipping;

return {
costTotal,
sellingTotal,
profit,
shipping,
payableToAdmin,
totalQty
};

};

/* ================= FILTER + SORT ================= */

const filteredOrders = useMemo(() => {

  let filtered = orders.filter(
    o => o.status !== "Cancelled"
  );

  /* ================= DATE FILTER ================= */

  if (fromDate || toDate) {

    filtered = filtered.filter(order => {

      if (!order.createdAt?.seconds) return false;

      const orderDate = new Date(
        order.createdAt.seconds * 1000
      );

      if (fromDate) {

        const from = new Date(fromDate);
        from.setHours(0, 0, 0, 0);

        if (orderDate < from) {
          return false;
        }

      }

      if (toDate) {

        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);

        if (orderDate > to) {
          return false;
        }

      }

      return true;

    });

  }

  /* ================= SEARCH ================= */

  if (search) {

    const s = search.toLowerCase();

    filtered = filtered.filter(
      o =>
        o.id.toLowerCase().includes(s) ||
        (o.billingInfo?.fullName || "")
          .toLowerCase()
          .includes(s)
    );

  }

  /* ================= SORT ================= */

  filtered = [...filtered];

  if (sortBy === "profit") {

    filtered.sort(
      (a, b) =>
        calculateOrder(b).profit -
        calculateOrder(a).profit
    );

  }

  if (sortBy === "payable") {

    filtered.sort(
      (a, b) =>
        calculateOrder(b).payableToAdmin -
        calculateOrder(a).payableToAdmin
    );

  }

  if (sortBy === "date") {

    filtered.sort(
      (a, b) =>
        (b.createdAt?.seconds || 0) -
        (a.createdAt?.seconds || 0)
    );

  }

  return filtered;

}, [
  orders,
  search,
  sortBy,
  fromDate,
  toDate
]);

/* ================= TOTAL SUMMARY ================= */

const totals = useMemo(()=>{

let totalCost = 0;
let totalSelling = 0;
let totalProfit = 0;
let totalShipping = 0;
let totalPayable = 0;

filteredOrders.forEach(order=>{

const calc = calculateOrder(order);

totalCost += calc.costTotal;
totalSelling += calc.sellingTotal;
totalProfit += calc.profit;
totalShipping += calc.shipping;
totalPayable += calc.payableToAdmin;

});

return {
totalCost,
totalSelling,
totalProfit,
totalShipping,
totalPayable
};

},[filteredOrders]);

/* ================= PAYMENTS ================= */

const totalPaid = payments.reduce(
(sum,p)=> sum + (p.amount || 0),
0
);

const pendingToAdmin = totals.totalPayable - totalPaid;

/* ================= PAY ADMIN ================= */

const payAdmin = async ()=>{

if(!payAmount || Number(payAmount) <= 0){
alert("Enter valid amount");
return;
}

if(Number(payAmount) > pendingToAdmin){
alert("Amount exceeds pending balance");
return;
}

try{

setPaying(true);

await addDoc(collection(db,"adminPayments"),{

sellerId: sellerId,
amount: Number(payAmount),
createdAt: serverTimestamp()

});

setPayments(prev=>[
...prev,
{
sellerId: sellerId,
amount: Number(payAmount)
}
]);

setPayAmount("");

alert("Payment recorded successfully");

}catch(err){
console.error(err);
alert("Payment failed");
}

setPaying(false);

};

/* ================= DATE ================= */

const formatDate = (timestamp)=>{
if(!timestamp) return "";
try{
return new Date(timestamp.seconds * 1000).toLocaleDateString();
}catch{
return "";
}
};

if(loading){
return <div className="payments-loading">Loading payments...</div>;
}

/* ================= UI ================= */

return(

<div className="dropshipper-payments">

<h1>Payments</h1>

{/* SEARCH + SORT */}

<div className="payments-controls">

<input
type="text"
placeholder="Search order or customer..."
value={search}
onChange={(e)=>setSearch(e.target.value)}
/>

<select
value={sortBy}
onChange={(e)=>setSortBy(e.target.value)}
>
<option value="date">Sort by Date</option>
<option value="profit">Sort by Profit</option>
<option value="payable">Sort by Payable</option>
</select>


</div>
<div className="date-range-filter">

  <div className="date-field">
    <label>From</label>
    <input
      type="date"
      value={fromDate}
      onChange={(e) => setFromDate(e.target.value)}
    />
  </div>

  <div className="date-field">
    <label>To</label>
    <input
      type="date"
      value={toDate}
      onChange={(e) => setToDate(e.target.value)}
    />
  </div>

</div>
<table className="payments-table">

<thead>
<tr>
<th>Order</th>
<th>Date</th>
<th>Customer</th>
<th>Status</th>
<th>Qty</th>
<th>Cost Total</th>
<th>Selling Total</th>
<th>Profit</th>
<th>Shipping</th>
<th>Payable to Admin</th>
</tr>
</thead>

<tbody>

{filteredOrders.map(order=>{

const calc = calculateOrder(order);

return(

<tr key={order.id}>

<td>#{order.id.slice(0,8)}</td>

<td>{formatDate(order.createdAt)}</td>

<td>{order.billingInfo?.fullName}</td>

<td>
<span className={`status status-${(order.status || "pending").toLowerCase()}`}>
{order.status || "Pending"}
</span>
</td>

<td>{calc.totalQty}</td>

<td>₹{calc.costTotal}</td>

<td>₹{calc.sellingTotal}</td>

<td className="profit">₹{calc.profit}</td>

<td>₹{calc.shipping}</td>

<td className="payable">₹{calc.payableToAdmin}</td>

</tr>

);

})}

</tbody>

</table>

{/* ================= TOTAL SUMMARY ================= */}

<div className="payments-summary">

<div>
<span>Total Cost</span>
<strong>₹{totals.totalCost}</strong>
</div>

<div>
<span>Total Selling</span>
<strong>₹{totals.totalSelling}</strong>
</div>

<div>
<span>Total Profit</span>
<strong className="profit">₹{totals.totalProfit}</strong>
</div>

<div>
<span>Total Shipping</span>
<strong>₹{totals.totalShipping}</strong>
</div>

<div>
<span>Payable To Admin</span>
<strong className="payable">₹{totals.totalPayable}</strong>
</div>

</div>

{/* ================= ADMIN PAYMENT ================= */}

<div className="admin-payment-box">

<h3>Pay Admin</h3>

<p><strong>Total Paid:</strong> ₹{totalPaid}</p>
<p><strong>Pending:</strong> ₹{pendingToAdmin}</p>

<div className="admin-payment-form">

<input
type="number"
placeholder="Enter amount"
value={payAmount}
onChange={(e)=>setPayAmount(e.target.value)}
/>

<button
className="pay-admin-btn"
onClick={payAdmin}
disabled={paying}
>
{paying ? "Processing..." : "Pay"}
</button>

</div>

</div>

<div className="payment-history">

  <h3>Payment History</h3>

  {payments.length === 0 ? (

    <div className="payment-history-empty">
      No payments yet
    </div>

  ) : (

    <div className="payment-history-grid">

      {payments
        .sort(
          (a,b)=>
            (b.createdAt?.seconds||0)-
            (a.createdAt?.seconds||0)
        )
        .map(payment=>(
          <div
            key={payment.id}
            className="payment-chip"
          >

            <div className="payment-chip-date">
              {formatDate(payment.createdAt)}
            </div>

            <div className="payment-chip-amount">
              ₹{payment.amount}
            </div>

            <div className="payment-chip-label">
              Payment
            </div>

          </div>
        ))}

    </div>

  )}

</div>

</div>

);

};

export default AdminResellerPayments;