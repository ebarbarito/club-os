import type { Metadata } from "next";
import { Archivo, Bebas_Neue, Hanken_Grotesk, Montserrat } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { getTenantBySlug } from "@/lib/tenant/get-tenant";
import { TenantThemeStyle } from "@/lib/tenant/theme";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Tipografías del manual de marca de Green Level (sitio público, ver
// .marca-greenlevel en globals.css): Montserrat para textos y Bebas Neue para
// títulos. El manual pide Norwester para títulos, pero no tiene tildes ni Ñ;
// Bebas Neue es la más parecida y es la que usa la propuesta de pacientes.
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const bebas = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Club OS",
  description: "Sistema de gestión para clubes",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerList = await headers();
  const slug = headerList.get('x-club-os-tenant-slug');
  const tenant = slug ? await getTenantBySlug(slug) : null;

  return (
    <html
      lang="es"
      className={`${archivo.variable} ${hanken.variable} ${montserrat.variable} ${bebas.variable} h-full antialiased`}
    >
      <head>
        {/* Aplica el tema guardado antes del primer render — evita el flash
            de fondo claro cuando el usuario eligió modo oscuro. */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#0a261b" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('club-os-theme')==='dark'){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}",
          }}
        />
        {tenant && <TenantThemeStyle theme={tenant.theme} />}
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
