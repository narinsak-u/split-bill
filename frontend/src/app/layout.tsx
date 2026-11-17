import type { Metadata } from "next";
import type { ReactNode } from "react";
import { QueryProvider } from "./providers";
import "./globals.css";

export const metadata: Metadata = { title: "SplitBill", description: "Browse shared expense groups" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><QueryProvider>{children}</QueryProvider></body></html>;
}
