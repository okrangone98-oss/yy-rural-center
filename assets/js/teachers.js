window.TeachersModule = (function () {
  let TEACHERS = [];

  const SHEET_URL = window.SHEET_CONFIG.teachers.csvUrl;
  const ITEMS_PER_PAGE = 20;

  // --- 북마크(관심 강사) 데이터 관리 ---
  function getFavorites() {
    const favs = localStorage.getItem('iumteo_favorites');
    return favs ? JSON.parse(favs) : [];
  }

  function toggleFavorite(teacherName) {
    let favs = getFavorites();
    if (favs.includes(teacherName)) {
      favs = favs.filter(n => n !== teacherName);
    } else {
      favs.push(teacherName);
    }
    localStorage.setItem('iumteo_favorites', JSON.stringify(favs));
    
    // 현재 필터링 상태 유지하며 재렌더링
    const activeBtn = document.querySelector('.filter-btn.active');
    const currentFilter = activeBtn ? activeBtn.getAttribute('data-filter') : '전체';
    render(currentFilter);
  }

  async function load() {
    const url = window.SHEET_CONFIG?.teachers?.csvUrl;
    const fallbackUrl = window.SHEET_CONFIG?.teachers?.fallbackUrl;
    const useFallback = window.IUMTEO_DATA_SOURCE?.teachers?.useSampleFallback;

    async function fetchFromUrl(targetUrl) {
      if (!targetUrl) return [];
      try {
        console.log("[TeachersModule] Fetching:", targetUrl);
        const rows = await window.CSVUtils.fetchCSV(targetUrl);
        if (!rows || rows.length <= 1) return [];

        const headers = rows[0].map(h => window.CSVUtils.safeText(h).trim());
        const dataRows = rows.slice(1);
        const norm = headers.map(window.CSVUtils.normalizeHeader);

        // 헤더 매핑 유연성 강화 (다양한 표현 대응)
        const colIdx = {
          name: norm.findIndex(h => h.includes("성명") || h.includes("이름") || h.includes("name") || h.includes("성함")),
          org: norm.findIndex(h => h.includes("소속") || h.includes("org") || h.includes("기관")),
          field: norm.findIndex(h => h.includes("상세내용") || h.includes("field") || h.includes("활동내용") || h.includes("전문분야")),
          career: norm.findIndex(h => h.includes("주요경력") || h.includes("경력") || h.includes("career") || h.includes("이력")),
          email: norm.findIndex(h => h.includes("이메일") || h.includes("email") || h.includes("메일")),
          instagram: norm.findIndex(h => h.includes("인스타그램") || h.includes("instagram") || h.includes("SNS")),
          instaPublic: norm.findIndex(h => h.includes("인스타공개") || h.includes("공개여부") || h.includes("instapublic") || h.includes("showinsta")),
          category: norm.findIndex(h => h.includes("강의분야") || h.includes("카테고리") || h.includes("분류") || h.includes("category")),
          status: norm.findIndex(h => h.includes("상태") || h.includes("status") || h.includes("승인여부") || h.includes("승인")),
          consent: norm.findIndex(h => h.includes("동의") || h.includes("consent") || h.includes("정보공개")),
          local: norm.findIndex(h => h.includes("로컬") || h.includes("local") || h.includes("양양거주")),
          photo: norm.findIndex(h => h.includes("사진") || h.includes("프로필") || h.includes("이미지") || h.includes("photo")),
          isSample: norm.findIndex(h => h.includes("샘플") || h.includes("sample") || h.includes("테스트"))
        };

        const storageConfig = window.IUMTEO_STORAGE_CONFIG?.instructorRegister || {
          storageBucket: "instructor-register.firebasestorage.app",
          legacyProfilePhotoFolder: "profile_photos"
        };

        return dataRows.map((r, idx) => {
          const name = window.CSVUtils.safeText(r[colIdx.name]).trim();
          const rawStatus = window.CSVUtils.safeText(r[colIdx.status]).trim();
          
          return {
            rowIndex: idx + 2,
            name: name,
            org: window.CSVUtils.safeText(r[colIdx.org]).trim(),
            field: window.CSVUtils.safeText(r[colIdx.field]).trim(),
            career: window.CSVUtils.safeText(r[colIdx.career]).trim(),
            email: window.CSVUtils.safeText(r[colIdx.email]).trim(),
            instagram: window.CSVUtils.safeText(r[colIdx.instagram]).trim(),
            instaPublic: window.CSVUtils.safeText(r[colIdx.instaPublic]).trim(),
            category: window.CSVUtils.safeText(r[colIdx.category]).trim() || "기타",
            status: rawStatus,
            consent: window.CSVUtils.safeText(r[colIdx.consent]).trim(),
            isLocal: colIdx.local >= 0 ? /Y|예|네|true/i.test(window.CSVUtils.safeText(r[colIdx.local])) : false,
            isSample: colIdx.isSample >= 0 ? /Y|예|네|true/i.test(window.CSVUtils.safeText(r[colIdx.isSample])) : false,
            profile_photo: colIdx.photo >= 0 && window.CSVUtils.safeText(r[colIdx.photo]).trim() !== ""
              ? (window.CSVUtils.safeText(r[colIdx.photo]).trim().startsWith("http")
                ? window.CSVUtils.safeText(r[colIdx.photo]).trim()
                : `https://firebasestorage.googleapis.com/v0/b/${storageConfig.storageBucket}/o/${encodeURIComponent(`${storageConfig.legacyProfilePhotoFolder}/${window.CSVUtils.safeText(r[colIdx.photo]).trim()}`)}?alt=media`)
              : "",
            _row: r
          };
        }).filter(t => t.name !== "").filter(t => {
          // 승인된 데이터만 필터링 (샘플 데이터거나 상태가 승인/활성 계열일 때)
          if (colIdx.status < 0) return true;
          const st = (t.status || "").trim();
          return st === "승인" || st === "활성" || /active|approved|y|예/i.test(st) || t.isSample;
        });
      } catch (err) {
        console.warn("[TeachersModule] Fetch Error:", err);
        return [];
      }
    }

    try {
      // 1. 기본 시트 시도
      TEACHERS = await fetchFromUrl(url);

      // 2. 기본 시트 데이터가 없으면 샘플 시트(fallbackUrl) 시도
      if (TEACHERS.length === 0 && fallbackUrl && useFallback) {
        console.log("[TeachersModule] No primary data. Trying fallbackUrl...");
        TEACHERS = await fetchFromUrl(fallbackUrl);
        TEACHERS.forEach(t => { t.isSample = true; });
      }

      // 3. 최후의 보루: config.js에 정의된 정적 샘플
      if (TEACHERS.length === 0 && useFallback && window.IUMTEO_SAMPLE_DATA?.teachers) {
        console.log("[TeachersModule] Using static sample data from config.js");
        TEACHERS = window.IUMTEO_SAMPLE_DATA.teachers.map((t) => ({
          ...t,
          rowIndex: -1,
          isSample: true,
          status: t.status || "승인"
        }));
      }

      console.log("[TeachersModule] Loaded teachers count:", TEACHERS.length);
      render("전체");
      
      // 사용자 수 연동 함수가 정의되어 있다면 호출
      if (typeof window.loadUserCount === 'function') {
        window.loadUserCount();
      }
    } catch (err) {
      console.error("[TeachersModule] Critical Load Error:", err);
    }
  }

  function normalizeCategory(value) {
    return (value || "")
      .toString()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace("레크레이션", "레크리에이션");
  }

  let _page = 1;
  let _lastTarget = [];

  function render(filterCategory) {
    const listEl = document.getElementById("teacher-list");
    if (!listEl) return;

    const normFilter = normalizeCategory(filterCategory);

    let target = [];
    if (filterCategory === '북마크') {
      const favs = getFavorites();
      target = TEACHERS.filter(t => favs.includes(t.name));
    } else if (filterCategory && filterCategory !== "전체") {
      target = TEACHERS.filter(t => {
        const normCat = normalizeCategory(t.category);
        return normCat.includes(normFilter) || normFilter.includes(normCat);
      });
    } else {
      target = TEACHERS;
    }

    const searchInput = document.getElementById("teacher-search-input");
    const searchVal = searchInput ? searchInput.value.trim().toLowerCase() : "";

    const finalTarget = target.filter(t => {
      // 검색어 필터링
      if (!searchVal) return true;
      return (t.name || "").toLowerCase().includes(searchVal) ||
        (t.field || "").toLowerCase().includes(searchVal) ||
        (t.career || "").toLowerCase().includes(searchVal) ||
        (t.org || "").toLowerCase().includes(searchVal);
    });

    _lastTarget = finalTarget;
    _page = 1;
    _renderPage();
  }

  function _renderPage() {
    const listEl = document.getElementById("teacher-list");
    if (!listEl) return;

    // 홈페이지 판별 로직 고도화 (ID 기반)
    const isHomePage = !!document.getElementById('about');
    const HOME_PREVIEW_LIMIT = 8;

    const total = _lastTarget.length;

    let slice;
    let totalPages = 1;
    if (isHomePage) {
      slice = _lastTarget.slice(0, HOME_PREVIEW_LIMIT);
    } else {
      totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
      if (_page > totalPages) _page = totalPages;
      slice = _lastTarget.slice((_page - 1) * ITEMS_PER_PAGE, _page * ITEMS_PER_PAGE);
    }

    listEl.innerHTML = "";
    if (slice.length === 0) {
      listEl.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: #999; background: #fff; border-radius: 16px; border: 1px dashed #ddd;">
          <div style="font-size: 2rem; margin-bottom: 15px;">🔍</div>
          <p style="margin:0;">현재 조건에 맞는 강사님이 없습니다.</p>
        </div>`;
    } else {
      slice.forEach(t => {
        const careerText = (t.career || "").split('\n')[0];
        const shortCareer = careerText.length > 50 ? careerText.slice(0, 50) + "…" : careerText;

        const card = document.createElement("article");
        // 이음터 스타일 카드 (숨고 스타일) - teachers.js 내 공통 렌더링용 인라인 스타일 적용
        card.style.cssText = `
          background: #fff; border-radius: 16px; border: 1px solid #eaeaea;
          padding: 25px; display: flex; flex-direction: column;
          transition: transform 0.2s, box-shadow 0.2s; cursor: pointer;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.02);
          position: relative;
        `;
        card.onmouseover = () => { card.style.transform = 'translateY(-3px)'; card.style.boxShadow = '0 10px 25px rgba(0,0,0,0.08)'; };
        card.onmouseout = () => { card.style.transform = 'none'; card.style.boxShadow = '0 4px 15px rgba(0,0,0,0.02)'; };

        const favs = getFavorites();
        const isFav = favs.includes(t.name);

        // 인증 상태 확인
        let iumteoAuth = { isLoggedIn: false, role: 'GUEST', user: null };
        try {
          const saved = sessionStorage.getItem('iumteo_auth');
          if (saved) iumteoAuth = JSON.parse(saved);
        } catch (e) {}
        const isLoggedIn = iumteoAuth.isLoggedIn;
        const isGuest = iumteoAuth.role === 'GUEST';

        // 컬러링
        const pastels = ['#f0f7f4', '#fdf7f0', '#f4f7fd', '#faf4fd'];
        const textColors = ['#086550', '#e67e22', '#2980b9', '#8e44ad'];
        const sumAscii = (t.name || '?').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const colorIndex = sumAscii % pastels.length;

        const pto = (!isGuest && t.profile_photo) ? t.profile_photo : null;
        const char = (t.name || '?')[0];
        const photoHtml = pto
          ? `<img src="${pto}" style="width:100%; height:100%; object-fit:cover;" onerror="this.outerHTML='<div style=\\'width:100%;height:100%;background:${pastels[colorIndex]};display:flex;align-items:center;justify-content:center;color:${textColors[colorIndex]};font-weight:bold;font-size:1.5rem;\\'>${char}</div>'">`
          : `<div style="width:100%;height:100%;background:${pastels[colorIndex]};display:flex;align-items:center;justify-content:center;color:${textColors[colorIndex]};font-weight:bold;font-size:1.5rem;">${isGuest ? '🔒' : char}</div>`;

        card.innerHTML = `
          <button class="teacher-fav-btn ${isFav ? 'is-fav' : ''}" 
                  onclick="event.stopPropagation(); window.TeachersModule.toggleFavorite('${t.name}')"
                  style="position:absolute; top:15px; right:15px; background:none; border:none; font-size:1.4rem; cursor:pointer; color:${isFav ? '#e74c3c' : '#ccc'}; z-index: 5; padding:0;">
            ${isFav ? '❤️' : '🤍'}
          </button>
          
          <div style="display:flex; gap: 15px; margin-bottom: 20px;">
            <div style="width: 70px; height: 70px; border-radius: 50%; overflow: hidden; background: #f0f0f0; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 2px solid #fff;">
              ${photoHtml}
            </div>
            <div style="flex: 1; padding-top: 5px; text-align: left;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #333;">${t.name}</h3>
                ${t.isLocal ? '<span style="background:var(--primary); color:#fff; font-size:0.65rem; padding:2px 8px; border-radius:12px; font-weight:700;">로컬</span>' : ''}
              </div>
              <div style="font-size: 0.85rem; color: var(--primary); font-weight: 600; margin-top: 5px;">
                ${t.category || '기타'}
              </div>
            </div>
          </div>

          <div style="flex: 1; margin-bottom: 20px; text-align: left;">
            <div style="font-size: 0.95rem; color: #444; margin-bottom: 8px; font-weight: 600; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
              ${t.field || '강의 분야 상세 정보 없음'}
            </div>
            <div style="font-size: 0.85rem; color: #888; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.5;">
              ${t.org ? t.org + ' · ' : ''}${isLoggedIn ? shortCareer : '🔒 약력 보기는 로그인 후 가능'}
            </div>
          </div>

          <div style="display: flex; gap: 8px; margin-top: auto;">
            <button class="btn" style="flex: 1; padding: 10px; font-size: 0.9rem; background: #f8f9fa; border: 1px solid #ebebeb; color: #555;" 
                    onclick="event.stopPropagation(); window.TeachersModule.handleViewDetails(${t.rowIndex}, ${isHomePage})">
              📄 약력 보기
            </button>
            <button class="btn btn-primary" style="flex: 1; padding: 10px; font-size: 0.9rem;" 
                    onclick="event.stopPropagation(); window.TeachersModule.handleInquiry('${t.name}', '${t.profile_photo || ''}')" >
              ${isGuest ? '🔒 활동 문의' : '📩 활동 문의'}
            </button>
          </div>
        `;
        
        card.onclick = () => window.TeachersModule.handleViewDetails(t.rowIndex, isHomePage);
        listEl.appendChild(card);
      });
    }

    if (!isHomePage && totalPages > 1) {
      _renderPagination(totalPages);
    }
  }

  // 홈페이지/플랫폼 공통 핸들러
  function handleViewDetails(rowIndex, isHomePage) {
    if (isHomePage) {
      const targetTeacher = TEACHERS.find((teacher) => teacher.rowIndex === rowIndex);
      location.href = targetTeacher && targetTeacher.name
        ? `https://app.yycenter.kr/teacher/${encodeURIComponent(targetTeacher.name)}`
        : 'https://app.yycenter.kr/instructors';
    } else {
      if (typeof window.showTeacherDetails === 'function') {
        window.showTeacherDetails(rowIndex, true);
      }
    }
  }

  function handleInquiry(name, photo) {
    let iumteoAuth = { isLoggedIn: false };
    try {
      const saved = sessionStorage.getItem('iumteo_auth');
      if (saved) iumteoAuth = JSON.parse(saved);
    } catch (e) {}

    if (!iumteoAuth.isLoggedIn) {
      alert('회원가입 후 활동 문의 기능을 이용하실 수 있습니다.');
      if (typeof window.openAuthDrawer === 'function') {
        window.openAuthDrawer('user');
      } else {
        location.href = 'https://app.yycenter.kr/register?type=user';
      }
    } else {
      if (typeof window.openInquiryModal === 'function') {
        window.openInquiryModal(name, photo);
      } else {
        location.href = `https://app.yycenter.kr/teacher/${encodeURIComponent(name)}`;
      }
    }
  }

  function _renderPagination(totalPages) {
    const listEl = document.getElementById("teacher-list");
    const nav = document.createElement("div");
    nav.className = "teacher-pagination";
    nav.style.cssText = "grid-column: 1/-1; display: flex; justify-content: center; gap: 8px; margin-top: 40px;";
    
    // 이전 버튼
    const prev = document.createElement("button");
    prev.innerHTML = "‹";
    prev.disabled = _page === 1;
    prev.onclick = () => { _page--; _renderPage(); };
    nav.appendChild(prev);

    // 페이지 번호
    for (let i = 1; i <= totalPages; i++) {
        const pBtn = document.createElement("button");
        pBtn.textContent = i;
        if (i === _page) pBtn.className = "active";
        pBtn.onclick = () => { _page = i; _renderPage(); };
        nav.appendChild(pBtn);
    }

    // 다음 버튼
    const next = document.createElement("button");
    next.innerHTML = "›";
    next.disabled = _page === totalPages;
    next.onclick = () => { _page++; _renderPage(); };
    nav.appendChild(next);

    listEl.parentElement.appendChild(nav);
  }

  function bindFilterButtons() {
    const btns = document.querySelectorAll(".filter-btn");
    btns.forEach(btn => {
      btn.addEventListener("click", () => {
        btns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        render(btn.getAttribute("data-filter"));
      });
    });
    
    // 검색창 엔터키 연동
    const searchInput = document.getElementById("teacher-search-input");
    if (searchInput) {
      searchInput.addEventListener("keyup", (e) => {
        if (e.key === "Enter") {
          const activeBtn = document.querySelector(".filter-btn.active");
          const currentFilter = activeBtn ? activeBtn.getAttribute("data-filter") : "전체";
          render(currentFilter);
        }
      });
    }
  }

  return {
    load,
    render,
    bindFilterButtons,
    toggleFavorite,
    handleViewDetails,
    handleInquiry,
    getTeachers: () => TEACHERS
  };
})();
