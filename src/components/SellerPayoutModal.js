import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

import "./SellerPayoutModal.css";

const SellerPayoutModal = ({ seller, pending, onClose }) => {

const [amount,setAmount] = useState(pending);
const [method,setMethod] = useState("UPI");
const [date,setDate] = useState("");
const [note,setNote] = useState("");
const [loading,setLoading] = useState(false);

const handleSubmit = async(e)=>{

e.preventDefault();

if(amount <= 0){
alert("Invalid amount");
return;
}

setLoading(true);

try{

await addDoc(
collection(db,"sellerPayouts"),
{
sellerId:seller.id,
sellerName:seller.name,
amount:Number(amount),
method,
date,
note,
createdAt:serverTimestamp()
}
);

alert("Payment recorded");

onClose();

}catch(err){

console.error(err);
alert("Payment failed");

}

setLoading(false);

};

return(

<div className="payout-modal-overlay">

<div className="payout-modal">

<h2>Pay Seller</h2>

<div className="seller-info">

<strong>{seller.name}</strong>

<p>Pending Amount: ₹{pending}</p>

</div>

<form onSubmit={handleSubmit}>

<label>Amount</label>

<input
type="number"
value={amount}
onChange={(e)=>setAmount(e.target.value)}
required
/>

<label>Date</label>

<input
type="date"
value={date}
onChange={(e)=>setDate(e.target.value)}
required
/>

<label>Payment Method</label>

<select
value={method}
onChange={(e)=>setMethod(e.target.value)}
>

<option>UPI</option>
<option>Bank Transfer</option>
<option>Cash</option>

</select>

<label>Notes</label>

<textarea
placeholder="Optional note"
value={note}
onChange={(e)=>setNote(e.target.value)}
/>

<div className="modal-actions">

<button
type="submit"
disabled={loading}
>

{loading ? "Processing..." : "Record Payment"}

</button>

<button
type="button"
onClick={onClose}
className="cancel-btn"
>
Cancel
</button>

</div>

</form>

</div>

</div>

);

};

export default SellerPayoutModal;