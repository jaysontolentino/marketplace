import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Marketplace · Find your next favorite thing",
  description:
    "Buy and sell great finds in your neighborhood. Discover furniture, electronics, bikes, and more on Marketplace.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
