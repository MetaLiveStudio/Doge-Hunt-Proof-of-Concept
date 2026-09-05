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

const compositeLogicPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@dcl',
  'sdk-commands',
  'dist',
  'logic',
  'composite.js'
)

const projectValidationsPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@dcl',
  'sdk-commands',
  'dist',
  'logic',
  'project-validations.js'
)

const launcherUtilsPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@dcl',
  'sdk-commands',
  'dist',
  'commands',
  'start',
  'utils.js'
)

const creatorHubNpxMarker = 'DOGE_CREATOR_HUB_NPX_CANDIDATE'
const creatorHubExternalNpxMarker = 'DOGE_CREATOR_HUB_EXTERNAL_NPX_CLI'

function patchCreatorHubNpxLookup() {
  let utilsSource = fs.readFileSync(launcherUtilsPath, 'utf8')

  if (utilsSource.includes(creatorHubNpxMarker)) {
    return false
  }

  const anchor = "        path_1.default.join(execDir, 'node_modules', 'npm', 'bin', 'npx-cli.js')"
  const anchorIndex = utilsSource.indexOf(anchor)
  const candidatesStart = utilsSource.lastIndexOf('const execPathCandidates = [', anchorIndex)
  const candidatesEnd = utilsSource.indexOf('];', anchorIndex)

  if (anchorIndex === -1 || candidatesStart === -1 || candidatesEnd === -1) {
    throw new Error('[postinstall] Unsupported npx launcher layout.')
  }

  const eol = utilsSource.includes('\r\n') ? '\r\n' : '\n'
  const replacement = `${anchor},${eol}` +
    `        // ${creatorHubNpxMarker}: node-bin/node.exe does not expose resourcesPath.${eol}` +
    "        path_1.default.join(execDir, '..', 'app.asar.unpacked', 'node_modules', 'npm', 'bin', 'npx-cli.js')"

  utilsSource = utilsSource.replace(anchor, replacement)
  fs.writeFileSync(launcherUtilsPath, utilsSource)
  return true
}

function patchCompositeWriteRetry() {
  let compositeSource = fs.readFileSync(compositeLogicPath, 'utf8')

  if (compositeSource.includes('async function writeCrdtWithRetry(')) {
    return false
  }

  const marker = 'async function getAllComposites(components, workingDirectory) {'
  const writeLine = '    await components.fs.writeFile(crdtFilePath, crdtData);'
  const retryHelper = `async function writeCrdtWithRetry(fsComponent, filePath, data) {
    let lastError;
    for (let attempt = 0; attempt < 8; attempt++) {
        try {
            await fsComponent.writeFile(filePath, data);
            return;
        }
        catch (error) {
            lastError = error;
            const retryable = error && ['UNKNOWN', 'EBUSY', 'EPERM'].includes(error.code);
            if (!retryable || attempt === 7)
                throw error;
            await new Promise((resolve) => setTimeout(resolve, 75 * (attempt + 1)));
        }
    }
    throw lastError;
}
`

  if (!compositeSource.includes(marker) || !compositeSource.includes(writeLine)) {
    throw new Error('[postinstall] Unsupported composite writer layout.')
  }

  compositeSource = compositeSource.replace(marker, retryHelper + marker)
  compositeSource = compositeSource.replace(writeLine, '    await writeCrdtWithRetry(components.fs, crdtFilePath, crdtData);')
  fs.writeFileSync(compositeLogicPath, compositeSource)
  return true
}

function patchProjectValidationRetry() {
  let validationsSource = fs.readFileSync(projectValidationsPath, 'utf8')

  if (validationsSource.includes('async function startValidationsWithWindowsRetry(')) {
    return false
  }

  const startMarker = 'async function startValidations(components, cwd) {'
  const nextSectionMarker = '/**\n * Returns true if the scene is an "editor scene"'
  const catchBlock = `    catch (e) {
        components.logger.error('Failed to run scene validations', e.message);
    }
}`
  const retryingCatchBlock = `    catch (e) {
        if (process.platform === 'win32' && e && ['UNKNOWN', 'EBUSY', 'EPERM'].includes(e.code)) {
            throw e;
        }
        components.logger.error('Failed to run scene validations', e.message);
    }
}`
  const retryHelper = `async function startValidationsWithWindowsRetry(components, cwd) {
    let lastError;
    for (let attempt = 0; attempt < 8; attempt++) {
        try {
            return await runStartValidations(components, cwd);
        }
        catch (error) {
            lastError = error;
            const retryable = process.platform === 'win32' && error && ['UNKNOWN', 'EBUSY', 'EPERM'].includes(error.code);
            if (!retryable || attempt === 7)
                throw error;
            await new Promise((resolve) => setTimeout(resolve, 125 * (attempt + 1)));
        }
    }
    throw lastError;
}
async function startValidations(components, cwd) {
    return startValidationsWithWindowsRetry(components, cwd);
}
`

  if (!validationsSource.includes(startMarker) || !validationsSource.includes(catchBlock) || !validationsSource.includes(nextSectionMarker)) {
    throw new Error('[postinstall] Unsupported project validation layout.')
  }

  validationsSource = validationsSource.replace(startMarker, 'async function runStartValidations(components, cwd) {')
  validationsSource = validationsSource.replace(catchBlock, retryingCatchBlock)
  validationsSource = validationsSource.replace(nextSectionMarker, retryHelper + nextSectionMarker)
  fs.writeFileSync(projectValidationsPath, validationsSource)
  return true
}

