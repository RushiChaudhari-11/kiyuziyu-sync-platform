import React, {
    useEffect,
    useMemo,
    useState
} from "react";

import {
    collection,
    getDocs,
    query,
    where,
    orderBy
} from "firebase/firestore";

import { db } from "../../firebase";

import { useAuth }
from "../../components/AuthContext";

import "./DropshipperCustomers.css";

const DropshipperCustomers = () => {

    const { currentUser } = useAuth();

    const [customers,setCustomers] = useState([]);
    const [loading,setLoading] = useState(true);

    const [search,setSearch] = useState("");
    const [filter,setFilter] = useState("all");
    const [sortBy,setSortBy] = useState("latest");

    /* =========================
       LOAD DATA
    ========================= */

    useEffect(() => {

        const loadData = async () => {

            if(!currentUser) return;

            try {

                /* =====================
                   LOAD CUSTOMERS
                ===================== */

                const customersSnap =
                    await getDocs(
                        collection(
                            db,
                            "storeCustomers",
                            currentUser.uid,
                            "customers"
                        )
                    );

                const customersMap = {};

                customersSnap.docs.forEach(doc => {

                    customersMap[doc.id] = {

                        customerId: doc.id,

                        ...doc.data(),

                        totalOrders: 0,

                        totalSpent: 0,

                        orders: [],

                        lastOrderAt: 0

                    };

                });

                /* =====================
                   LOAD ORDERS
                ===================== */

                const ordersQuery = query(

                    collection(db,"storeOrders"),

                    where(
                        "sellerId",
                        "==",
                        currentUser.uid
                    ),

                    orderBy("createdAt","desc")

                );

                const ordersSnap =
                    await getDocs(ordersQuery);

                ordersSnap.docs.forEach(doc => {

                    const order = {
                        id: doc.id,
                        ...doc.data()
                    };

                    const customerId =
                        order.customerId;

                    if(customersMap[customerId]){

                        customersMap[
                            customerId
                        ].totalOrders += 1;

                        customersMap[
                            customerId
                        ].totalSpent += Number(
                            order.totalAmount || 0
                        );

                        customersMap[
                            customerId
                        ].orders.push(order);

                        customersMap[
                            customerId
                        ].lastOrderAt =
                            order.createdAt?.seconds || 0;

                        /* =====================
                           USE ORDER BILLING INFO
                        ===================== */

                        customersMap[
                            customerId
                        ].fullName =
                            order.billingInfo?.fullName || "";

                        customersMap[
                            customerId
                        ].phoneNumber =
                            order.billingInfo?.phoneNumber || "";

                        customersMap[
                            customerId
                        ].addressLine1 =
                            order.billingInfo?.addressLine1 || "";

                        customersMap[
                            customerId
                        ].city =
                            order.billingInfo?.city || "";

                        customersMap[
                            customerId
                        ].state =
                            order.billingInfo?.state || "";

                    }

                });

                setCustomers(
                    Object.values(customersMap)
                );

            } catch(err){

                console.error(err);

            }

            setLoading(false);

        };

        loadData();

    }, [currentUser]);

    /* =========================
       FILTER + SEARCH + SORT
    ========================= */

    const filteredCustomers = useMemo(() => {

        let list = [...customers];

        /* FILTERS */

        if(filter === "ordered"){

            list = list.filter(
                c => c.totalOrders > 0
            );

        }

        if(filter === "noorders"){

            list = list.filter(
                c => c.totalOrders === 0
            );

        }

        /* SEARCH */

        if(search){

            list = list.filter(c => {

                const text = `
                    ${c.fullName}
                    ${c.email}
                    ${c.phoneNumber}
                    ${c.city}
                `.toLowerCase();

                return text.includes(
                    search.toLowerCase()
                );

            });

        }

        /* SORTING */

        switch(sortBy){

            case "name":

                list.sort((a,b)=>
                    (a.fullName || "")
                    .localeCompare(
                        b.fullName || ""
                    )
                );

                break;

            case "orders":

                list.sort((a,b)=>
                    b.totalOrders -
                    a.totalOrders
                );

                break;

            case "spent":

                list.sort((a,b)=>
                    b.totalSpent -
                    a.totalSpent
                );

                break;
case "signupLatest":

  list.sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );

  break;
            case "latest":

            default:

                list.sort((a,b)=>
                    (b.lastOrderAt || 0) -
                    (a.lastOrderAt || 0)
                );

        }

        return list;

    }, [customers,search,filter,sortBy]);

    /* =========================
       SUMMARY
    ========================= */

    const totalCustomers =
        customers.length;

    const totalOrderingCustomers =
        customers.filter(
            c => c.totalOrders > 0
        ).length;

    const totalRevenue =
        customers.reduce(
            (sum,c)=>
                sum + c.totalSpent,
            0
        );

    /* =========================
       EXPORT CSV
    ========================= */

    const exportCustomersCSV = () => {

        const headers = [
            "Name",
            "Email",
            "Phone",
            "City",
            "State",
            "Orders",
            "Spent"
        ];

        const rows = filteredCustomers.map(c => [

            c.fullName || "",

            c.email || "",

            c.phoneNumber || "",

            c.city || "",

            c.state || "",

            c.totalOrders || 0,

            c.totalSpent || 0

        ]);

        const csvContent = [

            headers.join(","),

            ...rows.map(r => r.join(","))

        ].join("\n");

        const blob = new Blob(
            [csvContent],
            {
                type:"text/csv;charset=utf-8;"
            }
        );

        const url =
            URL.createObjectURL(blob);

        const link =
            document.createElement("a");

        link.href = url;

        link.setAttribute(
            "download",
            "customers.csv"
        );

        document.body.appendChild(link);

        link.click();

        document.body.removeChild(link);

    };

    /* =========================
       LOADING
    ========================= */

    if(loading){

        return (
            <div className="customers-loading">
                Loading customers...
            </div>
        );

    }

    return (

        <div className="customers-page">

            {/* =====================
               TOPBAR
            ===================== */}

            <div className="customers-topbar">

                <div>

                    <h1>
                        Customers
                    </h1>

                    <p>
                        Manage your customers
                    </p>

                </div>

            </div>

            {/* =====================
               SUMMARY
            ===================== */}

            <div className="customers-summary-grid">

                <div className="summary-card">

                    <span>
                        Total Customers
                    </span>

                    <h2>
                        {totalCustomers}
                    </h2>

                </div>

                <div className="summary-card">

                    <span>
                        Ordering Customers
                    </span>

                    <h2>
                        {totalOrderingCustomers}
                    </h2>

                </div>

               

            </div>

            {/* =====================
               TOOLBAR
            ===================== */}

            <div className="customers-toolbar">

                <input
                    type="text"
                    placeholder="Search customers..."
                    value={search}
                    onChange={(e)=>
                        setSearch(e.target.value)
                    }
                />

                <select
                    value={filter}
                    onChange={(e)=>
                        setFilter(e.target.value)
                    }
                >

                    <option value="all">
                        All Customers
                    </option>

                    <option value="ordered">
                        Ordered Customers
                    </option>

                    <option value="noorders">
                        No Orders
                    </option>

                </select>

                <select
                    value={sortBy}
                    onChange={(e)=>
                        setSortBy(e.target.value)
                    }
                >
                    

                    <option value="latest">
                        Latest Activity
                    </option>
                    <option value="signupLatest">
  Latest Signup
</option>

                    <option value="name">
                        Name
                    </option>

                    <option value="orders">
                        Most Orders
                    </option>

                    <option value="spent">
                        Highest Spending
                    </option>

                </select>

                <button
                    className="export-btn"
                    onClick={exportCustomersCSV}
                >

                    Export CSV

                </button>

            </div>

            {/* =====================
               TABLE
            ===================== */}

            <div className="customers-table-wrapper">

                <table className="customers-table">

                    <thead>

                        <tr>

                            <th>Customer</th>

                            <th>Phone</th>

                            <th>Location</th>

                            <th>Orders</th>

                            <th>Total Spent</th>

                            <th>Status</th>
                            <th>Signup Date</th>

                        </tr>

                    </thead>

                    <tbody>

                        {filteredCustomers.map(customer => (

                            <tr
                                key={customer.customerId}
                            >

                                <td>

                                    <div className="customer-user">

                                        <div className="customer-avatar">

                                            {
                                                (
                                                    customer.fullName ||
                                                    customer.email ||
                                                    "U"
                                                )
                                                .charAt(0)
                                                .toUpperCase()
                                            }

                                        </div>

                                        <div>

                                            <div className="customer-name">

                                                {
                                                    customer.fullName ||
                                                    "Unnamed Customer"
                                                }

                                            </div>

                                            <div className="customer-email">

                                                {customer.email}

                                            </div>

                                        </div>

                                    </div>

                                </td>

                               <td>
  {customer.phoneNumber || customer.mobile}

  {customer.phoneNumber &&
   customer.mobile &&
   customer.phoneNumber !== customer.mobile && (
    <div style={{fontSize:"12px",color:"#666"}}>
      Signup: {customer.mobile}
    </div>
  )}
</td>

                                <td>

                                    {customer.city || "-"}

                                    {customer.state &&
                                        `, ${customer.state}`
                                    }

                                </td>

                                <td>

                                    {customer.totalOrders}

                                </td>

                                <td>

                                    ₹{
                                        customer.totalSpent
                                        .toLocaleString()
                                    }

                                </td>

                                <td>

                                    {customer.totalOrders > 0 ? (

                                        <span className="status-active">
                                            Active
                                        </span>

                                    ) : (

                                        <span className="status-inactive">
                                            No Orders
                                        </span>

                                    )}

                                </td>
                                <td>
  {customer.createdAt
    ? new Date(customer.createdAt).toLocaleDateString()
    : "-"}
</td>

                            </tr>

                        ))}

                    </tbody>

                </table>

            </div>

        </div>

    );

};

export default DropshipperCustomers;