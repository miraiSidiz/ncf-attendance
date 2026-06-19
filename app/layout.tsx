import type { Metadata } from "next";
import "./globals.css";
import AppSessionProvider from "@/components/AppSessionProvider";

export const metadata: Metadata = {
  title: "QR Attendance System",
  description: "Student QR attendance management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AppSessionProvider>{children}</AppSessionProvider>
      </body>
    </html>
  );
}
