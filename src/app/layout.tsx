import type { Metadata } from "next";
import { Space_Grotesk, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
  weight: ["300", "400", "500", "600"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "QUANTUM_FIELD | Celestial Observer",
  description:
    "A physics-aware spatial particle simulation environment. Observe the fundamental fabric of reality through classical, quantum, relativistic, and speculative physics engines.",
  keywords: ["particle simulator", "physics", "WebGPU", "quantum mechanics", "celestial observer"],
  openGraph: {
    title: "QUANTUM_FIELD — Celestial Observer",
    description: "Physics-aware particle simulation — engineered for 2070.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`dark ${spaceGrotesk.variable} ${manrope.variable} ${jetbrains.variable}`}
    >
      <body
        style={{
          background: "var(--void)",
          color: "var(--text)",
          fontFamily: "var(--font-manrope), Manrope, sans-serif",
          overflow: "hidden",
          height: "100vh",
          width: "100vw",
        }}
      >
        {children}
      </body>
    </html>
  );
}
