export type TenantTheme = {
  primary: string;
  accent: string;
  dark: string;
  bg: string;
};

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  theme: TenantTheme;
};
