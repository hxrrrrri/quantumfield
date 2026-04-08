import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "QuantumField — Universal Particle Simulator",
  description:
    "WebGPU-powered particle physics simulator with classical, quantum, relativistic mechanics and AI/ML visualizations.",
  keywords: ["particle simulator", "physics", "WebGPU", "quantum mechanics"],
  openGraph: {
    title: "QuantumField",
    description: "Universal Particle Simulator",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="bg-space-void text-particle-white antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}
