import React, { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useStoreAuth } from "./StoreAuthContext";
import "./StoreAuth.css";

const StoreLogin = () => {

    const { login } = useStoreAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const redirectTo = location.state?.redirectTo || "/";
    const handleSubmit = async (e) => {

        e.preventDefault();

        try {

            await login(email, password);
            window.fbq("track", "Login");

            navigate(redirectTo);

        } catch (err) {

            setError(err.message);

        }

    };

    return (

       <div className="auth-container">

<form onSubmit={handleSubmit}>

<h2>Login</h2>

{error && <p className="auth-error">{error}</p>}

<input
type="email"
placeholder="Email"
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
Login
</button>

<p>
Don't have an account? <Link to="/store/signup">Signup</Link>
</p>

</form>

</div>

    );

};

export default StoreLogin;
