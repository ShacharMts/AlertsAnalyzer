import type { NextConfig } from "next";

const now = new Date();
const startOfYear = new Date(now.getFullYear(), 0, 0);
const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
const minutes = now.getMinutes();
const BUILD_VERSION = `5.${dayOfYear}.${now.getHours()}${minutes < 10 ? "0" : ""}${minutes}`;

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_VERSION: BUILD_VERSION,
  },
};

export default nextConfig;
