import React,{useState} from "react";
import { useAuth } from "../../components/AuthContext";
import { db } from "../../firebase";
import { doc,updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const DropshipperSetup = ()=>{

const { currentUser } = useAuth();

const [storeName,setStoreName] = useState("");
const [storeSlug,setStoreSlug] = useState("");
const [phone,setPhone] = useState("");

const navigate = useNavigate();

const handleSubmit = async(e)=>{

e.preventDefault();

const userRef = doc(db,"users",currentUser.uid);

await updateDoc(userRef,{
storeName,
storeSlug,
phone
});

navigate("/dropshipper/dashboard");

};

return(

<div>

<h2>Setup Your Store</h2>

<form onSubmit={handleSubmit}>

<input
placeholder="Store Name"
value={storeName}
onChange={(e)=>setStoreName(e.target.value)}
required
/>

<input
placeholder="Store Slug (example: john-store)"
value={storeSlug}
onChange={(e)=>setStoreSlug(e.target.value)}
required
/>

<input
placeholder="Phone"
value={phone}
onChange={(e)=>setPhone(e.target.value)}
required
/>

<button type="submit">

Create Store

</button>

</form>

</div>

)

}

export default DropshipperSetup