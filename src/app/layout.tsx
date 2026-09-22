import type { Metadata, Viewport } from "next";
import ThemeToggle from "@/components/ThemeToggle";
import TitleMarquee from "@/components/TitleMarquee";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

/**
 * Runs before the first paint, so the page is never drawn in one palette and
 * then repainted in the other. Falls back to the operating system's setting
 * until the reader chooses for themselves.
 */
const THEME_BOOTSTRAP = `
(function () {
  try {
    var saved = localStorage.getItem("classroom-theme");
    var dark = saved
      ? saved === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    if (dark) {
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", "#10141b");
    }
  } catch (e) {
    document.documentElement.dataset.theme = "light";
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        {children}
        <ThemeToggle />
        <TitleMarquee text={SITE_NAME} />
      </body>
    </html>
  );
}
