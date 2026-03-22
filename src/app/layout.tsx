import type { Metadata } from "next";
import { Bebas_Neue, Outfit } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const bebasNeue = Bebas_Neue({
  weight: "400",
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MovieTracker - Never Miss a Release",
  description:
    "Get notified instantly when movie tickets become available on BookMyShow and District. Never miss a hyped movie release again.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${bebasNeue.variable} ${outfit.variable} font-sans antialiased`}
      >
        <TooltipProvider>
          {children}
        </TooltipProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#1a1a1f",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#f0f0f0",
            },
          }}
        />
      </body>
    </html>
  );
}
