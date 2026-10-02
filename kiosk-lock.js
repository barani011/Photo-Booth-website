(() => {
  const LOCK_KEY = 'lumabooth_kiosk_locked_v1';
  const isKioskPage = window.location.pathname.endsWith('/kiosk.html');
  const settingsToggleSelector = '#toggle-settings-btn, #btn-toggle-settings, #settings-options-toggle';
  const lockedSettingsToggleSelector = settingsToggleSelector
    .split(', ')
    .map(selector => `.booth-settings-locked ${selector}`)
    .join(', ');

  const style = document.createElement('style');
  style.textContent = `
    ${lockedSettingsToggleSelector} { display: none !important; }
    .booth-settings-locked #settings-panel {
      visibility: hidden;
      pointer-events: none;
    }
  `;
  document.head.append(style);

  function isLocked() {
    return localStorage.getItem(LOCK_KEY) === 'true';
  }

  function syncLockedState() {
    const locked = isLocked();
    document.documentElement.classList.toggle('booth-settings-locked', locked);
    const kioskScreen = document.querySelector('.kiosk-screen');
    kioskScreen?.classList.toggle('locked', locked);

    const settingsPanel = document.getElementById('settings-panel');
    if (locked) settingsPanel?.classList.remove('open');

    const kioskUnlock = document.getElementById('unlock-settings-btn');
    if (kioskUnlock) kioskUnlock.hidden = !locked;

    const kioskLock = document.querySelector('.btn-lock');
    if (kioskLock) {
      kioskLock.setAttribute('aria-pressed', String(locked));
      kioskLock.lastChild.textContent = locked ? ' Unlock' : ' Lock';
      kioskLock.title = locked ? 'Unlock kiosk controls' : 'Lock kiosk controls';
    }
  }

  function setLocked(locked) {
    if (locked) localStorage.setItem(LOCK_KEY, 'true');
    else localStorage.removeItem(LOCK_KEY);
    syncLockedState();
  }

  window.LumaBoothLock = { isLocked, setLocked, syncLockedState };
  syncLockedState();

  window.addEventListener('storage', event => {
    if (event.key === LOCK_KEY) syncLockedState();
  });

  document.addEventListener('click', event => {
    if (!isLocked() || !event.target.closest(settingsToggleSelector)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    document.getElementById('settings-panel')?.classList.remove('open');
  }, true);

  if (isKioskPage && new URLSearchParams(window.location.search).get('openSettings') === '1' && !isLocked()) {
    document.getElementById('settings-panel')?.classList.add('open');
  }
})();