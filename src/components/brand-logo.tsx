export function BrandLogo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <img
      src="/logo.svg"
      alt="Up Indoor"
      className={`rounded-xl object-cover shadow-glow ${className}`}
    />
  );
}
