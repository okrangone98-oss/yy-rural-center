/* ============================================================
   상단 메뉴 공통 동작
   - 모바일(<=768px): 트리거 탭 → 열림, 같은 트리거 재탭 → 닫힘(토글)
                     다른 트리거 탭 → 기존 닫고 새로 열림, 바깥 탭/Esc → 닫힘
   - 데스크톱: hover 로 열림(각 페이지 CSS), data-href 가 있으면 클릭 시 이동
   - 홈(index) · 공지사항(notice) · Q&A(qna) · 강사 상세(teacher_detail) 공통 사용
   ============================================================ */
(function () {
  'use strict';

  var MOBILE_MAX = 768;

  function isMobile() {
    return window.matchMedia('(max-width: ' + MOBILE_MAX + 'px)').matches;
  }

  function navOf() {
    return document.querySelector('.nav-links');
  }

  function dropdowns() {
    return Array.prototype.slice.call(document.querySelectorAll('.nav-links .dropdown'));
  }

  function triggerOf(dropdown) {
    return dropdown.querySelector(':scope > .dropdown-trigger');
  }

  function setExpanded(dropdown, open) {
    var trigger = triggerOf(dropdown);
    if (trigger) trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) return;
    dropdown.querySelectorAll('.nested-dropdown').forEach(function (nested) {
      nested.classList.remove('is-open');
      var nestedTrigger = nested.classList.contains('nested-dropdown-trigger')
        ? nested
        : nested.querySelector('.nested-dropdown-trigger');
      if (nestedTrigger) nestedTrigger.setAttribute('aria-expanded', 'false');
    });
  }

  function closeDropdown(dropdown) {
    dropdown.classList.remove('is-open');
    setExpanded(dropdown, false);
  }

  function closeAll(except) {
    dropdowns().forEach(function (dropdown) {
      if (dropdown !== except) closeDropdown(dropdown);
    });
  }

  function openDropdown(dropdown, open) {
    dropdown.classList.toggle('is-open', open);
    setExpanded(dropdown, open);
    if (!open) {
      // 포커스가 남아 :focus-within 으로 열린 채 보이는 것 방지
      var trigger = triggerOf(dropdown);
      if (trigger && trigger.blur) trigger.blur();
    }
  }

  function setMobileMenu(open) {
    var nav = navOf();
    var button = document.getElementById('mobile-menu-btn');
    if (!nav) return;
    nav.classList.toggle('is-mobile-open', open);
    if (button) {
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      button.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
    }
    if (!open) {
      closeAll(null);
      var active = document.activeElement;
      if (active && nav.contains(active) && active.blur) active.blur();
    }
  }

  function init() {
    var nav = navOf();
    if (!nav) return;

    // 햄버거 버튼
    var mobileButton = document.getElementById('mobile-menu-btn');
    if (mobileButton) {
      mobileButton.addEventListener('click', function (event) {
        event.stopPropagation();
        setMobileMenu(!nav.classList.contains('is-mobile-open'));
      });
    }

    // 1단계 드롭다운 트리거
    dropdowns().forEach(function (dropdown) {
      var trigger = triggerOf(dropdown);
      if (!trigger) return;

      trigger.addEventListener('click', function (event) {
        if (isMobile()) {
          event.preventDefault();
          event.stopPropagation(); // data-action 문서 핸들러보다 우선 (페이지 이동 대신 메뉴 열기)
          var willOpen = !dropdown.classList.contains('is-open');
          closeAll(dropdown);
          openDropdown(dropdown, willOpen);
          return;
        }

        var href = trigger.getAttribute('data-href');
        if (href) {
          window.location.href = href;
          return;
        }

        var open = !dropdown.classList.contains('is-open');
        closeAll(dropdown);
        openDropdown(dropdown, open);
      });

      trigger.addEventListener('keydown', function (event) {
        if (event.key !== 'ArrowDown') return;
        event.preventDefault();
        openDropdown(dropdown, true);
        var first = dropdown.querySelector('.dropdown-content a, .nested-dropdown-trigger');
        if (first) first.focus();
      });

      dropdown.addEventListener('focusin', function () {
        trigger.setAttribute('aria-expanded', 'true');
      });

      dropdown.addEventListener('focusout', function () {
        window.requestAnimationFrame(function () {
          if (!dropdown.contains(document.activeElement)) closeDropdown(dropdown);
        });
      });
    });

    // 2단계 서브메뉴 트리거
    nav.querySelectorAll('.nested-dropdown-trigger').forEach(function (nestedTrigger) {
      var nested = nestedTrigger.classList.contains('nested-dropdown')
        ? nestedTrigger
        : nestedTrigger.closest('.nested-dropdown');
      if (!nested) return;
      nestedTrigger.addEventListener('click', function (event) {
        event.preventDefault();
        var willOpen = !nested.classList.contains('is-open');
        nested.classList.toggle('is-open', willOpen);
        nestedTrigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      });
    });

    // 메뉴 안의 링크를 누르면 모바일 메뉴를 닫고 이동
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        if (isMobile()) setMobileMenu(false);
      });
    });

    // 메뉴 바깥을 탭하면 닫힘
    document.addEventListener('click', function (event) {
      var target = event.target;
      var insideNav = target && target.closest ? target.closest('.nav-links') : null;

      if (insideNav) {
        if (target.closest('.dropdown')) return; // 서브메뉴 안쪽 클릭은 유지
        closeAll(null);
        return;
      }

      if (target && target.closest && target.closest('#mobile-menu-btn')) return;

      closeAll(null);
      if (isMobile() && nav.classList.contains('is-mobile-open')) setMobileMenu(false);
    });

    // Esc 로 닫기
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      closeAll(null);
      if (isMobile() && nav.classList.contains('is-mobile-open')) setMobileMenu(false);
    });

    // 화면 폭이 넓어지면 모바일 전용 상태 정리
    window.addEventListener('resize', function () {
      if (!isMobile()) {
        nav.classList.remove('is-mobile-open');
        closeAll(null);
        var button = document.getElementById('mobile-menu-btn');
        if (button) {
          button.setAttribute('aria-expanded', 'false');
          button.setAttribute('aria-label', '메뉴 열기');
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
