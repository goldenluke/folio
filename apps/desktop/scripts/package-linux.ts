import { resolve } from 'node:path';

import { assembleLinux } from './assemble-linux.ts';

await assembleLinux('dir');
console.log(`folio package ready: ${resolve(import.meta.dirname, '..', 'release', 'linux-unpacked')}`);
