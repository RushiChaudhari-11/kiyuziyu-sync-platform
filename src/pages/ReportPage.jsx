import React, { useState, useEffect, useCallback, useMemo } from 'react'; // Added useMemo
import { useAuth } from '../components/AuthContext';
import { 
    db, 
    collection, 
    query, 
    getDocs, 
    orderBy,
    limit,
    startAfter,
    where
} from '../firebase'; 
import { FaSpinner, FaChartLine, FaCalendarDay, FaCalendarAlt, FaSearch, FaTimes } from 'react-icons/fa';
import './ReportPage.css'; 

// Increased batch size for faster loading on Load More (now scroll)
const ORDERS_PER_BATCH = 50; 

// --- UTILITY FUNCTION: Calculates profit for a single item ---
const calculateProfitForItem = (item, subcollectionsMap) => {
// ... (Function body remains unchanged)
    const subcollectionData = subcollectionsMap[item.subcollectionId];
    const purchaseRate = subcollectionData?.purchaseRate;

    if (!purchaseRate || !item.priceAtTimeOfOrder || !item.quantity) {
        return 0; 
    }

    const sellingPrice = parseFloat(item.priceAtTimeOfOrder);
    const costPrice = parseFloat(purchaseRate);
    const quantity = parseInt(item.quantity, 10);

    return (sellingPrice - costPrice) * quantity;
};

