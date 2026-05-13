// Minimal type stub for ssh2-sftp-client (no bundled types in v12).
// Only the surface used by lib/assets/sftp.ts is declared.
declare module 'ssh2-sftp-client' {
  interface ConnectOptions {
    host: string
    port?: number
    username: string
    password?: string
  }

  class SftpClient {
    connect(options: ConnectOptions): Promise<void>
    mkdir(path: string, recursive?: boolean): Promise<void>
    put(input: Buffer | NodeJS.ReadableStream, remotePath: string): Promise<void>
    end(): Promise<void>
  }

  export = SftpClient
}
