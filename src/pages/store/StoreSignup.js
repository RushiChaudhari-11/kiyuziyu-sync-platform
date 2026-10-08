import React, { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useStoreAuth } from "./StoreAuthContext";
import "./StoreAuth.css";

const StoreSignup = () => {

    const { signup } = useStoreAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [mobile, setMobile] = useState("");
    const [error, setError] = useState("");

    const location = useLocation();
    const redirectTo = location.state?.redirectTo || "/";

    const handleSubmit = async (e) => {

        e.preventDefault();

        try {

            await signup(email, password, mobile);

            navigate(redirectTo);

        } catch (err) {

            setError(err.message);

        }

    };

    return (

        <div className="auth-container">

            <form onSubmit={handleSubmit}>

                <h2>Create Account</h2>

                {error && <p className="auth-error">{error}</p>}

                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                <input
                    type="tel"
                    placeholder="Mobile Number"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    required
                />

                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />

                <button type="submit">
                    Create Account
                </button>

                <p>
                    Already have an account?{" "}
                    <Link to="/store/login">Login</Link>
                </p>

            </form>

        </div>

    );

};

export default StoreSignup;