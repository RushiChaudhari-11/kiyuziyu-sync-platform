import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";

const StoreCartContext = createContext();

export const getCartItemId = (product) => {

let id = product.productId || product.id;

if(product.variation){

const variationKey = Object.keys(product.variation)
.sort()
.map(key=>`${key}-${product.variation[key]}`)
.join("_");

id += "_" + variationKey;

}

return id;

};


export const StoreCartProvider = ({ children }) => {

/* =========================
LOAD CART FROM LOCAL STORAGE
========================= */

const [cart,setCart] = useState(()=>{

try{
const saved = localStorage.getItem("store_cart");
return saved ? JSON.parse(saved) : {};
}catch{
return {};
}

});

/* =========================
REALTIME LISTENERS
========================= */

const listenersRef = useRef({});

/* =========================
SAVE CART
========================= */

useEffect(()=>{
localStorage.setItem("store_cart",JSON.stringify(cart));
},[cart]);

/* =========================
RESTORE LISTENERS AFTER REFRESH
========================= */

useEffect(()=>{

Object.values(cart).forEach(item=>{
attachInventoryListener(item);
});

},[]);

/* =========================
CREATE CART ID
========================= */

/* =========================
ATTACH INVENTORY LISTENER
========================= */
const attachInventoryListener = (product)=>{

const pid = product.productId;

if(listenersRef.current[pid]) return;

const ref = doc(
db,
"collections",
product.collectionId,
"subcollections",
product.subcollectionId,
"products",
pid
);

const unsub = onSnapshot(ref,(snap)=>{

if(!snap.exists()) return;

const data = snap.data();

setCart(prev=>{

const updated = {...prev};

Object.keys(updated).forEach(id=>{

const item = updated[id];

if(item.productId !== pid) return;

let stock = 0;

/* =========================
VARIANT STOCK
========================= */

if(item.variation && data.variations){

const match = data.variations.find(v=>{

return Object.keys(item.variation).every(
key => v[key] === item.variation[key]
);

});

stock = match?.quantity ?? 0;

}else{

/* =========================
NORMAL PRODUCT
========================= */

stock = data.quantity ?? 0;

}

updated[id] = {
...item,
stock
};

if(item.quantity > stock){
updated[id].quantity = stock;
}

});

return updated;

});

});

listenersRef.current[pid] = unsub;

};
/* =========================
REMOVE LISTENER
========================= */

const removeInventoryListener = (productId)=>{

const unsub = listenersRef.current[productId];

if(unsub){

try{unsub();}catch{}

delete listenersRef.current[productId];

}

};

/* =========================
ADD TO CART
========================= */

const addToCart = (product)=>{

attachInventoryListener(product);

const cartId = getCartItemId(product);

setCart(prev=>{

const existing = prev[cartId];

const stock = existing?.stock ?? product.stock ?? Infinity;

if(existing){

if(existing.quantity >= stock) return prev;

return{
...prev,
[cartId]:{
...existing,
quantity: existing.quantity + 1
}
};

}

return{
...prev,
[cartId]:{
...product,
sellerId: product.sellerId ?? null,
shippingSettings:
product.shippingSettings ?? null,
cartId,
productId: product.productId || product.id,
quantity:1,
stock: product.stock ?? Infinity
}
};

});

};

/* =========================
REMOVE FROM CART
========================= */

const removeFromCart = (cartId)=>{

setCart(prev=>{

const item = prev[cartId];

if(!item) return prev;

if(item.quantity <= 1){

const copy = {...prev};

delete copy[cartId];

removeInventoryListener(item.productId);

return copy;

}

return{
...prev,
[cartId]:{
...item,
quantity:item.quantity - 1
}
};

});

};

/* =========================
SET QUANTITY
========================= */

const setQuantity = (cartId,qty)=>{

setCart(prev=>{

const item = prev[cartId];

if(!item) return prev;

const stock = item.stock ?? Infinity;

if(qty > stock) qty = stock;

if(qty <= 0){

const copy = {...prev};

delete copy[cartId];

removeInventoryListener(item.productId);

return copy;

}

return{
...prev,
[cartId]:{
...item,
quantity:qty
}
};

});

};

/* =========================
CLEAR CART
========================= */

const clearCart = ()=>{

Object.values(listenersRef.current).forEach(unsub=>{
try{unsub();}catch{}
});

listenersRef.current = {};

setCart({});

};

/* =========================
TOTAL ITEMS
========================= */

const cartItemsCount = Object.values(cart).reduce(
(sum,item)=> sum + item.quantity,
0
);

/* =========================
SUBCOLLECTION TOTAL
========================= */

const getSubcollectionQty = (subcollectionId)=>{

return Object.values(cart).reduce((sum,item)=>{

if(item.subcollectionId === subcollectionId){
return sum + item.quantity;
}

return sum;

},0);

};

/* =========================
CONTEXT VALUE
========================= */

const value={
cart,
addToCart,
removeFromCart,
setQuantity,
clearCart,
cartItemsCount,
getSubcollectionQty
};

return(
<StoreCartContext.Provider value={value}>
{children}
</StoreCartContext.Provider>
);

};

export const useStoreCart = ()=>useContext(StoreCartContext);