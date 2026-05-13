import 'server-only'
import SftpClient from 'ssh2-sftp-client'

function getSftpConfig() {
  const host = process.env.ASSETS_SFTP_HOST?.trim()
  const portStr = process.env.ASSETS_SFTP_PORT?.trim()
  const username = process.env.ASSETS_SFTP_USER?.trim()
  const password = process.env.ASSETS_SFTP_PASSWORD
  const basePath = (process.env.ASSETS_SFTP_BASE_PATH ?? '.').trim()

  if (!host || !username || !password) {
    throw new Error(
      'Asset SFTP is not configured. ASSETS_SFTP_HOST, ASSETS_SFTP_USER, and ASSETS_SFTP_PASSWORD are required.',
    )
  }

  const port = portStr ? parseInt(portStr, 10) : 22
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid ASSETS_SFTP_PORT: "${portStr}"`)
  }

  return { host, port, username, password, basePath }
}

// Join SFTP base path with the app-generated relative path.
// When base is "." or empty, the relative path is used as-is (server is already scoped).
function buildFullSftpPath(basePath: string, relativePath: string): string {
  if (!basePath || basePath === '.' || basePath === './') return relativePath
  return `${basePath.replace(/\/+$/, '')}/${relativePath}`
}

export async function uploadAssetViaSftp(input: {
  fileBuffer: Buffer
  relativePath: string // "{tenantSlug}/email/{assetId}/{safeFileName}"
}): Promise<void> {
  const config = getSftpConfig()
  const fullPath = buildFullSftpPath(config.basePath, input.relativePath)
  const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'))

  const client = new SftpClient()
  try {
    await client.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
    })
    // mkdir with recursive=true is equivalent to mkdir -p — safe if dirs already exist
    await client.mkdir(dirPath, true)
    await client.put(input.fileBuffer, fullPath)
  } finally {
    // Always close the connection; swallow any error from end() itself
    await client.end().catch(() => {})
  }
}
