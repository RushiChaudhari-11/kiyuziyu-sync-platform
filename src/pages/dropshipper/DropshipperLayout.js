import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../components/AuthContext";
import "./DropshipperLayout.css";

const DropshipperLayout = () => {

const { currentUser } = useAuth();
const location = useLocation();

const isActive = (path) => {
return location.pathname.includes(path) ? "active-link" : "";
};

return (

<div className="dropshipper-layout">

{/* SIDEBAR */}

<aside className="dropshipper-sidebar">

<div className="sidebar-header">

<h2>Dropshipper</h2>

</div>

<div className="store-preview">

<p>Store URL</p>

<a
href={`/store/${currentUser?.storeSlug}`}
target="_blank"
rel="noreferrer"
>
{window.location.origin}/{currentUser?.storeSlug}
</a>

</div>

<nav className="sidebar-nav">

<Link
to="/dropshipper/dashboard"
className={isActive("dashboard")}
>
Dashboard
</Link>

<Link
to="/dropshipper/products"
className={isActive("products")}
>
My Products
</Link>

<Link
to="/dropshipper/orders"
className={isActive("orders")}
>
Orders
</Link>

<Link
  to="/dropshipper/homepage"
  className={isActive("homepage")}
>
  Homepage
</Link>
<Link
  to="/dropshipper/payments"
  className={isActive("payments")}
>
  Payment
</Link>
<Link
  to="/dropshipper/customers"
  className={isActive("payments")}
>
  Customers
</Link>
<Link
  to="/dropshipper/enquiries"
  className={isActive("enquiries")}
>
  Enquiries
</Link>

</nav>

</aside>

{/* MAIN CONTENT */}

<main className="dropshipper-content">

<div className="content-header">

<h1>Dropshipper Dashboard</h1>

</div>

<div className="content-body">

<Outlet />

</div>

</main>

</div>

);

};

export default DropshipperLayout;