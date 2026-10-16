import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const password = randomBytes(24).toString('base64url');
await writeFile(
  new URL('../.env', import.meta.url),
  `ADMIN_USERNAME=admin\nADMIN_PASSWORD=${password}\nCTF_FLAG=\nHOST=127.0.0.1\nPORT=3500\nPUBLIC_ORIGIN=http://127.0.0.1:3500\n`,
  { flag: 'wx', mode: 0o600 },
);
console.log(
  'Created .env with the admin username, a random password, and an empty CTF_FLAG. Set CTF_FLAG there before starting the server.',
);
