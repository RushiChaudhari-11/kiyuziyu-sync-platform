import "./topbar.css";

export default function Topbar() {
  return (
    <div className="topbar">

      <div className="topbar-marquee">

        <div className="topbar-track">
          <span>Wholsale Price</span>
          <span>•</span>
          <span>Anti-Tarnish-Jewelery</span>
          <span>•</span>

          <span>24*7 Support</span>
          <span>•</span>

          <span> Login To View Wholsale Price</span>
          <span>•</span>

          <span>Delivering Elegance Across India</span>
          <span>•</span>

          <span>Minimum Order Value 2500</span>
          <span>•</span>

          {/* DUPLICATE FOR SMOOTH LOOP */}
<span>Wholsale Price</span>
          <span>•</span>
          <span>Anti-Tarnish-Jewelery</span>
          <span>•</span>

          <span>24*7 Support</span>
          <span>•</span>

          <span>Login To View Wholsale Price</span>
          <span>•</span>

          <span>Delivering Elegance Across India</span>
          <span>•</span>

           <span>Minimum Order Value 2500</span>
          <span>•</span>

        </div>

      </div>

    </div>
  );
}