const versionText = document.querySelector('#versionText');
const licenseText = document.querySelector('#licenseText');
const authorText = document.querySelector('#authorText');
const maintainerText = document.querySelector('#maintainerText');
const repositoryButton = document.querySelector('#repositoryButton');
const releaseButton = document.querySelector('#releaseButton');
const checkUpdateButton = document.querySelector('#checkUpdateButton');
const updateStatusText = document.querySelector('#updateStatusText');

let repositoryUrl = 'https://github.com/future867/petodo-pet-app';
let releasesUrl = `${repositoryUrl}/releases`;

function formatVersion(version) {
  const normalizedVersion = String(version || '').trim();
  return normalizedVersion.startsWith('v') ? normalizedVersion : `v${normalizedVersion || '0.1.0'}`;
}

function setUpdateMessage(message, releaseUrl = '') {
  updateStatusText.textContent = message;

  if (releaseUrl) {
    releasesUrl = releaseUrl;
    releaseButton.hidden = false;
  } else {
    releaseButton.hidden = true;
  }
}

async function loadAboutInfo() {
  if (!window.petodo?.getAboutInfo) {
    return;
  }

  const info = await window.petodo.getAboutInfo();
  repositoryUrl = info.repositoryUrl || repositoryUrl;
  releasesUrl = info.releasesUrl || releasesUrl;

  versionText.textContent = formatVersion(info.version);
  licenseText.textContent = info.license || '暂未声明';
  authorText.textContent = info.author || 'future867';
  maintainerText.textContent = info.maintainer || 'future867';
  repositoryButton.textContent = repositoryUrl.replace(/^https:\/\//, '');
}

async function openExternalLink(url) {
  if (!window.petodo?.openExternalLink) {
    setUpdateMessage('当前环境无法打开外部链接');
    return;
  }

  const opened = await window.petodo.openExternalLink(url);
  if (!opened) {
    setUpdateMessage('链接未被允许打开');
  }
}

async function checkForUpdate() {
  if (!window.petodo?.checkForUpdate) {
    setUpdateMessage('当前环境无法检查更新');
    return;
  }

  checkUpdateButton.disabled = true;
  checkUpdateButton.textContent = '检查中';
  setUpdateMessage('正在检查 GitHub Releases...');

  try {
    const result = await window.petodo.checkForUpdate();

    if (!result.ok) {
      setUpdateMessage(result.message || '检查更新失败，请稍后重试');
      return;
    }

    versionText.textContent = formatVersion(result.currentVersion);

    if (!result.canCompare) {
      setUpdateMessage('无法自动比较版本，请打开发布页手动查看。', result.releaseUrl || releasesUrl);
      return;
    }

    if (result.hasUpdate) {
      setUpdateMessage(`发现新版本 ${formatVersion(result.latestVersion)}，可前往发布页查看。`, result.releaseUrl || releasesUrl);
      return;
    }

    setUpdateMessage('已是最新版本。');
  } catch {
    setUpdateMessage('检查更新失败，请稍后重试');
  } finally {
    checkUpdateButton.disabled = false;
    checkUpdateButton.textContent = '检查更新';
  }
}

repositoryButton.addEventListener('click', () => openExternalLink(repositoryUrl));
releaseButton.addEventListener('click', () => openExternalLink(releasesUrl));
checkUpdateButton.addEventListener('click', checkForUpdate);

loadAboutInfo().catch(() => {
  setUpdateMessage('关于信息加载失败');
});
