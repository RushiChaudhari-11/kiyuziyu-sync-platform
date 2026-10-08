import "./ProductCardSkeleton.css";

export default function ProductCardSkeleton() {
  return (
    <div className="product-card skeleton">
      <div className="skeleton-image" />
      <div className="product-info">
        <div className="skeleton-text title" />
        <div className="skeleton-text code" />
        <div className="skeleton-text price" />
        <div className="skeleton-text small" />
      </div>
      <div className="skeleton-btn" />
    </div>
  );
}
