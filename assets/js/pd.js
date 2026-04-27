window.PDModule = (function(){
  let PD = [];
  let currentYear = "2026";
  let currentProject = "전체";

  function init(){
    const cfg = window.SHEET_CONFIG?.pd || {};
    if(!cfg["2026"] || cfg["2026"].startsWith("PASTE_")) currentYear = "2025";

    buildYearTabs();
    load(currentYear);
  }

  function buildYearTabs(){
    const yearWrap = document.getElementById("pd-year-tabs");
    if(!yearWrap) return;

    yearWrap.innerHTML = "";
    ["2026","2025"].forEach(y=>{
      const btn = document.createElement("button");
      btn.type="button";
      btn.className="filter-btn" + (y===currentYear ? " active" : "");
      btn.dataset.year=y;
      btn.textContent = (y==="2026") ? "2026 활동 PD" : "2025 활동 PD";
      yearWrap.appendChild(btn);
    });

    yearWrap.addEventListener("click",(e)=>{
      const btn=e.target.closest(".filter-btn");
      if(!btn) return;
      currentYear=btn.dataset.year;
      yearWrap.querySelectorAll(".filter-btn").forEach(b=>{
        b.classList.toggle("active", b===btn);
      });
      currentProject="전체";
      load(currentYear);
    });
  }

  async function load(year){
    const url = window.SHEET_CONFIG?.pd?.[year];
    if(!url || url.startsWith("PASTE_")){
      renderError(`'${year}' PD 시트 URL이 설정되지 않았습니다.`);
      return;
    }

    try{
      const rows = await window.CSVUtils.fetchCSV(url);
      if(!rows.length) return;

      const headers = rows[0].map(h => window.CSVUtils.safeText(h).trim());
      const dataRows = rows.slice(1);
      const norm = headers.map(window.CSVUtils.normalizeHeader);

      const colIndex = {
        name: norm.findIndex(h=>h.includes("성명")||h.includes("name")),
        role: norm.findIndex(h=>h.includes("역할")||h.includes("role")),
        project: norm.findIndex(h=>h.includes("담당사업")||h.includes("프로젝트")||h.includes("project")),
        area: norm.findIndex(h=>h.includes("활동지역")||h.includes("지역")||h.includes("area")),
        desc: norm.findIndex(h=>h.includes("주요경력")||h.includes("요약")||h.includes("소개")||h.includes("desc")),
        photo: norm.findIndex(h=>h.includes("프로필사진")||h.includes("사진")||h.includes("photo")),
        status: norm.findIndex(h=>h.includes("상태")||h.includes("status")),
      };

      PD = dataRows
        .filter(r=>r[colIndex.name] && window.CSVUtils.safeText(r[colIndex.name]).trim()!=="")
        .filter(r=>{
          if(colIndex.status<0) return true;
          const st=window.CSVUtils.safeText(r[colIndex.status]).trim();
          return st==="" || st==="활성" || st.toLowerCase()==="active";
        })
        .map(r=>({
          name: window.CSVUtils.safeText(r[colIndex.name]).trim(),
          role: window.CSVUtils.safeText(r[colIndex.role]).trim(),
          project: window.CSVUtils.safeText(r[colIndex.project]).trim() || "기타",
          area: window.CSVUtils.safeText(r[colIndex.area]).trim(),
          desc: window.CSVUtils.safeText(r[colIndex.desc]).trim(),
          photo: window.CSVUtils.safeText(r[colIndex.photo]).trim(),
        }));

      buildProjectTabs();
      renderCards();
      updateSubtitle();
    }catch(e){
      console.error("PD 로딩 오류:", e);
      renderError("PD 정보를 불러오지 못했습니다.");
    }
  }

  function updateSubtitle(){
    const el=document.getElementById("pd-year-subtitle");
    if(!el) return;
    if(currentYear==="2026"){
      el.textContent="2026년 사업을 함께 운영하는 PD·현장 코디네이터입니다. 담당사업 기준으로 확인할 수 있습니다.";
    }else{
      el.textContent="2025년 활동 PD 아카이브(기록)입니다. 현행 담당과 다를 수 있습니다.";
    }
  }

  function buildProjectTabs(){
    const wrap=document.getElementById("pd-project-tabs");
    if(!wrap) return;
    wrap.innerHTML="";

    const set=new Set(PD.map(p=>p.project||"기타"));

    const all=document.createElement("button");
    all.type="button";
    all.className="filter-btn" + (currentProject==="전체" ? " active" : "");
    all.dataset.project="전체";
    all.textContent="전체";
    wrap.appendChild(all);

    Array.from(set).forEach(pr=>{
      const btn=document.createElement("button");
      btn.type="button";
      btn.className="filter-btn";
      btn.dataset.project=pr;
      btn.textContent=pr;
      wrap.appendChild(btn);
    });

    wrap.onclick=(e)=>{
      const btn=e.target.closest(".filter-btn");
      if(!btn) return;
      currentProject=btn.dataset.project||"전체";
      wrap.querySelectorAll(".filter-btn").forEach(b=>{
        b.classList.toggle("active", b===btn);
      });
      renderCards();
    };
  }

  function renderCards(){
    const listEl=document.getElementById("pd-list");
    if(!listEl) return;

    const filtered = (currentProject==="전체") ? PD : PD.filter(p=>p.project===currentProject);

    if(!filtered.length){
      listEl.innerHTML="<p style='color:#666;font-size:.9rem;'>등록된 PD가 없습니다.</p>";
      return;
    }

    listEl.innerHTML="";
    filtered.forEach(p=>{
      const card=document.createElement("article");
      card.className="teacher-card";

      const photoHtml = p.photo
        ? `<img src="${p.photo}" alt="${p.name} 프로필" class="teacher-photo" />`
        : `<div class="teacher-photo" style="display:flex;align-items:center;justify-content:center;background:#f1f1f1;border:2px solid #08655033;color:#666;font-weight:700;">
             ${p.name.slice(0,1)}
           </div>`;

      const descText = (p.desc || "").length>120 ? (p.desc || "").slice(0,120)+"…" : (p.desc||"");

      card.innerHTML = `
        ${photoHtml}
        <div class="teacher-name">${p.name}</div>
        <div class="teacher-role">${[p.project, p.role].filter(Boolean).join(" · ")}</div>
        <div class="teacher-org">${p.area || ""}</div>
        <p class="teacher-note">${descText}</p>
      `;
      listEl.appendChild(card);
    });
  }

  function renderError(msg){
    const listEl=document.getElementById("pd-list");
    if(listEl) listEl.innerHTML = `<p style="color:#666;font-size:.9rem;">${msg}</p>`;
  }

  return { init };
})();
