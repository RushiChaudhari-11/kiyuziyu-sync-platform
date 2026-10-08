import React,{createContext,useContext,useEffect,useState} from "react";
import {
getAuth,
createUserWithEmailAndPassword,
signInWithEmailAndPassword,
signOut,
onAuthStateChanged
} from "firebase/auth";

import { doc,setDoc,getDoc } from "firebase/firestore";
import { db } from "../../firebase";

const StoreAuthContext = createContext();

export const StoreAuthProvider = ({ children, sellerId }) => {

const auth = getAuth();

const [user,setUser] = useState(null);
const [loading,setLoading] = useState(true);

/* =========================
AUTH STATE
========================= */

useEffect(()=>{

const unsub = onAuthStateChanged(auth,(u)=>{
setUser(u);
setLoading(false);
});

return ()=>unsub();

},[]);

/* =========================
SIGNUP
========================= */

const signup = async(email,password,mobile)=>{

const cred = await createUserWithEmailAndPassword(
auth,
email,
password
);

await setDoc(
doc(db,"storeCustomers",sellerId,"customers",cred.user.uid),
{
email,
mobile,
sellerId,
createdAt:Date.now()
}
);

};

/* =========================
LOGIN
========================= */

const login = async(email,password)=>{

const cred = await signInWithEmailAndPassword(auth,email,password);

const customerRef = doc(
db,
"storeCustomers",
sellerId,
"customers",
cred.user.uid
);

const snap = await getDoc(customerRef);

if(!snap.exists()){
throw new Error("You are not registered in this store");
}

};

/* =========================
LOGOUT
========================= */

const logout = ()=>{
return signOut(auth);
};

return(

<StoreAuthContext.Provider
value={{
user,
signup,
login,
logout
}}

>

{!loading && children}

</StoreAuthContext.Provider>

);

};

export const useStoreAuth = ()=>{
return useContext(StoreAuthContext);
};
