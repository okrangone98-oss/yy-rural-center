(function () {
  'use strict';

  function clickButtonByText(selector, needle) {
    var buttons = document.querySelectorAll(selector);
    for (var i = 0; i < buttons.length; i++) {
      var text = (buttons[i].textContent || '').trim();
      if (text === needle || (needle && text.indexOf(needle) !== -1)) {
        buttons[i].click();
        return true;
      }
    }
    return false;
  }

  function handleAction(action, target) {
    switch (action) {
      case 'close-popup-today':
        if (typeof window.closePopupToday === 'function') window.closePopupToday();
        break;
      case 'program-year':
        if (window.innerWidth > 768) {
          var year = target.getAttribute('data-year') || '';
          if (year) clickButtonByText('#program-year-tabs .program-tab-btn', year);
        }
        break;
      case 'filter-all':
        setTimeout(function () {
          clickButtonByText('.filter-btn', '전체');
        }, 100);
        break;
      case 'filter-pd':
        setTimeout(function () {
          clickButtonByText('.filter-btn', 'PD');
        }, 100);
        break;
      case 'open-board':
        if (typeof window.openBoardModal === 'function') window.openBoardModal();
        break;
      case 'close-contact-modal':
        if (typeof window.closeContactModal === 'function') window.closeContactModal();
        break;
      case 'close-board-modal':
        if (typeof window.closeBoardModal === 'function') window.closeBoardModal();
        break;
      case 'open-board-write':
        if (typeof window.openBoardWrite === 'function') window.openBoardWrite();
        break;
      case 'close-board-write':
        if (typeof window.closeBoardWrite === 'function') window.closeBoardWrite();
        break;
      case 'nav-home-about':
        window.location.href = 'index.html#about';
        break;
      case 'nav-home-teachers':
        window.location.href = 'index.html#teachers';
        break;
      case 'nav-home-programs':
        window.location.href = 'index.html#programs';
        break;
      case 'notice-row':
        var rowIndex = target.getAttribute('data-row-index');
        if (typeof window.openModal === 'function' && rowIndex !== null) {
          window.openModal(Number(rowIndex));
        }
        break;
      default:
        break;
    }
  }

  document.addEventListener('click', function (event) {
    var el = event.target;
    while (el && el !== document) {
      if (el.nodeType === 1 && el.hasAttribute && el.hasAttribute('data-action')) {
        var action = el.getAttribute('data-action');
        // Prevent default for anchor navigation pseudo-links like href="#"
        if (el.tagName === 'A' && (el.getAttribute('href') === '#' || el.getAttribute('href') === '')) {
          event.preventDefault();
        }
        handleAction(action, el);
        return;
      }
      el = el.parentNode;
    }
  });
})();
