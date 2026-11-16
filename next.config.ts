import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Los formularios de alta suben fotos (DNI, REPROCANN, indicación
      // médica) en el mismo envío; el límite por defecto es 1 MB.
      bodySizeLimit: '8mb',
    },
  },
};

export default nextConfig;
