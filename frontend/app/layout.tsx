import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "RepoThief - Detect Stolen GitHub Repositories",
  description: "Expose fake GitHub profiles that steal repositories. Check repositories and profiles for suspicious activity.",
  keywords: ["github", "repository", "scam", "detection", "git", "open source"],
  icons: {
    icon: '/criminal-custody-icon.svg',
    shortcut: '/criminal-custody-icon.svg',
    apple: '/criminal-custody-icon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark">
      <body className={`${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
