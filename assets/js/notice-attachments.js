window.NoticeAttachments = (function () {
  const IMAGE_PATH = /\.(png|jpe?g|gif|webp|avif|bmp)$/i;
  const MIN_THUMB = 40;
  const THUMBNAIL_WIDTH = "w1600";

  function webUrl(value) {
    try {
      const url = new URL(value);
      return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url : null;
    } catch (_) { return null; }
  }

  function parse(raw, label = "첨부파일") {
    return String(raw || "").split(/[\r\n,;]+/).flatMap(part =>
      part.includes("::") ? [part] : part.split(/(?=https?:\/\/)/i)
    ).map(part => part.trim()).filter(Boolean).map((part, index) => {
      const split = part.indexOf("::");
      const name = split < 0 ? "" : part.slice(0, split).trim();
      const url = webUrl(split < 0 ? part : part.slice(split + 2).trim());
      return url ? { name: name || `${label} ${index + 1}`, url: url.href } : null;
    }).filter(Boolean);
  }

  // Drive 파일은 포스터(썸네일) 이미지를 먼저 보여 주고, 이미지가 아니면 미리보기 iframe으로 넘어간다.
  function drivePreview(url) {
    if (url.origin !== "https://drive.google.com") return null;
    const id = url.pathname.match(/^\/file\/d\/([\w-]+)(?:\/|$)/)?.[1]
      || (/^\/(open|uc)$/.test(url.pathname) ? url.searchParams.get("id") : "");
    if (!id || !/^[\w-]+$/.test(id)) return null;
    const resourceKey = url.searchParams.get("resourcekey");
    const frame = new URL(`https://drive.google.com/file/d/${id}/preview`);
    const thumbnail = new URL("https://drive.google.com/thumbnail");
    thumbnail.searchParams.set("id", id);
    thumbnail.searchParams.set("sz", THUMBNAIL_WIDTH);
    if (resourceKey) {
      frame.searchParams.set("resourcekey", resourceKey);
      thumbnail.searchParams.set("resourcekey", resourceKey);
    }
    return { id, url: frame.href, thumbnail: thumbnail.href };
  }

  function previewFor(value, photo = false) {
    const url = webUrl(value);
    if (!url || url.protocol !== "https:") return null;
    const drive = drivePreview(url);
    if (drive) return { kind: "drive", url: drive.url, thumbnail: drive.thumbnail };
    return photo || IMAGE_PATH.test(url.pathname)
      ? { kind: "image", url: url.href } : null;
  }

  function bigViewButton(label, open) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "notice-attachment-big-view";
    button.textContent = "🔍 크게 보기";
    button.setAttribute("aria-label", `${label} 크게 보기`);
    button.addEventListener("click", event => {
      if (event && typeof event.preventDefault === "function") event.preventDefault();
      open();
    });
    return button;
  }

  function imageElement(file, src, onError) {
    const image = document.createElement("img");
    image.alt = file.name;
    image.loading = "lazy";
    image.decoding = "async";
    image.setAttribute("referrerpolicy", "no-referrer");
    image.addEventListener("error", onError, { once: true });
    image.src = src;
    return image;
  }

  // iframe은 손가락 스와이프를 삼키므로 투명한 보호 레이어를 덮어 모달 스크롤을 통과시키고,
  // 레이어를 누르면 크게 보기가 열린다.
  function driveFrame(file, preview) {
    const wrap = document.createElement("div");
    wrap.className = "notice-attachment-frame";
    const frame = document.createElement("iframe");
    frame.title = `${file.name} 미리보기`;
    frame.loading = "lazy";
    frame.referrerPolicy = "no-referrer";
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
    frame.src = preview.url;
    const shield = document.createElement("button");
    shield.type = "button";
    shield.className = "notice-attachment-shield";
    shield.setAttribute("aria-label", `${file.name} 크게 보기`);
    const pill = document.createElement("span");
    pill.textContent = "🔍 크게 보기";
    shield.append(pill);
    shield.addEventListener("click", () => openLightbox({ title: file.name, kind: "drive", src: preview.url }));
    wrap.append(frame, shield);
    return wrap;
  }

  function render(container, files, { photo = false } = {}) {
    if (!container) return;
    container.replaceChildren();
    (files || []).forEach(file => {
      const url = webUrl(file && file.url);
      if (!url) return;
      const card = document.createElement("figure");
      card.className = "notice-attachment";
      const caption = document.createElement("figcaption");
      const name = document.createElement("span");
      name.textContent = file.name;
      const link = document.createElement("a");
      link.href = url.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "원본 열기";
      link.setAttribute("aria-label", `${file.name} 원본 열기 (새 창)`);
      caption.append(name, link);
      card.append(caption);

      const preview = previewFor(url.href, photo);
      if (preview?.kind === "image") {
        caption.append(bigViewButton(file.name, () => openLightbox({ title: file.name, kind: "image", src: preview.url })));
        card.append(imageElement(file, preview.url, () => {
          const message = document.createElement("p");
          message.textContent = "이미지를 불러오지 못했습니다. 원본 열기를 이용해 주세요.";
          image.replaceWith(message);
        }));
      } else if (preview?.kind === "drive") {
        card.className = "notice-attachment notice-attachment-drive";
        // 썸네일을 못 불러오면(PDF 등) 미리보기 iframe으로 바꾸고, 크게 보기도 그에 맞춘다.
        const view = { kind: "image", src: preview.thumbnail };
        caption.append(bigViewButton(file.name, () => openLightbox({ title: file.name, kind: view.kind, src: view.src })));
        let image;
        image = imageElement(file, preview.thumbnail, () => {
          view.kind = "drive";
          view.src = preview.url;
          image.replaceWith(driveFrame(file, preview));
        });
        card.append(image);
      }
      container.append(card);
    });
    refreshScrollbarsAround(container);
  }

  /* ── 모달 오른쪽 세로 슬라이드 막대기 ─────────────────────────── */

  function scrollbarGeometry({ scrollHeight = 0, clientHeight = 0, trackHeight = 0, scrollTop = 0, minThumb = MIN_THUMB } = {}) {
    const max = Math.max(0, scrollHeight - clientHeight);
    if (!trackHeight || max <= 1 || !clientHeight) {
      return { visible: false, thumbHeight: 0, thumbTop: 0, travel: 0, max };
    }
    const raw = trackHeight * clientHeight / Math.max(1, scrollHeight);
    const thumbHeight = Math.min(trackHeight, Math.max(minThumb, Math.round(raw)));
    const travel = Math.max(0, trackHeight - thumbHeight);
    const ratio = Math.max(0, Math.min(1, scrollTop / max));
    return { visible: true, thumbHeight, travel, max, thumbTop: Math.round(travel * ratio) };
  }

  function attachScrollbar(scroller, options = {}) {
    if (!scroller || typeof document === "undefined" || typeof document.createElement !== "function") return null;
    if (scroller.__noticeScrollbar) return scroller.__noticeScrollbar;
    const container = options.container || scroller.parentElement;
    if (!container || typeof container.append !== "function") return null;
    if (container.style && (!container.style.position || container.style.position === "static")) {
      container.style.position = "relative";
    }

    const bar = document.createElement("div");
    bar.className = "notice-scrollbar";
    const track = document.createElement("div");
    track.className = "notice-scrollbar-track";
    const thumb = document.createElement("div");
    thumb.className = "notice-scrollbar-thumb";
    track.append(thumb);
    bar.append(track);
    container.append(bar);

    let frame = 0;
    let last = scrollbarGeometry();

    function metrics() {
      return {
        scrollHeight: scroller.scrollHeight || 0,
        clientHeight: scroller.clientHeight || 0,
        trackHeight: bar.clientHeight || scroller.clientHeight || 0,
        scrollTop: scroller.scrollTop || 0,
      };
    }

    function place() {
      if (typeof scroller.getBoundingClientRect !== "function" || typeof container.getBoundingClientRect !== "function") return;
      const area = scroller.getBoundingClientRect();
      const box = container.getBoundingClientRect();
      if (!area || !area.height) { bar.style.display = "none"; return; }
      bar.style.top = `${Math.round(area.top - box.top)}px`;
      bar.style.height = `${Math.round(area.height)}px`;
    }

    function sync() {
      place();
      last = scrollbarGeometry(metrics());
      bar.style.display = last.visible ? "" : "none";
      bar.setAttribute("aria-hidden", last.visible ? "false" : "true");
      thumb.style.height = `${last.thumbHeight}px`;
      thumb.style.transform = `translateY(${last.thumbTop}px)`;
    }

    function schedule() {
      if (frame) return;
      if (typeof requestAnimationFrame !== "function") { sync(); return; }
      frame = requestAnimationFrame(() => { frame = 0; sync(); });
    }

    function scrollToPointer(clientY) {
      const geometry = scrollbarGeometry(metrics());
      if (!geometry.visible || typeof track.getBoundingClientRect !== "function") return;
      const area = track.getBoundingClientRect();
      if (!area || !area.height) return;
      const offset = clientY - area.top - geometry.thumbHeight / 2;
      const ratio = Math.max(0, Math.min(1, offset / Math.max(1, geometry.travel)));
      scroller.scrollTop = Math.round(ratio * geometry.max);
      sync();
    }

    function onPointerMove(event) { scrollToPointer(event.clientY); }
    function onPointerUp() {
      if (bar.classList) bar.classList.remove("is-dragging");
      if (typeof window !== "undefined" && window.removeEventListener) {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
      }
    }
    function onPointerDown(event) {
      if (event.button != null && event.button > 0) return;
      if (typeof event.preventDefault === "function") event.preventDefault();
      if (bar.classList) bar.classList.add("is-dragging");
      if (typeof track.setPointerCapture === "function" && event.pointerId != null) {
        try { track.setPointerCapture(event.pointerId); } catch (_) { /* ignore */ }
      }
      scrollToPointer(event.clientY);
      if (typeof window !== "undefined" && window.addEventListener) {
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onPointerUp);
      }
    }

    track.addEventListener("pointerdown", onPointerDown);
    scroller.addEventListener("scroll", schedule, { passive: true });
    scroller.addEventListener("load", schedule, true);
    if (typeof ResizeObserver === "function") {
      try { new ResizeObserver(schedule).observe(scroller); } catch (_) { /* ignore */ }
    }
    if (typeof MutationObserver === "function") {
      try { new MutationObserver(schedule).observe(scroller, { childList: true, subtree: true, characterData: true }); } catch (_) { /* ignore */ }
    }
    if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("resize", schedule);

    sync();

    const api = { element: bar, refresh: sync, geometry: () => last };
    scroller.__noticeScrollbar = api;
    return api;
  }

  function refreshScrollbarsAround(node) {
    let target = node;
    while (target) {
      const bar = target.__noticeScrollbar;
      if (bar && typeof bar.refresh === "function") { bar.refresh(); return bar; }
      target = target.parentElement;
    }
    return null;
  }

  function initScrollbars(root) {
    const doc = root || (typeof document !== "undefined" ? document : null);
    if (!doc || typeof doc.querySelectorAll !== "function") return [];
    return Array.from(doc.querySelectorAll("[data-notice-scroll]")).map(scroller => {
      if (!scroller) return null;
      const container = typeof scroller.closest === "function"
        ? scroller.closest(".modal-card, .modal-dialog")
        : null;
      return attachScrollbar(scroller, { container: container || scroller.parentElement });
    }).filter(Boolean);
  }

  /* ── 크게 보기 라이트박스 ─────────────────────────────────────── */

  let lightbox = null;

  function ensureLightbox() {
    if (lightbox) return lightbox;
    if (typeof document === "undefined" || typeof document.createElement !== "function" || !document.body) return null;

    const root = document.createElement("div");
    root.className = "notice-lightbox";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-hidden", "true");
    root.setAttribute("aria-label", "첨부 파일 크게 보기");

    const backdrop = document.createElement("div");
    backdrop.className = "notice-lightbox-backdrop";

    const panel = document.createElement("div");
    panel.className = "notice-lightbox-panel";

    const bar = document.createElement("div");
    bar.className = "notice-lightbox-bar";
    const title = document.createElement("span");
    title.className = "notice-lightbox-title";
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "notice-lightbox-close";
    closeButton.setAttribute("aria-label", "크게 보기 닫기");
    closeButton.textContent = "✕";
    bar.append(title, closeButton);

    const tools = document.createElement("div");
    tools.className = "notice-lightbox-tools";
    tools.setAttribute("role", "group");
    tools.setAttribute("aria-label", "확대 및 축소");
    const zoomButtons = [["fit", "맞춤"], ["1", "1x"], ["1.5", "1.5x"], ["2", "2x"]].map(([value, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("data-zoom", value);
      button.textContent = label;
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => applyZoom(value));
      tools.append(button);
      return button;
    });
    const hint = document.createElement("span");
    hint.className = "notice-lightbox-hint";
    hint.textContent = "끌어서 이동 · 두 손가락으로 확대";
    tools.append(hint);

    const viewport = document.createElement("div");
    viewport.className = "notice-lightbox-viewport";
    const stage = document.createElement("div");
    stage.className = "notice-lightbox-stage";
    viewport.append(stage);
    panel.append(bar, tools, viewport);
    root.append(backdrop, panel);
    document.body.append(root);

    let zoom = "fit";
    let kind = "image";
    let imageEl = null;
    let lastFocus = null;

    function applyZoom(mode) {
      zoom = mode;
      const scale = mode === "fit" ? 1 : (Number(mode) || 1);
      stage.style.width = `${scale * 100}%`;
      stage.style.height = mode === "fit" ? "100%" : `${scale * 100}%`;
      if (kind === "image" && imageEl) {
        imageEl.style.width = "100%";
        imageEl.style.height = "auto";
        imageEl.style.maxHeight = mode === "fit" ? "100%" : "none";
      }
      zoomButtons.forEach(button => {
        button.setAttribute("aria-pressed", button.getAttribute("data-zoom") === mode ? "true" : "false");
      });
      viewport.scrollTop = 0;
      viewport.scrollLeft = 0;
    }

    function close() {
      if (root.classList && !root.classList.contains("is-open")) return;
      if (root.classList) root.classList.remove("is-open");
      root.setAttribute("aria-hidden", "true");
      if (document.body && document.body.classList) document.body.classList.remove("notice-lightbox-open");
      stage.replaceChildren();
      imageEl = null;
      if (lastFocus && typeof lastFocus.focus === "function") {
        try { lastFocus.focus(); } catch (_) { /* ignore */ }
      }
      lastFocus = null;
    }

    function open(options = {}) {
      kind = options.kind === "drive" ? "drive" : "image";
      title.textContent = options.title || "첨부 파일";
      stage.replaceChildren();
      imageEl = null;
      if (kind === "image") {
        const image = document.createElement("img");
        image.alt = options.title || "첨부 이미지";
        image.decoding = "async";
        image.addEventListener("error", () => {
          const message = document.createElement("p");
          message.className = "notice-lightbox-error";
          message.textContent = "이 미리보기를 불러오지 못했습니다. 원본 열기를 이용해 주세요.";
          stage.replaceChildren(message);
        }, { once: true });
        image.src = options.src;
        imageEl = image;
        stage.append(image);
      } else {
        const frame = document.createElement("iframe");
        frame.title = `${options.title || "첨부 파일"} 미리보기`;
        frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
        frame.setAttribute("referrerpolicy", "no-referrer");
        frame.src = options.src;
        stage.append(frame);
      }
      lastFocus = document.activeElement || null;
      if (root.classList) root.classList.add("is-open");
      root.setAttribute("aria-hidden", "false");
      if (document.body && document.body.classList) document.body.classList.add("notice-lightbox-open");
      applyZoom("fit");
      if (typeof closeButton.focus === "function") closeButton.focus();
    }

    closeButton.addEventListener("click", close);
    backdrop.addEventListener("click", close);

    // 마우스로도 종횡 드래그 이동 (터치는 브라우저 기본 스크롤 사용)
    let drag = null;
    viewport.addEventListener("pointerdown", event => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      if (event.button != null && event.button > 0) return;
      drag = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
      if (viewport.classList) viewport.classList.add("is-dragging");
      if (typeof viewport.setPointerCapture === "function" && event.pointerId != null) {
        try { viewport.setPointerCapture(event.pointerId); } catch (_) { /* ignore */ }
      }
    });
    viewport.addEventListener("pointermove", event => {
      if (!drag) return;
      viewport.scrollLeft = drag.left - (event.clientX - drag.x);
      viewport.scrollTop = drag.top - (event.clientY - drag.y);
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(name => {
      viewport.addEventListener(name, () => {
        drag = null;
        if (viewport.classList) viewport.classList.remove("is-dragging");
      });
    });

    if (document.addEventListener) {
      document.addEventListener("keydown", event => {
        if (!root.classList || !root.classList.contains("is-open")) return;
        if (event.key === "Escape") {
          if (typeof event.preventDefault === "function") event.preventDefault();
          if (typeof event.stopPropagation === "function") event.stopPropagation();
          close();
        }
      }, true);
    }

    lightbox = { element: root, open, close, stage, viewport, applyZoom };
    return lightbox;
  }

  function openLightbox(options) {
    const viewer = ensureLightbox();
    if (!viewer) return null;
    viewer.open(options);
    return viewer;
  }

  function closeLightbox() {
    if (lightbox) lightbox.close();
  }

  function boot() {
    initScrollbars();
  }

  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
    else boot();
  }

  return {
    parse,
    previewFor,
    render,
    openLightbox,
    closeLightbox,
    attachScrollbar,
    initScrollbars,
    scrollbarGeometry,
  };
})();
