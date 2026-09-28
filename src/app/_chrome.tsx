"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// The landing ("/") is full-bleed with its own nav/footer. Every other route
// gets the app container + top bar + ecosystem footer.
export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/") return <>{children}</>;
  return (
    <div className="container">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <Link href="/" className="brand"><span className="dot" />zcoops</Link>
        <Link href="/create" className="mono muted">+ new pool</Link>
      </div>
      {children}
      <footer className="eco">
        <span className="swatch g" /><span className="swatch b" />
        <span>Part of the Zcash ecosystem · aligned with ZecHub brand guidelines</span>
      </footer>
    </div>
  );
}
