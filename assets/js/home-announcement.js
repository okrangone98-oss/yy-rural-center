(function () {
  const dialog = document.getElementById('home-announcement');
  if (!dialog) return;
  const reopen = document.getElementById('announcement-reopen');
  const hideToday = document.getElementById('announcement-hide-today');
  const storageKey = 'home-announcement-2026-booklet-hidden-until';
  let hiddenUntil = 0;
  try { hiddenUntil = Number(localStorage.getItem(storageKey)) || 0; } catch (_) { /* Private browsing may block storage. */ }
  const nextMidnight = new Date();
  nextMidnight.setHours(24, 0, 0, 0);
  // Ignore corrupt or stale timestamps that could suppress the notice indefinitely.
  const isHiddenToday = Number.isFinite(hiddenUntil) && hiddenUntil > Date.now() && hiddenUntil <= nextMidnight.getTime();

  function openAnnouncement() {
    if (dialog.open) return;
    dialog.showModal();
    if (reopen) reopen.hidden = true;
  }

  function closeAnnouncement() {
    if (hideToday.checked) {
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      try { localStorage.setItem(storageKey, String(midnight.getTime())); } catch (_) { /* Closing still works without storage. */ }
    } else {
      try { localStorage.removeItem(storageKey); } catch (_) { /* Private browsing may block storage. */ }
    }
    dialog.close();
    if (reopen) reopen.hidden = false;
  }

  dialog.querySelectorAll('[data-close-announcement]').forEach(button => button.addEventListener('click', closeAnnouncement));
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeAnnouncement(); });
  dialog.querySelector('.announcement-link').addEventListener('click', closeAnnouncement);
  hideToday.checked = isHiddenToday;
  if (reopen) {
    reopen.hidden = false;
    reopen.addEventListener('click', openAnnouncement);
  }
  if (!isHiddenToday) openAnnouncement();
})();
