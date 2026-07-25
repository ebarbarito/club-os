import type { TenantTheme } from './types';

// Server Component: pisa los tokens default de globals.css con la paleta
// del tenant. Se renderiza una vez en el <head>/<body> del layout, antes
// de cualquier contenido — nada de flash de tema incorrecto.
export function TenantThemeStyle({ theme }: { theme: TenantTheme }) {
  const vars = `
    --color-accent: ${theme.primary};
    --color-accent-deep: ${theme.primary};
    --color-gold: ${theme.accent};
    --color-amber: ${theme.accent};
    --color-green-900: ${theme.dark};
    --color-bg: ${theme.bg};
  `;
  return <style>{`:root { ${vars} }`}</style>;
}