function patchCreatorHubExternalNpxFallback(source) {
  if (source.includes(creatorHubExternalNpxMarker)) {
    return { source, changed: false }
  }

  const nodeHelperAnchor = 'function getHammurabiNodeBinary() {'
  const nodeRuntimeGuard = "    if (!(0, utils_1.isElectronEnvironment)() || process.platform !== 'win32') {"
  const npxSetup = "    const npxCliJs = (0, utils_1.findNpxCliJs)();\n    const nodeBinary = getHammurabiNodeBinary();"
  const helpers = `function isCreatorHubNodeRuntime() {
    const executable = process.execPath.toLowerCase();
    return process.platform === 'win32'
        && executable.includes('creator-hub')
        && executable.includes('node-bin');
}
function getHammurabiNpxCli(nodeBinary, fallbackNpxCli) {
    if (nodeBinary === process.execPath) {
        return fallbackNpxCli;
    }
    // ${creatorHubExternalNpxMarker}: a regular Node process cannot read
    // Creator Hub's virtual app.asar npm path. Use its own real npm CLI.
    const candidate = path_1.join(path_1.dirname(nodeBinary), 'node_modules', 'npm', 'bin', 'npx-cli.js');
    return fs_1.existsSync(candidate) ? candidate : fallbackNpxCli;
}
`

  if (!source.includes(nodeHelperAnchor) || !source.includes(nodeRuntimeGuard) || !source.includes(npxSetup)) {
    throw new Error('[postinstall] Unsupported Hammurabi launcher layout for external npx fallback.')
  }

  source = source.replace(nodeHelperAnchor, helpers + nodeHelperAnchor)
  source = source.replace(
    nodeRuntimeGuard,
    "    if (!((0, utils_1.isElectronEnvironment)() || isCreatorHubNodeRuntime()) || process.platform !== 'win32') {"
  )
  source = source.replace(
    npxSetup,
    "    const nodeBinary = getHammurabiNodeBinary();\n    const npxCliJs = getHammurabiNpxCli(nodeBinary, (0, utils_1.findNpxCliJs)());"
  )

  return { source, changed: true }
}

const originalEnvLine = "const env = (0, utils_1.isElectronEnvironment)() ? { ...(0, utils_1.getSpawnEnv)(), npm_config_prefix: workingDir } : (0, utils_1.getSpawnEnv)();"
const patchedEnvBlock = `const env = (0, utils_1.isElectronEnvironment)() ? { ...(0, utils_1.getSpawnEnv)(), npm_config_prefix: workingDir } : { ...(0, utils_1.getSpawnEnv)() };
    // Creator Hub can hold the user-level npm cache open on Windows. Keep the
    // authoritative server's npx cache project-local so it can always start.
    env.npm_config_cache = path_1.join(workingDir, '.dcl-npm-cache');
    if (nodeBinary !== process.execPath) {
        delete env.ELECTRON_RUN_AS_NODE;
        env.PATH = \`${'${path_1.dirname(nodeBinary)}'}${'${path_1.delimiter}'}${'${env.PATH || \'\'}'}\`;
    }`

let source = fs.readFileSync(hammurabiServerPath, 'utf8')
const compositePatched = patchCompositeWriteRetry()
const npxLookupPatched = patchCreatorHubNpxLookup()
const projectValidationPatched = patchProjectValidationRetry()
const externalNpxFallback = patchCreatorHubExternalNpxFallback(source)
source = externalNpxFallback.source

if (source.includes("npm_config_cache = path_1.join(workingDir, '.dcl-npm-cache')")) {
  const changes = []
  if (compositePatched) changes.push('main.crdt retry protection')
  if (npxLookupPatched) changes.push('Creator Hub bundled npx lookup')
  if (projectValidationPatched) changes.push('Creator Hub package validation retry protection')
  if (externalNpxFallback.changed) changes.push('Creator Hub external Node/npx fallback')
  if (externalNpxFallback.changed) {
    fs.writeFileSync(hammurabiServerPath, source)
  }
  console.log(changes.length > 0
    ? `[postinstall] Added ${changes.join(' and ')}.`
    : '[postinstall] Hammurabi runtime patch already applied.')
  process.exit(0)
}

if (source.includes('function getHammurabiNodeBinary()')) {
  source = source.replace(
    "const env = (0, utils_1.isElectronEnvironment)() ? { ...(0, utils_1.getSpawnEnv)(), npm_config_prefix: workingDir } : { ...(0, utils_1.getSpawnEnv)() };",
    patchedEnvBlock
  )
  fs.writeFileSync(hammurabiServerPath, source)
  console.log('[postinstall] Added project-local npm cache for Hammurabi and main.crdt retry protection.')
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
console.log('[postinstall] Patched Creator Hub runtime and main.crdt retry protection.')
