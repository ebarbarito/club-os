import type { Metadata } from "next";
import { Archivo, Hanken_Grotesk } from "next/font/google";
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
      className={`${archivo.variable} ${hanken.variable} h-full antialiased`}
    >
      <head>{tenant && <TenantThemeStyle theme={tenant.theme} />}</head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
