import { Cinzel, Cormorant_Garamond } from "next/font/google";

/**
 * The classical theme's type. Cinzel is drawn from Roman inscriptional
 * capitals and is used only for fixed text such as the site name: it has no
 * lowercase, so it cannot show the difference between Turkish i and ı in a
 * student's name. Cormorant Garamond carries the headings and has the full
 * Turkish alphabet.
 *
 * `preload` is off while the theme is shown to admins only, so nobody else
 * downloads the files.
 */
export const inscription = Cinzel({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  display: "swap",
  preload: false,
  variable: "--font-inscription",
});

export const garamond = Cormorant_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
  variable: "--font-garamond",
});
