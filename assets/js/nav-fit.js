/* 모바일 드롭다운 메뉴가 화면 밖으로 잘리지 않도록 위치를 미리 보정합니다. */
(function () {
  'use strict';

  var PAD = 12;          // 화면 가장자리에서 최소한 띄울 여백(px)
  var MOBILE_MAX = 768;  // 모바일 판단 기준(사이트 CSS와 동일)
  var vwCache = 0;       // 기준 화면 폭(메뉴가 넘칠 때 브라우저가 폭을 늘려버리므로 처음 값을 고정해 사용)

  function viewportWidth() {
    if (!vwCache) vwCache = document.documentElement.clientWidth || window.innerWidth;
    return vwCache;
  }

  function isMobile() {
    return window.matchMedia('(max-width: ' + MOBILE_MAX + 'px)').matches;
  }

  function menuOf(dropdown) {
    for (var i = 0; i < dropdown.children.length; i++) {
      var el = dropdown.children[i];
      if (el.classList && el.classList.contains('dropdown-content')) return el;
    }
    return null;
  }

  function clearInline(menu) {
    menu.style.removeProperty('left');
    menu.style.removeProperty('transform');
    menu.style.removeProperty('max-width');
  }

  /* 메뉴를 화면에 띄우기 전에 폭을 재고, 화면 안에 들어오는 위치를 계산해 둡니다.
     (열린 뒤에 옮기면 그 한 프레임 동안 페이지가 옆으로 넓어져 잘려 보일 수 있어 미리 처리) */
  function prepare(dropdown) {
    var menu = menuOf(dropdown);
    if (!menu) return;
    if (!isMobile()) { clearInline(menu); return; }

    var vw = viewportWidth();
    var prevStyle = menu.getAttribute('style');
    menu.style.cssText = (prevStyle || '') + ';display:block;visibility:hidden;position:absolute;left:-9999px;top:0;';
    var width = menu.offsetWidth;
    var pos = window.getComputedStyle(menu).position;
    if (prevStyle === null) menu.removeAttribute('style');
    else menu.setAttribute('style', prevStyle);

    if (!width) return;                       // 숨은 상태에서 폭을 못 재면 손대지 않음
    if (pos !== 'absolute') { clearInline(menu); return; }   // 문서 흐름 안에서 펼쳐지는 메뉴는 그대로

    var startX = dropdown.getBoundingClientRect().left;   // left:0 기준 위치
    var maxW = vw - PAD * 2;
    if (width > maxW) width = maxW;

    var shift = 0;
    if (startX + width > vw - PAD) shift = (vw - PAD) - (startX + width);
    if (startX + shift < PAD) shift = PAD - startX;

    menu.style.left = '0px';
    menu.style.maxWidth = maxW + 'px';
    menu.style.transform = 'translateX(' + Math.round(shift) + 'px)';
  }

  function isOpen(dropdown) {
    return dropdown.classList.contains('is-open') || dropdown.contains(document.activeElement);
  }

  function prepareAll() {
    var dropdowns = document.querySelectorAll('.dropdown');
    for (var i = 0; i < dropdowns.length; i++) prepare(dropdowns[i]);
  }

  function fitOpen() {
    var dropdowns = document.querySelectorAll('.dropdown');
    for (var i = 0; i < dropdowns.length; i++) {
      if (isOpen(dropdowns[i])) prepare(dropdowns[i]);
    }
  }

  // 열기 직전(캡처 단계)에 위치를 계산해 두고, 페이지 스크립트가 연 뒤 한 번 더 확인
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest ? e.target.closest('.dropdown-trigger, .nested-dropdown-trigger') : null;
    if (!trigger) return;
    var dropdown = trigger.closest('.dropdown');
    if (dropdown) prepare(dropdown);
    window.requestAnimationFrame(function () { window.requestAnimationFrame(fitOpen); });
  }, true);

  window.addEventListener('resize', function () {
    vwCache = document.documentElement.clientWidth || window.innerWidth;
    prepareAll(); fitOpen();
  });
  window.addEventListener('orientationchange', function () {
    vwCache = 0; viewportWidth();
    prepareAll(); fitOpen();
  });

  function init() { vwCache = 0; viewportWidth(); prepareAll(); }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(init).catch(function () { init(); });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
