const { join } = require('node:path');

const electronVersion = require('./node_modules/electron/package.json').version;
const appDirectory = process.env.FOLIO_PACKAGE_STAGE || join(__dirname, '.package');

/**
 * P19 produz o diretório e P20 o `.deb` Linux x64, ainda não assinados.
 * Signing e publicação entram nas etapas posteriores de release.
 */
module.exports = {
  appId: 'com.folio.academic',
  productName: 'Folio',
  electronVersion,
  // O Electron é a mesma versão que P18 usou para compilar o addon. Em CI,
  // setup-node/pnpm a instala pelo lockfile; não baixamos um segundo runtime.
  electronDist: join(__dirname, 'node_modules', 'electron', 'dist'),
  directories: {
    app: appDirectory,
    output: 'release',
  },
  files: [
    'dist/**/*',
    '!dist/workspace/node_modules/**/*',
    'node_modules/**/*',
    'package.json',
    'build/folio-package.json',
    '!**/*.map',
  ],
  // O Workspace Service recebe uma raiz privada fora do ASAR. Assim, a
  // resolução de better-sqlite3 não depende de heurística de smart unpack e o
  // manifesto P18 permanece adjacente ao addon que ele descreve.
  extraResources: [
    { from: join(appDirectory, 'dist', 'workspace'), to: 'workspace-runtime', filter: ['**/*', '!node_modules/**/*'] },
    { from: join(appDirectory, 'dist', 'workspace', 'node_modules'), to: 'workspace-runtime/node_modules', filter: ['**/*'] },
  ],
  asar: true,
  npmRebuild: false,
  linux: {
    target: ['dir'],
    category: 'Office',
    synopsis: 'IDE acadêmico local-first',
    description: 'Ambiente local-first para leitura, escrita e publicação acadêmica.',
    maintainer: 'Folio',
    vendor: 'Folio',
    executableName: 'folio',
    icon: 'build/icons',
    syncDesktopName: true,
    desktop: {
      entry: {
        Name: 'Folio',
        Comment: 'IDE acadêmico local-first',
        Categories: 'Office;Education;',
        StartupWMClass: 'Folio',
      },
    },
  },
  deb: {
    packageName: 'folio',
    packageCategory: 'editors',
    priority: 'optional',
  },
  win: {
    target: ['nsis'],
    artifactName: 'Folio-${version}-win-x64-setup.${ext}',
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
  },
};
