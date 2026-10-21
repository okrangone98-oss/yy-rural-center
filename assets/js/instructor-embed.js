(function () {
  const frame = document.querySelector('.instructor-directory-frame');
  if (!frame) return;

  window.addEventListener('message', function (event) {
    if (event.origin !== 'https://app.yycenter.kr' || event.source !== frame.contentWindow) return;
    const message = event.data;
    if (!message || message.type !== 'iumteo:directory-height') return;
    const height = message.height;
    if (typeof height !== 'number' || !Number.isFinite(height) || height < 40 || height > 20000) return;
    frame.style.height = Math.ceil(height) + 'px';
  });
})();