// --- ReportPage Component ---
const ReportPage = () => {
    const { currentUser } = useAuth();
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [error, setError] = useState(null);
    
    // Profit states
    const [totalGrossProfit, setTotalGrossProfit] = useState(0);
    const [todaysProfit, setTodaysProfit] = useState(0);
    const [thisMonthsProfit, setThisMonthsProfit] = useState(0);
    const [filteredRangeProfit, setFilteredRangeProfit] = useState(null); 

    // Date filter states
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    
    // 🔥 NEW STATE FOR SEARCH 🔥
    const [searchTerm, setSearchTerm] = useState('');
    
    // lastVisible stores the last DocumentSnapshot
    const [lastVisible, setLastVisible] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [subcollectionsMap, setSubcollectionsMap] = useState({});

    // Date boundaries for Today/Month calculation
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1); 

    // Helper flag to manage if the component is in the filter state
    const isFilterApplied = filterStartDate && filterEndDate;


    // 1. Fetch Subcollection Purchase Rates (Cost Data)
    // ... (useEffect remains unchanged)
    useEffect(() => {
        const fetchSubcollectionData = async () => {
            if (!currentUser) return; 
            
            try {
                const collectionsRef = collection(db, "collections");
                const collectionsSnapshot = await getDocs(collectionsRef);

                const tempSubcollectionsMap = {};
                for (const mainCollectionDoc of collectionsSnapshot.docs) {
                    const subcollectionsRef = collection(db, "collections", mainCollectionDoc.id, "subcollections");
                    const subcollectionsSnapshot = await getDocs(subcollectionsRef);

                    subcollectionsSnapshot.docs.forEach(subDoc => {
                        const data = subDoc.data();
                        if (data.purchaseRate) {
                            tempSubcollectionsMap[subDoc.id] = { 
                                purchaseRate: data.purchaseRate,
                                name: data.name
                            };
                        }
                    });
                }
                setSubcollectionsMap(tempSubcollectionsMap);

            } catch (err) {
                console.error("❌ ERROR: Subcollection fetch failed.", err);
                setError("FATAL ERROR: Failed to load required pricing data.");
            }
        };

        if (currentUser) {
            fetchSubcollectionData();
        }
    }, [currentUser]); 

    // 2. Fetch Historical Orders (Core Logic - UPDATED for range filter)
    const fetchOrders = useCallback(async (isLoadMore = false) => {
        if (!currentUser || Object.keys(subcollectionsMap).length === 0) {
            return; 
        } 

        const isFilterActive = filterStartDate && filterEndDate;
        // The search term will be applied on the client-side for simplicity, 
        // so it doesn't affect the Firebase query here.

        // --- State Resets for new Query ---
        if (!isLoadMore) {
            setIsLoading(true);
            setOrders([]);
            setLastVisible(null);
            setTotalGrossProfit(0);
            setTodaysProfit(0);
            setThisMonthsProfit(0);
            setFilteredRangeProfit(null);
            setHasMore(!isFilterActive); 
        } else {
            if (isFilterActive || !hasMore) {
                setIsFetchingMore(false);
                return;
            }
            setIsFetchingMore(true);
        }
        
        try {
            const ordersRef = collection(db, "orders"); 
            
            // 🚀 STEP 1: Define the base query constraints 
            let queryConstraints = [
                // 🛑 CRITICAL FIX: Use '>' range filter instead of '!='
                // This allows 'createdAt' to be the primary sort key.
                where('status', '>', 'Cancelled'), 
                
                // Now, orderBy('createdAt', 'desc') can be first!
                orderBy('createdAt', 'desc') 
            ];

            // 🚀 STEP 2: Apply Date Filters
            if (isFilterActive) {
                const startTimestamp = new Date(filterStartDate);
                const endTimestamp = new Date(filterEndDate);
                endTimestamp.setHours(23, 59, 59, 999); 

                queryConstraints = [
                    where('status', '>', 'Cancelled'),
                    where('createdAt', '>=', startTimestamp),
                    where('createdAt', '<=', endTimestamp),
                    // Sorting by createdAt desc works fine with the range filter on status
                    orderBy('createdAt', 'desc')
                ];
            } 
            
            // 🚀 STEP 3: Apply Pagination
            if (!isFilterActive && lastVisible) {
                // Now we only need the value of the PRIMARY sort key: createdAt
                const lastCreatedAt = lastVisible.data().createdAt;
                // Note: If you have multiple orders with the exact same millisecond timestamp, 
                // you would need another unique orderBy field (like ID) for tie-breaking.
                queryConstraints.push(startAfter(lastCreatedAt));
            }

            // 🚀 STEP 4: Apply limit for non-filtered queries
            if (!isFilterActive) {
                queryConstraints.push(limit(ORDERS_PER_BATCH));
            }

            const finalQuery = query(ordersRef, ...queryConstraints);

            const documentSnapshots = await getDocs(finalQuery);
            const fetchedOrders = documentSnapshots.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
            
            // --- PROFIT CALCULATION (Unchanged) ---
            let batchTotalProfit = 0;
            let batchTodaysProfit = 0;     
            let batchThisMonthsProfit = 0; 
            
            const ordersWithProfit = fetchedOrders.map(order => {
                let orderProfit = 0;
                order.items.forEach(item => {
                    const itemProfit = calculateProfitForItem(item, subcollectionsMap);
                    orderProfit += itemProfit;
                });
                batchTotalProfit += orderProfit;

                const orderDate = order.createdAt?.toDate();
                if (!isFilterActive && orderDate) { 
                    if (orderDate >= today) {
                        batchTodaysProfit += orderProfit;
                    }
                    if (orderDate >= startOfMonth) {
                        batchThisMonthsProfit += orderProfit;
                    }
                }

                return { ...order, orderProfit: orderProfit };
            });

            // --- State Updates ---
            setOrders(prev => isLoadMore ? [...prev, ...ordersWithProfit] : ordersWithProfit);
            
            if (isFilterActive) {
                setFilteredRangeProfit(batchTotalProfit);
            } else {
                setTotalGrossProfit(prev => prev + batchTotalProfit);
                setTodaysProfit(prev => isLoadMore ? prev + batchTodaysProfit : batchTodaysProfit);
                setThisMonthsProfit(prev => isLoadMore ? prev + batchThisMonthsProfit : batchThisMonthsProfit);

                // Pagination update
                if (documentSnapshots.docs.length < ORDERS_PER_BATCH) {
                    setHasMore(false);
                } else {
                    // Store the entire DocumentSnapshot for startAfter in the next call
                    setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
                    setHasMore(true);
                }
            }

        } catch (err) {
            console.error("❌ FATAL ERROR: Orders fetch failed.", err);
            // Index required for this query: status (ASC) and createdAt (DESC)
            setError("FATAL ERROR: Failed to load order data. Please ensure you have a composite index for **status** (ASC) and **createdAt** (DESC) fields.");
            setHasMore(false);
        } finally {
            setIsLoading(false);
            setIsFetchingMore(false);
        }
    }, [currentUser, subcollectionsMap, hasMore, lastVisible, filterStartDate, filterEndDate, today, startOfMonth]); 


    // 3. Effect to trigger fetch when subcollectionsMap is ready
    useEffect(() => {
        if (currentUser && Object.keys(subcollectionsMap).length > 0) {
            fetchOrders(false); // Initial load
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser, subcollectionsMap]); 

    
    // 4. 🔥 INFINITE SCROLL LOGIC 🔥
    // ... (useEffect remains unchanged)
    useEffect(() => {
        // Only attach listener if we are not in filtered mode and have more to load
        if (isFilterApplied || !hasMore || isLoading || isFetchingMore) {
            return;
        }

        const handleScroll = () => {
            // Check if user is near the bottom (e.g., within 200px of the bottom)
            const isNearBottom = (window.innerHeight + window.scrollY) >= (document.body.offsetHeight - 200);

            if (isNearBottom && !isFetchingMore) {
                fetchOrders(true);
            }
        };

        // Use a simple debounce technique to limit how often handleScroll runs
        let timeout;
        const debouncedHandleScroll = () => {
            clearTimeout(timeout);
            timeout = setTimeout(handleScroll, 100);
        };

        window.addEventListener('scroll', debouncedHandleScroll);
        
        // Cleanup the event listener when the component unmounts or dependencies change
        return () => window.removeEventListener('scroll', debouncedHandleScroll);
    // Dependencies must include state that affects the scroll logic
    }, [isFilterApplied, hasMore, isLoading, isFetchingMore, fetchOrders]);
    
    // 🔥 NEW: Filter orders by search term (Client-Side) 🔥
    const filteredOrders = useMemo(() => {
        if (!searchTerm) {
            return orders;
        }

        const lowerCaseSearchTerm = searchTerm.toLowerCase();

        return orders.filter(order => {
            // Check customer name
            const customerName = order.billingInfo?.fullName?.toLowerCase() || '';
            if (customerName.includes(lowerCaseSearchTerm)) {
                return true;
            }

            // Check order ID (partial match)
            if (order.id?.toLowerCase().includes(lowerCaseSearchTerm)) {
                return true;
            }
            
            // Add other fields to search here if needed (e.g., product names)
            return false;
        });
    }, [orders, searchTerm]);

    // --- Handlers (unchanged) ---
    const handleFilterClick = () => {
        if (filterStartDate && filterEndDate) {
            fetchOrders(false); 
        } else {
            alert("Please select both a start date and an end date.");
        }
    };

    const handleClearFilter = () => {
        setFilterStartDate('');
        setFilterEndDate('');
        setFilteredRangeProfit(null);
        fetchOrders(false); 
    };

    // 🔥 NEW: Clear Search Handler 🔥
    const handleClearSearch = () => {
        setSearchTerm('');
    };

    const isFilterDisplayActive = isFilterApplied && (filteredRangeProfit !== null);
    
    // --- RENDERING LOGIC (Updated to include search bar and use filteredOrders) ---
    if (!currentUser) {
        return <div className="report-page-container"><p className="error-message">Please log in to view this report.</p></div>;
    }
    
    if (error) {
         return <div className="report-page-container"><p className="error-message">{error}</p></div>;
    }

    if (isLoading && orders.length === 0) {
        return <div className="report-page-container loading-state">
            <FaSpinner className="loading-spinner" />
            <p>Loading sales and profit data...</p>
        </div>;
    }
    
    return (
        <div className="report-page-container">
            <h2 className="report-title"><FaChartLine /> Business Sales and Profit Report</h2>
            
            {/* --- Search and Date Filter Controls --- */}
            <div className="filter-controls">
                
                {/* 🔥 NEW SEARCH INPUT 🔥 */}
                <div className="search-bar-container">
                    <FaSearch className="search-icon" />
                    <input 
                        type="text" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by Customer Name or Order ID"
                        className="search-input"
                    />
                    {searchTerm && (
                        <button onClick={handleClearSearch} className="clear-search-btn">
                            <FaTimes />
                        </button>
                    )}
                </div>
                
                {/* Date Filters */}
                <input 
                    type="date" 
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    placeholder="Start Date"
                />
                <input 
                    type="date" 
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    placeholder="End Date"
                />
                <button onClick={handleFilterClick} className="filter-btn" disabled={!filterStartDate || !filterEndDate}>
                    <FaSearch /> Filter
                </button>
                {isFilterDisplayActive && (
                    <button onClick={handleClearFilter} className="clear-filter-btn">
                        <FaTimes /> Clear Filter
                    </button>
                )}
            </div>

            <div className="summary-cards-container">
            {/* ... (Summary Cards logic remains unchanged) */}
                {isFilterDisplayActive ? (
                    <div className="summary-card filtered-profit-card full-width">
                        <h3>Gross Profit for Date Range</h3>
                        <p className="summary-amount">₹{filteredRangeProfit?.toFixed(2) || '0.00'}</p>
                        <p className="note">({orders.length} orders from {filterStartDate} to {filterEndDate})</p>
                    </div>
                ) : (
                    <>
                        <div className="summary-card today-profit-card">
                            <h3><FaCalendarDay /> Today's Profit</h3>
                            <p className="summary-amount">₹{todaysProfit.toFixed(2)}</p>
                        </div>
                        <div className="summary-card month-profit-card">
                            <h3><FaCalendarAlt /> This Month's Profit</h3>
                            <p className="summary-amount">₹{thisMonthsProfit.toFixed(2)}</p>
                        </div>
                        <div className="summary-card total-profit-card">
                            <h3>Total Gross Profit (All Time)</h3>
                            <p className="summary-amount">₹{totalGrossProfit.toFixed(2)}</p>
                            <p className="note">(Based on {orders.length} loaded orders)</p>
                        </div>
                    </>
                )}
            </div>

            <div className="orders-report-list">
                <h3>
                    {isFilterDisplayActive ? 'Orders in Selected Range' : 'Recent Order History'}
                    {searchTerm && ` (Showing ${filteredOrders.length} search results)`}
                </h3>
                
                {filteredOrders.length === 0 && !isLoading ? (
                    <p className="no-orders-message">No orders found matching your criteria.</p>
                ) : (
                    <div className="report-table-wrapper">
                        <table className="report-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Order ID</th>
                                    <th>Customer Name</th>
                                    <th>Sale Amount</th>
                                    <th>Gross Profit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* 🔥 Use filteredOrders instead of orders here 🔥 */}
                                {filteredOrders.map((order) => (
                                    <tr key={order.id} className="order-row">
                                        <td>{order.createdAt?.toDate().toLocaleDateString() || 'N/A'}</td>
                                        <td>{order.id.substring(0, 8)}...</td>
                                        <td>{order.billingInfo?.fullName || 'N/A'}</td> 
                                        <td>₹{order.totalAmount.toFixed(2)}</td>
                                        <td className={order.orderProfit < 0 ? 'loss' : 'gain'}>
                                            ₹{order.orderProfit.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 🔥 LOADING INDICATOR FOR INFINITE SCROLL 🔥 */}
            {/* Only show Load More if NOT searching and not filtering by date range */}
            {isFetchingMore && !isFilterApplied && !searchTerm && (
              <div className="load-more-container">
                <FaSpinner className="loading-spinner-small" /> Loading more orders...
              </div>
            )}
            
            {/* End of List Message */}
            {!hasMore && orders.length > 0 && !isFilterApplied && !searchTerm && (
                <p className="end-of-list-message">End of the all-time report.</p>
            )}
            {(isFilterApplied || searchTerm) && filteredOrders.length > 0 && (
                <p className="end-of-list-message">End of the filtered report results.</p>
            )}

        </div>
    );
};

export default ReportPage;