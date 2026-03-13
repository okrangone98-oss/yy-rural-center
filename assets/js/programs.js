window.ProgramsModule = (function(){
  let PROGRAMS = [];
  let currentYear = "";
  let currentCategory = "전체";

  function init(){
    const cfg = window.SHEET_CONFIG?.programs || {};
    const years = getAvailableYears(cfg);
    currentYear = years.length ? years[0] : "2025";

    buildYearTabs();
    load(currentYear);
  }

  function buildYearTabs(){
    const yearWrap = document.getElementById("program-year-tabs");
    if(!yearWrap) return;

    yearWrap.innerHTML = "";

    const cfg = window.SHEET_CONFIG?.programs || {};
    const years = getAvailableYears(cfg);
    years.forEach(y=>{
      const btn = document.createElement("button");
      btn.type="button";
      btn.className = "program-tab-btn" + (y===currentYear ? " is-active" : "");
      btn.dataset.year = y;
      btn.textContent = `${y} 주요사업`;
      yearWrap.appendChild(btn);
    });

    yearWrap.addEventListener("click",(e)=>{
      const btn = e.target.closest(".program-tab-btn");
      if(!btn) return;
      currentYear = btn.dataset.year;
      yearWrap.querySelectorAll(".program-tab-btn").forEach(b=>{
        b.classList.toggle("is-active", b===btn);
      });

      // reset category
      currentCategory = "전체";
      load(currentYear);
    });
  }

  async function load(year){
    const url = window.SHEET_CONFIG?.programs?.[year];
    if(!url || url.startsWith("PASTE_")){
      renderError(`'${year}' 주요사업 시트 URL이 설정되지 않았습니다.`);
      return;
    }

    try{
      const rows = await window.CSVUtils.fetchCSV(url);
      if(!rows.length) return;

      const headers = rows[0].map(h => window.CSVUtils.safeText(h).trim());
      const dataRows = rows.slice(1);
      const norm = headers.map(window.CSVUtils.normalizeHeader);

      const colIndex = {
        category: norm.findIndex(h => h.includes("카테고리") || h.includes("category")),
        title:    norm.findIndex(h => h.includes("제목")     || h.includes("title")),
        desc:     norm.findIndex(h => h.includes("설명")     || h.includes("desc")),
        meta:     norm.findIndex(h => h.includes("대상") || h.includes("과정") || h.includes("meta")),
        sort:     norm.findIndex(h => h.includes("정렬") || h.includes("sort")),
        status:   norm.findIndex(h => h.includes("상태") || h.includes("status")),
      };

      PROGRAMS = dataRows
        .filter(r => r[colIndex.title] && window.CSVUtils.safeText(r[colIndex.title]).trim() !== "")
        .filter(r=>{
          if(colIndex.status<0) return true;
          const st=window.CSVUtils.safeText(r[colIndex.status]).trim();
          return st==="" || st==="활성" || st.toLowerCase()==="active";
        })
        .map(r => ({
          category: colIndex.category >= 0 ? window.CSVUtils.safeText(r[colIndex.category]).trim() : "기타",
          title:    window.CSVUtils.safeText(r[colIndex.title]).trim(),
          desc:     colIndex.desc >= 0 ? window.CSVUtils.safeText(r[colIndex.desc]).trim() : "",
          meta:     colIndex.meta >= 0 ? window.CSVUtils.safeText(r[colIndex.meta]).trim() : "",
          sort:     colIndex.sort >= 0 ? parseInt(window.CSVUtils.safeText(r[colIndex.sort]).trim()||"0",10) : 0
        }))
        .sort((a,b)=>a.sort-b.sort);

      buildCategoryTabs();
      renderCards();
      updateYearSubtitle();
    }catch(e){
      console.error("주요 사업 로딩 오류:", e);
      renderError("주요 사업 정보를 불러오지 못했습니다.");
    }
  }

  function updateYearSubtitle(){
    const el = document.getElementById("program-year-subtitle");
    if(!el) return;
    const cfg = window.SHEET_CONFIG?.programs || {};
    const years = getAvailableYears(cfg);
    const latest = years[0];
    if(currentYear === latest){
      el.textContent = `${latest}년 주요 사업(신설/개편 포함)을 확인할 수 있습니다.`;
    }else{
      el.textContent = `${currentYear}년 주요 사업 아카이브(기록)입니다. 현행 담당/구성은 ${latest}와 다를 수 있습니다.`;
    }
  }

  function getAvailableYears(cfg){
    return Object.keys(cfg)
      .filter(y => cfg[y] && !cfg[y].startsWith("PASTE_"))
      .sort((a,b)=>parseInt(b,10)-parseInt(a,10));
  }

  function buildCategoryTabs(){
    const tabsEl = document.getElementById("program-tabs");
    if(!tabsEl) return;
    tabsEl.innerHTML = "";

    const set = new Set(
      PROGRAMS.map(p => p.category && p.category.trim() ? p.category.trim() : "기타")
    );

    // "전체" 탭
    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "program-tab-btn" + (currentCategory==="전체" ? " is-active" : "");
    allBtn.dataset.category = "전체";
    allBtn.textContent = "전체";
    tabsEl.appendChild(allBtn);

    // 나머지 카테고리
    Array.from(set).forEach(cat=>{
      const btn = document.createElement("button");
      btn.type="button";
      btn.className = "program-tab-btn";
      btn.dataset.category = cat;
      btn.textContent = cat;
      tabsEl.appendChild(btn);
    });

    tabsEl.onclick = (e)=>{
      const btn = e.target.closest(".program-tab-btn");
      if(!btn) return;
      currentCategory = btn.dataset.category || "전체";
      tabsEl.querySelectorAll(".program-tab-btn").forEach(b=>{
        b.classList.toggle("is-active", b===btn);
      });
      renderCards();
    };
  }

  function renderCards(){
    const listEl = document.getElementById("program-list");
    if(!listEl) return;

    const filtered = PROGRAMS.filter(p => {
      if(currentCategory === "전체") return true;
      return p.category === currentCategory;
    });

    if(!filtered.length){
      listEl.innerHTML = "<p>해당 카테고리의 사업이 아직 등록되지 않았습니다.</p>";
      return;
    }

    listEl.innerHTML = "";
    filtered.forEach(p=>{
      const card = document.createElement("article");
      card.className = "program-card";
      card.innerHTML = `
        <div class="program-tag">${p.category || "기타"}</div>
        <div class="program-title">${p.title}</div>
        <div class="program-desc">${p.desc || ""}</div>
        <div class="program-meta">${p.meta || ""}</div>
      `;
      listEl.appendChild(card);
    });
  }

  function renderError(msg){
    const listEl = document.getElementById("program-list");
    if(listEl) listEl.innerHTML = `<p>${msg}</p>`;
  }

  return { init };
})();
