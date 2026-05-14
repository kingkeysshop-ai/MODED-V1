const checkEnvVariables = require("./check-env-variables")

if (process.env.NEXT_PHASE !== "phase-export") {
  checkEnvVariables()
}

const S3_HOSTNAME = process.env.MEDUSA_CLOUD_S3_HOSTNAME
const S3_PATHNAME = process.env.MEDUSA_CLOUD_S3_PATHNAME
  ? `${process.env.MEDUSA_CLOUD_S3_PATHNAME}/**`
  : undefined

const isDev = process.env.NODE_ENV === "development"

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  transpilePackages: [
    "@medusajs/ui",
    "@medusajs/icons",
    "@radix-ui/react-popover",
    "react-remove-scroll",
    "react-remove-scroll-bar",
    "react-style-singleton",
    "copy-to-clipboard",
  ],

  logging: {
    fetches: {
      fullUrl: isDev,
    },
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    remotePatterns: [
      ...(isDev ? [{ protocol: "http", hostname: "localhost" }] : []),
      {
        protocol: "https",
        hostname: "medusa-public-images.s3.eu-west-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.us-east-1.amazonaws.com",
      },
      ...(S3_HOSTNAME && S3_PATHNAME
        ? [{ protocol: "https", hostname: S3_HOSTNAME, pathname: S3_PATHNAME }]
        : []),
    ],
  },
}

module.exports = nextConfig
