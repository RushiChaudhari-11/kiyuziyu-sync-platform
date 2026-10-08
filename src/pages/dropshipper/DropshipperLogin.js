import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../../firebase";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./DropshipperLogin.css";

const DropshipperLogin = () => {

const [email,setEmail] = useState("");
const [password,setPassword] = useState("");

const navigate = useNavigate();

const handleLogin = async (e) => {
  e.preventDefault();

  try {
    const res = await signInWithEmailAndPassword(auth, email, password);

    const userRef = doc(db, "users", res.user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      alert("User profile not found");
      return;
    }

    const userData = userSnap.data();

    // role check
    if (userData.role !== "dropshipper") {
      alert("Not a dropshipper account");
      return;
    }

    // active check (only block if explicitly false)
    if (userData.isActive === false) {
      alert("Your account is disabled. Please contact support.");
      return;
    }

    if (!userData.storeSlug) {
      navigate("/dropshipper/setup");
    } else {
      navigate("/dropshipper/dashboard");
    }

  } catch (err) {
    alert(err.message);
  }
};

return(

<div className="dropshipper-login-wrapper">

<div className="dropshipper-login-card">

<h2>Dropshipper Login</h2>

<p className="login-subtitle">
Access your store dashboard
</p>

<form onSubmit={handleLogin}>

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

<button type="submit">
Login to Dashboard
</button>

</form>

<p className="signup-text">

Don't have an account?

<a href="/dropshipper/signup">
Create Dropshipper Account
</a>

</p>
<p className="forgot-password-link">
  <a href="/dropshipper/change-password">
    Change Password
  </a>
</p>

</div>

</div>

);

};

export default DropshipperLogin;