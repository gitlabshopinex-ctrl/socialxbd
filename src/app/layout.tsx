import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import UIProvider from "@/components/UIProvider";
import AppShell from "@/components/AppShell";
import MobileNav from "@/components/MobileNav";

export const metadata: Metadata = {
  title: "SocialX - Make Your Day",
  description:
    "SocialX is a short-video destination for dance, food, nature, fitness and more. Watch, create and share vertical videos.",
  icons: { icon: "/logo.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

// Day/night for the profile theme follows Bangladesh Standard Time (UTC+6).
// Runs before paint so there is no flash of the wrong theme.
const themeScript = `(function(){try{var h=new Date().getUTCHours()+6;if(h>=24)h-=24;var t=(h>=6&&h<18)?"light":"dark";var el=document.documentElement;el.setAttribute("data-theme",t);el.style.colorScheme=t;}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <UIProvider>
          <AppShell>{children}</AppShell>
          <MobileNav />
        </UIProvider>
      </body>
    </html>
  );
}