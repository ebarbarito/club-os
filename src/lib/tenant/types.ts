export type TenantTheme = {
  primary: string;
  accent: string;
  dark: string;
  bg: string;
  // Identidad de marca propia para el sitio público (colores, tipografías y
  // texturas del manual de marca). Hoy solo 'greenlevel'. El panel interno
  // no la usa.
  marca?: string;
};

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  theme: TenantTheme;
  public_site_enabled: boolean;
};
