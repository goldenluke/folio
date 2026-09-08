import { resolve } from 'node:path';

import { assembleLinux } from './assemble-linux.ts';

const artifacts = await assembleLinux('deb');
const installer = artifacts.find((artifact) => artifact.endsWith('.deb'));
if (installer === undefined) throw new Error('Instalador .deb ausente após o build.');
console.log(`folio installer ready: ${resolve(installer)}`);
