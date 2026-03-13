import { createServer } from 'net';
import { spawn } from 'child_process';

function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port, '127.0.0.1');
  });
}

async function main() {
  const preferred = 3000;
  const fallback = 3001;

  const port3000Busy = await isPortInUse(preferred);
  const port = port3000Busy ? fallback : preferred;

  if (port3000Busy) {
    console.log(`Porta ${preferred} em uso. Iniciando na porta ${port}...`);
  }

  const vite = spawn('npx', ['vite', '--port', String(port)], {
    stdio: 'inherit',
    shell: true,
  });

  vite.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
