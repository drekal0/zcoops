import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";

// Same type system as Zcash Builders: Instrument Serif (display) + Inter (UI)
// + JetBrains Mono (data/addresses), on the gold/dark scheme.
const serif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "zcoops — Zcash community claim pools",
  description: "Create a funded pool for your event and watch people claim, in real time.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>
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
      </body>
    </html>
  );
}
