(function () {
  const dialog = document.getElementById('home-announcement');
  if (!dialog) return;
  const storageKey = 'home-announcement-2026-booklet-hidden-until';
  let hiddenUntil = 0;
  try { hiddenUntil = Number(localStorage.getItem(storageKey)) || 0; } catch (_) { /* Private browsing may block storage. */ }

  function closeAnnouncement() {
    if (document.getElementById('announcement-hide-today').checked) {
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      try { localStorage.setItem(storageKey, String(midnight.getTime())); } catch (_) { /* Closing still works without storage. */ }
    }
    dialog.close();
  }

  dialog.querySelectorAll('[data-close-announcement]').forEach(button => button.addEventListener('click', closeAnnouncement));
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeAnnouncement(); });
  dialog.querySelector('.announcement-link').addEventListener('click', closeAnnouncement);
  if (Date.now() >= hiddenUntil) dialog.showModal();
})();
