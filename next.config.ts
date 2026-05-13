import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // ssh2-sftp-client and ssh2 use optional native bindings — keep them out of the Turbopack bundle
  serverExternalPackages: ['ssh2-sftp-client', 'ssh2'],
}

export default nextConfig
