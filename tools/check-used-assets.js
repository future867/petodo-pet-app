const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const frontendRoot = path.join(repoRoot, 'frontend');

const runtimeFiles = [
  'frontend/index.html',
  'frontend/pet_window.html',
  'frontend/renderer.js',
  'frontend/pet_window.js'
];

const runtimeThemes = [
  {
    name: 'luoxiaohei',
    basePath: 'assets/pet/luoxiaohei',
    themeFile: 'frontend/assets/pet/luoxiaohei/theme.json'
  }
];

const assetPattern = /assets\/[^'"`)>\s?]+\.(?:png|apng|gif|webp|svg|jpg|jpeg)/gi;
const frameExtensions = ['png', 'apng', 'gif', 'svg', 'webp'];

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function addAsset(assets, relativeFromFrontend, source) {
  const cleanPath = relativeFromFrontend.replaceAll('\\', '/');
  assets.set(cleanPath, [...(assets.get(cleanPath) || []), source]);
}

function collectRuntimeLiteralAssets(assets) {
  for (const relativeFile of runtimeFiles) {
    const text = readText(relativeFile);
    const matches = text.match(assetPattern) || [];
    for (const match of matches) {
      addAsset(assets, match, relativeFile);
    }
  }
}

function discoverFrameAssets(assets, theme, folderName, source) {
  const manifest = theme.frameManifests?.[folderName];
  const frameNames = [];

  if (Array.isArray(manifest) && manifest.length > 0) {
    frameNames.push(...manifest);
  } else {
    for (let index = 1; index <= 90; index += 1) {
      const number = String(index).padStart(2, '0');
      const found = frameExtensions
        .map((extension) => `${folderName}_${number}.${extension}`)
        .find((fileName) => fs.existsSync(path.join(frontendRoot, source.basePath, folderName, fileName)));

      if (!found) {
        break;
      }

      frameNames.push(found);
    }
  }

  for (const frameName of frameNames) {
    addAsset(assets, `${source.basePath}/${folderName}/${frameName}`, source.themeFile);
  }
}

function collectThemeAssets(assets) {
  for (const source of runtimeThemes) {
    const theme = JSON.parse(readText(source.themeFile));
    for (const [stateName, state] of Object.entries(theme.states || {})) {
      if (!state || typeof state !== 'object') {
        continue;
      }

      if ((state.type === 'image' || state.type === 'single' || state.type === 'animated') && state.path) {
        addAsset(assets, `${source.basePath}/${state.path}`, `${source.themeFile}:${stateName}`);
      }

      if (state.type === 'frames' && state.path) {
        discoverFrameAssets(assets, theme, state.path, source);
      }
    }
  }
}

function main() {
  const assets = new Map();
  collectRuntimeLiteralAssets(assets);
  collectThemeAssets(assets);

  const missing = [];
  const existing = [];

  for (const assetPath of [...assets.keys()].sort()) {
    const absolutePath = path.join(frontendRoot, assetPath);
    if (fs.existsSync(absolutePath)) {
      existing.push(assetPath);
    } else {
      missing.push({
        assetPath,
        referencedBy: assets.get(assetPath)
      });
    }
  }

  console.log(`Used asset files checked: ${existing.length + missing.length}`);
  console.log(`Existing: ${existing.length}`);
  console.log(`Missing: ${missing.length}`);

  if (missing.length > 0) {
    console.error('\nMissing assets:');
    for (const item of missing) {
      console.error(`- ${item.assetPath}`);
      console.error(`  referenced by: ${item.referencedBy.join(', ')}`);
    }
    process.exit(1);
  }

  console.log('All runtime asset references are present.');
}

main();
