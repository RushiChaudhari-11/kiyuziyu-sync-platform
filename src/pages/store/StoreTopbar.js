import "../../components/topbar.css";

export default function StoreTopbar({ data }) {

  const items = data?.items || [
    "Wholesale Price",
    "Anti-Tarnish Jewellery",
    "24*7 Support",
    "Login To View Wholesale Price",
    "Delivering Elegance Across India",
    "Minimum Order Value 2500"
  ];

  const loopItems = [...items, ...items];

  return (
    <div className="topbar">

      <div className="topbar-marquee">

        <div className="topbar-track">

          {loopItems.map((item, index) => (
            <span key={index}>
              {item}
              <span> • </span>
            </span>
          ))}

        </div>

      </div>

    </div>
  );
}