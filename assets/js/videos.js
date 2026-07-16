window.VideosModule = (function(){
  let VIDEOS = [];
  const PREVIEW_LIMIT = 5;
  const PREVIEW_SECONDS = 8;
  const DEFAULT_POSTER = "images/hero-home.jpg";
  const DEFAULT_POSTER_ALT = "images/hero-home.svg";

  function safe(s){
    return window.CSVUtils.safeText(s).trim();
  }

  function normalizeHeader(h){
    return window.CSVUtils.normalizeHeader(h).toLowerCase();
  }

  function parseDateToTime(str){
    if(!str) return 0;
    const m = str.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
    if(!m) return 0;
    const y = m[1];
    const mo = m[2].padStart(2, "0");
    const d = m[3].padStart(2, "0");
    const dt = new Date(`${y}-${mo}-${d}`);
    const t = dt.getTime();
    return isNaN(t) ? 0 : t;
  }

  function slugify(input){
    const base = safe(input).toLowerCase();
    const slug = base
      .replace(/[^a-z0-9\u3131-\u318E\uAC00-\uD7A3\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return slug || "video";
  }

  function isActiveStatus(value){
    if(!value) return true;
    const v = safe(value).toLowerCase();
    if(v === "" || v === "active") return true;
    if(v.includes("활성") || v.includes("공개")) return true;
    if(v.includes("비공개") || v.includes("inactive")) return false;
    return true;
  }

  function buildIndexMap(headers){
    const norm = headers.map(normalizeHeader);

    const find = (pred) => norm.findIndex(pred);

    return {
      id: find(h => h.includes("id") || h.includes("번호") || h === "no"),
      type: find(h => h.includes("구분") || h.includes("분류") || h.includes("유형") || h.includes("type")),
      title: find(h => h.includes("제목") || h.includes("title")),
      date: find(h => h.includes("날짜") || h.includes("date")),
      url: find(h => h.includes("url") || h.includes("링크") || h.includes("영상링크") || h.includes("video") || h.includes("mp4")),
      thumbnail: find(h => h.includes("썸네일") || h.includes("thumbnail") || h.includes("이미지") || h.includes("poster")),
      content: find(h => h.includes("내용") || h.includes("설명") || h.includes("description") || h.includes("content") || h.includes("body")),
      status: find(h => h.includes("상태") || h.includes("status") || h.includes("공개"))
    };
  }

  function buildVideo(row, idx, colIndex){
    const title = colIndex.title >= 0 ? safe(row[colIndex.title]) : "";
    const date = colIndex.date >= 0 ? safe(row[colIndex.date]) : "";
    const url = colIndex.url >= 0 ? safe(row[colIndex.url]) : "";
    const thumbnail = colIndex.thumbnail >= 0 ? safe(row[colIndex.thumbnail]) : "";
    const content = colIndex.content >= 0 ? safe(row[colIndex.content]) : "";
    const type = colIndex.type >= 0 ? safe(row[colIndex.type]) : "활동영상";
    const idRaw = colIndex.id >= 0 ? safe(row[colIndex.id]) : "";
    const id = idRaw || `${slugify(title)}-${idx + 1}`;
    return {
      id,
      type: type || "활동영상",
      title,
      date,
      url,
      thumbnail,
      content,
      time: parseDateToTime(date)
    };
  }

  async function load(){
    const url = window.SHEET_CONFIG?.videos?.csvUrl;
    if(!url) return;

    try{
      const rows = await window.CSVUtils.fetchCSV(url);
      if(!rows.length) return;

      const headers = rows[0].map(h => safe(h));
      const dataRows = rows.slice(1);
      const colIndex = buildIndexMap(headers);

      VIDEOS = dataRows
        .filter(r => r[colIndex.title] && safe(r[colIndex.title]) !== "")
        .filter(r => colIndex.status < 0 || isActiveStatus(r[colIndex.status]))
        .map((row, idx) => buildVideo(row, idx, colIndex))
        .sort((a,b) => (b.time || 0) - (a.time || 0));

      renderPreview();
      renderList();
      renderDetail();
    }catch(err){
      console.error("활동영상 로딩 오류:", err);
      renderPreviewError();
      renderListError();
      renderDetailError();
    }
  }

  function renderPreview(){
    const tbody = document.getElementById("video-preview-tbody");
    if(!tbody) return;

    if(!VIDEOS.length){
      renderHeroPreview(null);
      tbody.innerHTML = `
        <tr><td colspan="2" class="video-empty">등록된 활동영상이 없습니다.</td></tr>
      `;
      return;
    }

    const items = VIDEOS.slice(0, PREVIEW_LIMIT);
    tbody.innerHTML = "";

    items.forEach(v => {
      const tr = document.createElement("tr");
      const titleTd = document.createElement("td");
      const dateTd = document.createElement("td");

      titleTd.className = "video-title";
      const a = document.createElement("a");
      a.href = `video-detail.html?id=${encodeURIComponent(v.id)}`;
      a.textContent = v.title;
      titleTd.appendChild(a);

      dateTd.className = "video-date";
      dateTd.textContent = v.date;

      tr.appendChild(titleTd);
      tr.appendChild(dateTd);
      tbody.appendChild(tr);
    });

    renderHeroPreview(VIDEOS[0]);
  }

  function renderHeroPreview(video){
    const mediaLink = document.getElementById("video-preview-media");
    const videoEl = document.getElementById("video-preview-video");
    const imageEl = document.getElementById("video-preview-image");
    const titleEl = document.getElementById("video-preview-title");
    const metaEl = document.getElementById("video-preview-meta");
    const descEl = document.getElementById("video-preview-desc");
    const heroMini = document.querySelector(".hero-hotspot-media-preview");
    const heroMiniVideo = document.querySelector(".hero-hotspot-media-video");
    const heroThumbVideo = document.querySelector(".hero-video-thumb-media");

    if(!mediaLink || !videoEl || !imageEl || !titleEl || !metaEl || !descEl){
      return;
    }

    if(!video){
      titleEl.textContent = "활동영상";
      titleEl.href = "videos.html";
      metaEl.textContent = "";
      descEl.textContent = "등록된 활동영상이 없습니다.";
      videoEl.style.display = "none";
      imageEl.style.display = "none";
      if(heroMini){
        heroMini.style.backgroundImage = `url('${DEFAULT_POSTER}')`;
      }
      if(heroMiniVideo){
        heroMiniVideo.removeAttribute("src");
        heroMiniVideo.poster = DEFAULT_POSTER;
      }
      if(heroThumbVideo){
        heroThumbVideo.removeAttribute("src");
        heroThumbVideo.poster = DEFAULT_POSTER;
      }
      return;
    }

    const detailHref = `video-detail.html?id=${encodeURIComponent(video.id)}`;
    titleEl.textContent = video.title || "활동영상";
    titleEl.href = detailHref;
    metaEl.textContent = `${video.type || "활동영상"} · ${video.date || ""}`.trim();
    descEl.textContent = video.content ? truncateText(video.content, 140) : "영상 상세 내용은 상세페이지에서 확인하실 수 있습니다.";

    mediaLink.href = "videos.html";

    if(video.url && isVideoFile(video.url)){
      videoEl.src = video.url;
      videoEl.poster = video.thumbnail || DEFAULT_POSTER;
      videoEl.style.display = "block";
      imageEl.style.display = "none";
      videoEl.loop = false;
      videoEl.onloadedmetadata = () => {
        if(videoEl.duration && videoEl.duration < PREVIEW_SECONDS){
          videoEl.loop = true;
        }else{
          videoEl.currentTime = 0;
        }
      };
      videoEl.ontimeupdate = () => {
        if(videoEl.duration && videoEl.duration >= PREVIEW_SECONDS && videoEl.currentTime >= PREVIEW_SECONDS){
          videoEl.pause();
          videoEl.currentTime = 0;
          setTimeout(() => {
            videoEl.play().catch(()=>{});
          }, 800);
        }
      };
      videoEl.play().catch(()=>{});
    }else if(video.thumbnail){
      imageEl.src = video.thumbnail;
      imageEl.style.display = "block";
      videoEl.style.display = "none";
    }else{
      imageEl.style.display = "none";
      videoEl.style.display = "none";
    }

    if(heroMini){
      const miniSrc = video.thumbnail || DEFAULT_POSTER;
      heroMini.style.backgroundImage = `url('${miniSrc}')`;
    }
    if(heroMiniVideo){
      heroMiniVideo.src = video.url || "";
      heroMiniVideo.poster = video.thumbnail || DEFAULT_POSTER;
      heroMiniVideo.play().catch(()=>{});
    }
    if(heroThumbVideo){
      heroThumbVideo.src = video.url || "";
      heroThumbVideo.poster = video.thumbnail || DEFAULT_POSTER;
      heroThumbVideo.loop = false;
      heroThumbVideo.onloadedmetadata = () => {
        if(heroThumbVideo.duration && heroThumbVideo.duration < PREVIEW_SECONDS){
          heroThumbVideo.loop = true;
        }else{
          heroThumbVideo.currentTime = 0;
        }
      };
      heroThumbVideo.ontimeupdate = () => {
        if(heroThumbVideo.duration && heroThumbVideo.duration >= PREVIEW_SECONDS && heroThumbVideo.currentTime >= PREVIEW_SECONDS){
          heroThumbVideo.pause();
          heroThumbVideo.currentTime = 0;
          setTimeout(() => {
            heroThumbVideo.play().catch(()=>{});
          }, 800);
        }
      };
      heroThumbVideo.play().catch(()=>{});
    }
  }

  function truncateText(text, max){
    const clean = safe(text).replace(/\s+/g, " ").trim();
    if(clean.length <= max) return clean;
    return clean.slice(0, max - 1) + "…";
  }

  function renderPreviewError(){
    const tbody = document.getElementById("video-preview-tbody");
    if(!tbody) return;
    tbody.innerHTML = `
      <tr><td colspan="3" class="video-empty">활동영상을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</td></tr>
    `;
  }

  function renderList(){
    const list = document.getElementById("video-list");
    if(!list) return;

    if(!VIDEOS.length){
      list.innerHTML = `<div class="video-empty">등록된 활동영상이 없습니다.</div>`;
      return;
    }

    list.innerHTML = "";
    VIDEOS.forEach(v => {
      const card = document.createElement("article");
      card.className = "video-card";

      const thumb = v.thumbnail || "";
      const fallbackPoster = thumb || DEFAULT_POSTER;
      const hasValidPoster = Boolean(fallbackPoster);
      let mediaHtml = "";
      if(v.url && isVideoFile(v.url)){
        const posterAttr = ` poster="${fallbackPoster}"`;
        mediaHtml = `
          <img class="video-card-poster" src="${fallbackPoster}" data-fallback="${DEFAULT_POSTER_ALT}" alt="${v.title}" />
          <video class="video-card-video" muted playsinline preload="metadata"${posterAttr} src="${v.url}" style="display:none;"></video>
        `;
      }else if(thumb){
        mediaHtml = `<img src="${thumb}" data-fallback="${DEFAULT_POSTER_ALT}" alt="${v.title}" />`;
      }else{
        mediaHtml = `<img src="${DEFAULT_POSTER}" data-fallback="${DEFAULT_POSTER_ALT}" alt="${v.title}" />`;
      }

      card.innerHTML = `
        <div class="video-card-thumb" style="${hasValidPoster ? `background-image:url('${fallbackPoster}');background-size:cover;background-position:center;` : ""}">${mediaHtml}</div>
        <div class="video-card-body">
          <div class="video-card-type">${v.type || "활동영상"}</div>
          <h3 class="video-card-title">${v.title}</h3>
          <div class="video-card-date">${v.date || ""}</div>
          <a class="video-card-link" href="video-detail.html?id=${encodeURIComponent(v.id)}">자세히 보기</a>
        </div>
      `;

      list.appendChild(card);
    });

    const previewImages = list.querySelectorAll(".video-card-thumb img");
    previewImages.forEach(img => {
      img.addEventListener("error", () => {
        const fallback = img.getAttribute("data-fallback");
        if(fallback && img.src.indexOf(fallback) === -1){
          img.src = fallback;
        }
      });
    });

    const previewVideos = list.querySelectorAll(".video-card-video");
    previewVideos.forEach(video => {
      const wrapper = video.closest(".video-card-thumb");
      const posterImg = wrapper ? wrapper.querySelector(".video-card-poster") : null;

      video.addEventListener("loadedmetadata", () => {
        try{
          video.currentTime = 0.1;
        }catch(e){
          // ignore
        }
      });
      video.addEventListener("seeked", () => {
        video.pause();
      });
      video.addEventListener("error", () => {
        if(posterImg){
          posterImg.style.display = "block";
        }
        video.style.display = "none";
      });
    });
  }

  function renderListError(){
    const list = document.getElementById("video-list");
    if(!list) return;
    list.innerHTML = `<div class="video-empty">활동영상을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>`;
  }

  function getQueryId(){
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
  }

  function isVideoFile(url){
    return /\.(mp4|webm|ogg)(\?|$)/i.test(url || "");
  }

  function isYouTube(url){
    return /youtu\.be|youtube\.com/.test(url || "");
  }

  function getYouTubeId(url){
    if(!url) return "";
    const short = url.match(/youtu\.be\/([^?]+)/);
    if(short) return short[1];
    const long = url.match(/v=([^&]+)/);
    return long ? long[1] : "";
  }

  function renderDetail(){
    const wrap = document.getElementById("video-detail");
    if(!wrap) return;

    const id = getQueryId();
    if(!id){
      wrap.innerHTML = `<div class="video-empty">영상 정보를 찾을 수 없습니다.</div>`;
      return;
    }

    const video = VIDEOS.find(v => v.id === id);
    if(!video){
      wrap.innerHTML = `<div class="video-empty">영상 정보를 찾을 수 없습니다.</div>`;
      return;
    }

    const mediaWrap = document.createElement("div");
    mediaWrap.className = "video-detail-media";

    if(video.url && isYouTube(video.url)){
      const ytId = getYouTubeId(video.url);
      if(ytId){
        mediaWrap.innerHTML = `
          <div class="video-embed">
            <iframe src="https://www.youtube.com/embed/${ytId}" title="${video.title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
          </div>
        `;
      }
    }else if(video.url && isVideoFile(video.url)){
      const poster = video.thumbnail || DEFAULT_POSTER;
      mediaWrap.innerHTML = `
        <video controls playsinline preload="metadata" src="${video.url}" poster="${poster}"></video>
      `;
    }else if(video.thumbnail){
      mediaWrap.innerHTML = `<img src="${video.thumbnail}" alt="${video.title}" />`;
    }

    const desc = video.content || "";
    const descHtml = desc
      ? desc.replace(/\r\n|\r|\n/g, "<br>")
      : "상세 설명이 등록되어 있지 않습니다.";

    wrap.innerHTML = `
      <div class="video-detail-header">
        <div class="video-detail-type">${video.type || "활동영상"}</div>
        <h1 class="video-detail-title">${video.title}</h1>
        <div class="video-detail-date">${video.date || ""}</div>
      </div>
      <div class="video-detail-body">
        ${mediaWrap.outerHTML}
        <div class="video-detail-desc">${descHtml}</div>
      </div>
    `;
  }

  function renderDetailError(){
    const wrap = document.getElementById("video-detail");
    if(!wrap) return;
    wrap.innerHTML = `<div class="video-empty">활동영상을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>`;
  }

  return { load };
})();
