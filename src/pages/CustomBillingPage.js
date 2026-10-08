import React, { useEffect, useState } from "react";
import { collection, getDocs, addDoc, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./CustomBillingPage.css";
const CustomBillingPage = () => {

    const [products, setProducts] = useState([]);
    const [search, setSearch] = useState("");
    const [showDropdown, setShowDropdown] = useState(false);
const [invoiceNo, setInvoiceNo] = useState("");
    const [role,setRole] = useState("retailer");

    const [items, setItems] = useState([]);

    const [currentItem, setCurrentItem] = useState({
        productName: "",
        qty: 1,
        rate: 0,
        purchaseRate: 0
    });

    const [customerName, setCustomerName] = useState("");
    const [customerGST, setCustomerGST] = useState("");
    const [customerAddress, setCustomerAddress] = useState("");

    const [applyGST, setApplyGST] = useState(false);

    const [showProductForm, setShowProductForm] = useState(false);

 const [newProduct,setNewProduct] = useState({
productName:"",
purchaseRate:0,
retailer:0,
wholesaler:0,
distributor:0,
dealer:0,
vip:0,
dropshipping:0
});

    const GST_RATE = 3;


    /* LOAD PRODUCTS */

    const loadProducts = async () => {

        const snap = await getDocs(collection(db, "customProducts"));

        const list = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        setProducts(list);

    };
    const generateInvoiceNumber = async () => {

  const snap = await getDocs(collection(db, "customOrders"));

  let max = 0;

  snap.docs.forEach(doc => {

    const data = doc.data();

    if (data.invoiceNo) {

      const num = parseInt(data.invoiceNo.split("/")[1]);

      if (num > max) max = num;

    }

  });

  const next = max + 1;

  const newInvoice = `GB/${next}`;

  setInvoiceNo(newInvoice);

};

    useEffect(() => {
        loadProducts();
        generateInvoiceNumber();
    }, []);



    /* AUTOSUGGEST */

    const filteredProducts = products
        .filter(p =>
            p.productName?.toLowerCase().includes(search.toLowerCase())
        )
        .sort((a, b) => {

            const aStarts = a.productName.toLowerCase().startsWith(search.toLowerCase());
            const bStarts = b.productName.toLowerCase().startsWith(search.toLowerCase());

            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;

            return a.productName.localeCompare(b.productName);

        });



    /* SELECT PRODUCT */

    const selectProduct = (product) => {

        const rolePrice = product.prices?.[role] || 0;

        setCurrentItem({
            productId: product.id,
            productName: product.productName,
            qty: 1,
            rate: rolePrice,
            purchaseRate: product.purchaseRate || 0
        });

        setSearch(product.productName);
        setShowDropdown(false);

    };



    /* ADD ITEM */

    const addItem = () => {

        if (!currentItem.productName) return;

        const total = currentItem.qty * currentItem.rate;
const profit = (currentItem.rate - currentItem.purchaseRate) * currentItem.qty;

        setItems(prev => [
            ...prev,
            {
                productId: currentItem.productId,
                productName: currentItem.productName,
                qty: currentItem.qty,
                rate: currentItem.rate,
                purchaseRate: currentItem.purchaseRate,
                total,
                   profit
            }
        ]);

        setCurrentItem({
            productName: "",
            qty: 1,
            rate: 0,
            purchaseRate: 0
        });

        setSearch("");

    };



    /* SAVE PRODUCT */

    const saveProduct = async () => {

        if (!newProduct.productName) return;

        const ref = await addDoc(collection(db, "customProducts"), {

            productName: newProduct.productName,

            purchaseRate: newProduct.purchaseRate,

            prices:{
retailer:newProduct.retailer,
wholesaler:newProduct.wholesaler,
distributor:newProduct.distributor,
dealer:newProduct.dealer,
vip:newProduct.vip,
dropshipping:newProduct.dropshipping
},

            createdAt: Timestamp.now()

        });

        setProducts(prev => [
            ...prev,
            {
                id: ref.id,
                productName: newProduct.productName,
                purchaseRate: newProduct.purchaseRate,
                prices:{
retailer:newProduct.retailer,
wholesaler:newProduct.wholesaler,
distributor:newProduct.distributor,
dealer:newProduct.dealer,
vip:newProduct.vip,
dropshipping:newProduct.dropshipping
}
            }
        ]);

      setNewProduct({
productName:"",
purchaseRate:0,
retailer:0,
wholesaler:0,
distributor:0,
dealer:0,
vip:0,
dropshipping:0
});

        setShowProductForm(false);

    };
 const generatePDF = () => {

  const doc = new jsPDF();

  const today = new Date().toLocaleDateString("en-GB");

  doc.setFontSize(20);

  doc.setFontSize(11);
  doc.text("M/s: TANTISHKA ENTERPRISES", 14, 30);
  doc.text("Shop No 1, Xion Mall, Behind D-Mart", 14, 36);
  doc.text("Hinjewadi Phase 1, Hinjewadi", 14, 42);
  doc.text("GSTIN : 27CRAPA0906N1Z0", 14, 46);

  doc.text(`Customer Name : ${customerName}`, 14, 55);
  doc.text(`GSTIN : ${customerGST}`, 14, 61);
  doc.text(`Address : ${customerAddress}`, 14, 67);

  doc.text(`Invoice No : ${invoiceNo}`, 150, 55);
  doc.text(`Date : ${today}`, 150, 61);

  const tableRows = items.map((item, index) => [
    index + 1,
    item.productName,
    item.qty,
    item.rate,
    item.total
  ]);

  autoTable(doc, {
    startY: 75,
    head: [["Sr", "Particulars", "Qty", "Rate", "Amount"]],
    body: tableRows
  });

  const finalY = doc.lastAutoTable.finalY + 10;

  const totalQty = items.reduce((sum, i) => sum + i.qty, 0);

  doc.text(`Total Qty : ${totalQty}`, 14, finalY);
  doc.text(`Subtotal : ${subtotal}`, 140, finalY);
  doc.text(`GST : ${gstAmount.toFixed(2)}`, 140, finalY + 6);

  doc.setFontSize(12);
  doc.text(`Grand Total : ${grandTotal.toFixed(2)}`, 140, finalY + 14);

  doc.text("KYU ZYU", 90, finalY + 30);
  doc.text("Authorised Signatory", 150, finalY + 40);

  doc.save(`Invoice-${invoiceNo}.pdf`);
};


    /* REMOVE ITEM */

    const removeItem = (index) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };



    /* TOTALS */

    const subtotal = items.reduce((sum, i) => sum + i.total, 0);
    const gstAmount = applyGST ? subtotal * (GST_RATE / 100) : 0;
    const grandTotal = subtotal + gstAmount;
    const totalProfit = items.reduce((sum, i) => sum + (i.profit || 0), 0);



    /* SAVE ORDER */

    const saveOrder = async () => {

        await addDoc(collection(db, "customOrders"), {
  invoiceNo,

            customerName,
            customerGST,
            customerAddress,

            role,

            items,

            subtotal,
            gstAmount,
            grandTotal,

            createdAt: Timestamp.now(),
              totalProfit,

        });

        alert("Order Saved");

        setItems([]);
        setCustomerName("");
        setCustomerGST("");
        setCustomerAddress("");
        setApplyGST(false);

    };



    return (

        <div className="cbp-container">

            <h2 className="cbp-title">Custom Billing</h2>

            {/* CUSTOMER + SUMMARY */}

            <div className="cbp-top-grid">

                {/* CUSTOMER CARD */}

                <div className="cbp-card">

                    <h3 className="cbp-card-title">Customer Details</h3>

                    <div className="cbp-field">
                        <label>Customer Role</label>
                        <select
                            className="cbp-input"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                        >
                           <option value="retailer">Retailer</option>
<option value="wholesaler">Wholesaler</option>
<option value="distributor">Distributor</option>
<option value="dealer">Dealer</option>
<option value="vip">VIP</option>
<option value="dropshipping">Dropshipping</option>
                        </select>
                    </div>

                    <div className="cbp-field">
                        <label>Customer Name</label>
                        <input
                            className="cbp-input"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                        />
                    </div>

                    <div className="cbp-field">
                        <label>Customer GSTIN</label>
                        <input
                            className="cbp-input"
                            value={customerGST}
                            onChange={(e) => setCustomerGST(e.target.value)}
                        />
                    </div>

                    <div className="cbp-field">
                        <label>Customer Address</label>
                        <input
                            className="cbp-input"
                            value={customerAddress}
                            onChange={(e) => setCustomerAddress(e.target.value)}
                        />
                    </div>

                </div>


                {/* SUMMARY CARD */}

                <div className="cbp-card">

                    <h3 className="cbp-card-title">Invoice Summary</h3>

                    <div className="cbp-summary-row">
                        <span>Subtotal</span>
                        <span>{subtotal}</span>
                    </div>

                    <div className="cbp-summary-row">
                        <span>GST</span>
                        <span>{gstAmount.toFixed(2)}</span>
                    </div>

                    <div className="cbp-summary-row cbp-grand">
                        <span>Grand Total</span>
                        <span>{grandTotal.toFixed(2)}</span>
                    </div>

                    <label className="cbp-gst-toggle">
                        <input
                            type="checkbox"
                            checked={applyGST}
                            onChange={(e) => setApplyGST(e.target.checked)}
                        />
                        Apply GST (18%)
                    </label>

                </div>

            </div>
            <div style={{marginBottom:"20px"}}>
<button
className="cbp-btn"
onClick={()=>setShowProductForm(true)}
>
+ Add New Product
</button>
</div>
          {showProductForm && (

<div className="cbp-card" style={{marginBottom:"20px"}}>

<h3 className="cbp-card-title">Add New Product</h3>

<div className="cbp-product-form-grid">

<div className="cbp-field">
<label>Product Name</label>
<input
className="cbp-input"
value={newProduct.productName}
onChange={(e)=>setNewProduct({...newProduct,productName:e.target.value})}
/>
</div>

<div className="cbp-field">
<label>Purchase Price</label>
<input
className="cbp-input"
type="number"
value={newProduct.purchaseRate}
onChange={(e)=>setNewProduct({...newProduct,purchaseRate:Number(e.target.value)})}
/>
</div>

<div className="cbp-field">
<label>Retailer Price</label>
<input
className="cbp-input"
type="number"
value={newProduct.retailer}
onChange={(e)=>setNewProduct({...newProduct,retailer:Number(e.target.value)})}
/>
</div>

<div className="cbp-field">
<label>Wholesaler Price</label>
<input
className="cbp-input"
type="number"
value={newProduct.wholesaler}
onChange={(e)=>setNewProduct({...newProduct,wholesaler:Number(e.target.value)})}
/>
</div>

<div className="cbp-field">
<label>Distributor Price</label>
<input
className="cbp-input"
type="number"
value={newProduct.distributor}
onChange={(e)=>setNewProduct({...newProduct,distributor:Number(e.target.value)})}
/>
</div>

<div className="cbp-field">
<label>Dealer Price</label>
<input
className="cbp-input"
type="number"
value={newProduct.dealer}
onChange={(e)=>setNewProduct({...newProduct,dealer:Number(e.target.value)})}
/>
</div>

<div className="cbp-field">
<label>VIP Price</label>
<input
className="cbp-input"
type="number"
value={newProduct.vip}
onChange={(e)=>setNewProduct({...newProduct,vip:Number(e.target.value)})}
/>
</div>

<div className="cbp-field">
<label>Dropshipping Price</label>
<input
className="cbp-input"
type="number"
value={newProduct.dropshipping}
onChange={(e)=>setNewProduct({...newProduct,dropshipping:Number(e.target.value)})}
/>
</div>

</div>

<div style={{marginTop:"15px",display:"flex",gap:"10px"}}>

<button
className="cbp-btn"
onClick={saveProduct}
>
Save Product
</button>

<button
className="cbp-btn-secondary"
onClick={()=>setShowProductForm(false)}
>
Cancel
</button>

</div>

</div>

)}


            {/* PRODUCT ENTRY */}

            <div className="cbp-card">

                <h3 className="cbp-card-title">Add Product</h3>
                

                <div className="cbp-product-row">

                    <div className="cbp-product-search">

                        <label>Product</label>

                        <div className="cbp-search-wrapper">

                            <input
                                className="cbp-input"
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setCurrentItem({ ...currentItem, productName: e.target.value });
                                    setShowDropdown(true);
                                }}
                                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        addItem();
                                    }
                                }}
                            />

                            {showDropdown && search && filteredProducts.length > 0 && (

                                <div className="cbp-dropdown">

                                    {filteredProducts.slice(0, 6).map(p => (

                                        <div
                                            key={p.id}
                                            className="cbp-dropdown-item"
                                            onMouseDown={() => selectProduct(p)}
                                        >
                                            {p.productName}
                                        </div>

                                    ))}

                                </div>

                            )}

                        </div>

                    </div>


                    <div className="cbp-field">
                        <label>Qty</label>
                        <input
                            className="cbp-input"
                            type="number"
                            value={currentItem.qty}
                            onChange={(e) => setCurrentItem({
                                ...currentItem,
                                qty: Number(e.target.value)
                            })}
                        />
                    </div>


                    <div className="cbp-field">
                        <label>Rate</label>
                        <input
                            className="cbp-input"
                            type="number"
                            value={currentItem.rate}
                            onChange={(e) => setCurrentItem({
                                ...currentItem,
                                rate: Number(e.target.value)
                            })}
                        />
                    </div>


                    <div className="cbp-field">
                        <label>Purchase</label>
                        <input
                            className="cbp-input cbp-readonly"
                            type="number"
                            value={currentItem.purchaseRate}
                            readOnly
                        />
                    </div>


                    <button className="cbp-btn" onClick={addItem}>
                        Add Item
                    </button>

                </div>

            </div>


            {/* INVOICE TABLE */}

            <div className="cbp-card">

                <h3 className="cbp-card-title">Invoice Items</h3>

                <table className="cbp-table">

                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Qty</th>
                            <th>Rate</th>
                            <th>Total</th>
                            <th></th>
                        </tr>
                    </thead>

                    <tbody>

                        {items.map((item, index) => (

                            <tr key={index}>

                                <td>{item.productName}</td>
                                <td>{item.qty}</td>
                                <td>{item.rate}</td>
                                <td>{item.total}</td>

                                <td>
                                    <button
                                        className="cbp-btn-danger"
                                        onClick={() => removeItem(index)}
                                    >
                                        Remove
                                    </button>
                                </td>

                            </tr>

                        ))}

                    </tbody>

                </table>

            </div>


            {/* ACTION BUTTONS */}

            <div className="cbp-actions">

                <button className="cbp-btn-secondary" onClick={generatePDF}>
                    Download PDF
                </button>

                <button className="cbp-btn" onClick={saveOrder}>
                    Save Order
                </button>

            </div>
  

        </div>

    );

};

export default CustomBillingPage;