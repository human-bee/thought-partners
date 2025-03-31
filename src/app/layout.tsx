import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { EnvInitializer } from "./EnvInitializer";
import { Providers } from "./providers";

// Metadata can only be exported from a Server Component
export const metadata: Metadata = {
  title: "Thought Partners - Collaborative Whiteboard",
  description: "A collaborative whiteboard application with video conferencing and AI capabilities",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// This is a Server Component
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <EnvInitializer />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
