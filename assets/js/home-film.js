(function () {
  const film = document.getElementById("home-film");
  const caption = document.getElementById("home-film-caption");
  const progress = document.getElementById("home-film-progress");
  const toggle = document.getElementById("home-film-toggle");
  const next = document.getElementById("home-film-next");
  const controls = document.getElementById("home-film-controls");
  const fallback = document.getElementById("home-film-fallback");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const clips = [
    { title: "모여모양 웰컴센터", file: "center-home-highlight" },
    { title: "의기양양 두레동아리 워크숍", file: "center-home-workshop" },
    { title: "양양의 문화·공동체 활동", file: "center-home-community" }
  ];
  const unavailable = new Set();
  let queue = [];
  let current;
  let inViewport = typeof IntersectionObserver !== "function";
  let wantsPlayback = !reducedMotion.matches && !navigator.connection?.saveData;

  function shuffledClips(last) {
    const order = clips.filter(clip => !unavailable.has(clip));
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (order.length > 1 && order[0] === last) {
      order.push(order.shift());
    }
    return order;
  }

  function updatePlayback() {
    if (!wantsPlayback || !inViewport || document.hidden) {
      film.pause();
      return;
    }

    const clip = current;
    film.play().catch(error => {
      if (error.name === "NotAllowedError" && current === clip) {
        wantsPlayback = false;
      }
    });
  }

  function showNext() {
    if (!queue.length) queue = shuffledClips(current);
    if (!queue.length) {
      wantsPlayback = false;
      progress.style.transform = "scaleX(0)";
      film.removeAttribute("src");
      film.querySelector("source")?.remove();
      film.load();
      caption.textContent = "미리보기를 불러올 수 없습니다.";
      controls.hidden = true;
      fallback.hidden = false;
      return;
    }
    current = queue.shift();
    film.poster = `images/${current.file}.webp`;
    film.src = `assets/${current.file}.mp4`;
    film.setAttribute("aria-label", `${current.title} 활동영상, 음성 없음`);
    caption.textContent = current.title;
    progress.style.transform = "scaleX(0)";
    updatePlayback();
  }

  film.addEventListener("play", () => {
    toggle.textContent = "일시정지";
  });
  film.addEventListener("pause", () => {
    toggle.textContent = "재생";
  });
  film.addEventListener("timeupdate", () => {
    const amount = film.duration > 0 ? film.currentTime / film.duration : 0;
    progress.style.transform = `scaleX(${amount})`;
  });
  film.addEventListener("ended", showNext);
  film.addEventListener("error", () => {
    unavailable.add(current);
    queue = queue.filter(clip => clip !== current);
    showNext();
  });

  toggle.addEventListener("click", () => {
    wantsPlayback = film.paused;
    updatePlayback();
  });
  next.addEventListener("click", showNext);
  reducedMotion.addEventListener?.("change", event => {
    if (!event.matches) return;
    wantsPlayback = false;
    updatePlayback();
  });
  document.addEventListener("visibilitychange", updatePlayback);

  film.controls = false;
  controls.hidden = false;
  showNext();

  if (typeof IntersectionObserver === "function") {
    new IntersectionObserver(([entry]) => {
      inViewport = entry.isIntersecting && entry.intersectionRatio >= .15;
      updatePlayback();
    }, { threshold: .15 }).observe(film);
  }
})();
