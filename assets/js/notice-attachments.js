window.NoticeAttachments = (function () {
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

  function previewFor(value, photo = false) {
    const url = webUrl(value);
    if (!url || url.protocol !== "https:") return null;
    if (url.origin === "https://drive.google.com") {
      const id = url.pathname.match(/^\/file\/d\/([\w-]+)(?:\/|$)/)?.[1]
        || (/^\/(open|uc)$/.test(url.pathname) ? url.searchParams.get("id") : "");
      if (!id || !/^[\w-]+$/.test(id)) return null;
      const preview = new URL(`https://drive.google.com/file/d/${id}/preview`);
      const resourceKey = url.searchParams.get("resourcekey");
      if (resourceKey) preview.searchParams.set("resourcekey", resourceKey);
      return { kind: "drive", url: preview.href };
    }
    return photo || /\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(url.pathname)
      ? { kind: "image", url: url.href } : null;
  }

  function render(container, files, { photo = false } = {}) {
    if (!container) return;
    container.replaceChildren();
    files.forEach(file => {
      const url = webUrl(file.url);
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
        const image = document.createElement("img");
        image.alt = file.name;
        image.loading = "lazy";
        image.decoding = "async";
        image.addEventListener("error", () => {
          const message = document.createElement("p");
          message.textContent = "이미지를 불러오지 못했습니다. 원본 열기를 이용해 주세요.";
          image.replaceWith(message);
        }, { once: true });
        image.src = preview.url;
        card.append(image);
      } else if (preview?.kind === "drive") {
        const frame = document.createElement("iframe");
        frame.title = `${file.name} 미리보기`;
        frame.loading = "lazy";
        frame.referrerPolicy = "no-referrer";
        frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
        frame.src = preview.url;
        card.append(frame);
      }
      container.append(card);
    });
  }

  return { parse, previewFor, render };
})();
