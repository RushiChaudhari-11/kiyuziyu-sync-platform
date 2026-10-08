import React, { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../../firebase";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./DropshipperSignup.css";

const DropshipperSignup = () => {

const [name,setName] = useState("");
const [email,setEmail] = useState("");
const [password,setPassword] = useState("");
const [storeSlug,setStoreSlug] = useState("");
const [storeDomain,setStoreDomain] = useState("");

const navigate = useNavigate();

const handleSignup = async(e)=>{

e.preventDefault();

try{

const res = await createUserWithEmailAndPassword(auth,email,password);

const uid = res.user.uid;

await setDoc(doc(db,"users",uid),{

name,
email,
role:"dropshipper",

storeSlug,
storeDomain,

createdAt:new Date()

});

navigate("/dropshipper/setup");

}catch(err){

alert(err.message);

}

};

return(

<div className="dropshipper-signup-wrapper">

<div className="dropshipper-signup-card">

<h2>Create Dropshipper Account</h2>

<p className="signup-subtitle">
Launch your own store in minutes
</p>

<form onSubmit={handleSignup}>

<input
type="text"
placeholder="Full Name"
value={name}
onChange={(e)=>setName(e.target.value)}
required
/>

<input
type="email"
placeholder="Email Address"
value={email}
onChange={(e)=>setEmail(e.target.value)}
required
/>

<input
type="password"
placeholder="Password"
value={password}
onChange={(e)=>setPassword(e.target.value)}
required
/>

<input
type="text"
placeholder="Store Slug (example: johnstore)"
value={storeSlug}
onChange={(e)=>setStoreSlug(e.target.value)}
required
/>

<input
type="text"
placeholder="Custom Domain (optional)"
value={storeDomain}
onChange={(e)=>setStoreDomain(e.target.value)}
/>

<button type="submit">
Create Dropshipper Account
</button>

</form>

<p className="login-text">

Already have an account?

<a href="/dropshipper/login">
Login here
</a>

</p>

</div>

</div>

)

}

export default DropshipperSignup;