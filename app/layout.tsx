import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Avyro",
  description: "Find clients faster. AI finds the opportunities, you close the deals.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
