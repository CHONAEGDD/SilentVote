import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "SilentVote",
  description: "Privacy-preserving voting powered by FHE",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-void-950 text-sand-200 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

