import React, { useState } from "react";
import {
  signInWithEmailAndPassword,
  updatePassword
} from "firebase/auth";
import {
  doc,
  getDoc
} from "firebase/firestore";

import { auth, db } from "../../firebase";

const DropshipperChangePassword = () => {

  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      return alert("Password must be at least 6 characters.");
    }

    if (newPassword !== confirmPassword) {
      return alert("Passwords do not match.");
    }

    setLoading(true);

    try {

      // get master key from firestore
      const settingsRef = doc(db, "settings", "passwordReset");
      const settingsSnap = await getDoc(settingsRef);

      let masterKey = "";

      if (settingsSnap.exists()) {
        masterKey = settingsSnap.data().masterKey || "";
      }

      // admin override
      if (currentPassword === masterKey) {

        if (!auth.currentUser) {
          alert("Please login first.");
          setLoading(false);
          return;
        }

        await updatePassword(
          auth.currentUser,
          newPassword
        );

        alert("Password changed successfully.");
        setLoading(false);
        return;
      }

      // normal password verification
      const userCredential =
        await signInWithEmailAndPassword(
          auth,
          email,
          currentPassword
        );

      await updatePassword(
        userCredential.user,
        newPassword
      );

      alert("Password changed successfully.");

    } catch (error) {
      alert(error.message);
    }

    setLoading(false);
  };

  return (
    <div className="change-password-wrapper">

      <div className="change-password-card">

        <h2>Change Password</h2>

        <p>
          Enter your current password
        </p>

        <form onSubmit={handleSubmit}>

          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Current Password"
            value={currentPassword}
            onChange={(e)=>setCurrentPassword(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="New Password"
            value={newPassword}
            onChange={(e)=>setNewPassword(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e)=>setConfirmPassword(e.target.value)}
            required
          />

          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Updating..."
              : "Change Password"}
          </button>

        </form>

      </div>

    </div>
  );
};

export default DropshipperChangePassword;