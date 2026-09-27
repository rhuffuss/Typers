import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { createMultipleServers } from './multiple-servers.js';

const keyPath = process.env.TLS_KEY_PATH;
const certPath = process.env.TLS_CERT_PATH;
if (!keyPath || !certPath)
  throw new Error(
    'Set TLS_KEY_PATH and TLS_CERT_PATH to local certificate files',
  );
const port = (value: string | undefined, fallback: number) => {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535)
    throw new Error('HTTP_PORT and HTTPS_PORT must be valid TCP ports');
  return parsed;
};
const [key, cert] = await Promise.all([readFile(keyPath), readFile(certPath)]);
const servers = await createMultipleServers({
  key,
  cert,
  httpPort: port(process.env.HTTP_PORT, 3080),
  httpsPort: port(process.env.HTTPS_PORT, 3443),
});
console.log(`HTTP ${servers.httpUrl} / HTTPS ${servers.httpsUrl}`);
const shutdown = async () => {
  await servers.close();
};
process.on('SIGINT', () => {
  void shutdown();
});
process.on('SIGTERM', () => {
  void shutdown();
});
