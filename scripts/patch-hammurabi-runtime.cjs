const fs = require('fs')
const path = require('path')

const hammurabiServerPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@dcl',
  'sdk-commands',
  'dist',
  'commands',
  'start',
  'hammurabi-server.js'
)

const originalEnvLine = "const env = (0, utils_1.isElectronEnvironment)() ? { ...(0, utils_1.getSpawnEnv)(), npm_config_prefix: workingDir } : (0, utils_1.getSpawnEnv)();"
const patchedEnvBlock = `const env = (0, utils_1.isElectronEnvironment)() ? { ...(0, utils_1.getSpawnEnv)(), npm_config_prefix: workingDir } : { ...(0, utils_1.getSpawnEnv)() };
    if (nodeBinary !== process.execPath) {
        delete env.ELECTRON_RUN_AS_NODE;
        env.PATH = \`${'${path_1.dirname(nodeBinary)}'}${'${path_1.delimiter}'}${'${env.PATH || \'\'}'}\`;
    }`

let source = fs.readFileSync(hammurabiServerPath, 'utf8')

if (source.includes('function getHammurabiNodeBinary()')) {
  console.log('[postinstall] Hammurabi runtime patch already applied.')
  process.exit(0)
}

const replacements = [
  [
    'const child_process_1 = require("child_process");',
    'const child_process_1 = require("child_process");\nconst fs_1 = require("fs");\nconst path_1 = require("path");'
  ],
  [
    "const HAMMURABI_VERSION = 'next';",
    `const HAMMURABI_VERSION = 'next';
function getHammurabiNodeBinary() {
    if (!(0, utils_1.isElectronEnvironment)() || process.platform !== 'win32') {
        return process.execPath;
    }
    const candidates = [
        process.env.DCL_MULTIPLAYER_NODE,
        process.env.ProgramFiles
            ? path_1.join(process.env.ProgramFiles, 'nodejs', 'node.exe')
            : undefined,
        ...((process.env.PATH || '')
            .split(path_1.delimiter)
            .map((entry) => path_1.join(entry, 'node.exe')))
    ].filter(Boolean);
    return candidates.find((candidate) => fs_1.existsSync(candidate)) || process.execPath;
}`
  ],
  [
    'const npxCliJs = (0, utils_1.findNpxCliJs)();',
    'const npxCliJs = (0, utils_1.findNpxCliJs)();\n    const nodeBinary = getHammurabiNodeBinary();'
  ],
  [originalEnvLine, patchedEnvBlock],
  [
    '? (0, child_process_1.spawn)(process.execPath, [npxCliJs, ...npxArgs], { cwd: workingDir, shell: false, stdio: \'inherit\', env })',
    '? (0, child_process_1.spawn)(nodeBinary, [npxCliJs, ...npxArgs], { cwd: workingDir, shell: false, stdio: \'inherit\', env })'
  ]
]

for (const [from, to] of replacements) {
  if (!source.includes(from)) {
    throw new Error(`[postinstall] Unsupported @dcl/sdk-commands layout. Missing: ${from}`)
  }
  source = source.replace(from, to)
}

fs.writeFileSync(hammurabiServerPath, source)
console.log('[postinstall] Patched Hammurabi to use the system Node runtime in Creator Hub.')
