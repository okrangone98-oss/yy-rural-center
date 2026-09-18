window.NoticesModule = (function(){
  let NOTICES = [];

  async function load(){
    const url = window.SHEET_CONFIG?.notices?.csvUrl;
    if(!url) return;

    try{
      const rows = await window.CSVUtils.fetchCSV(url);
      if(!rows.length) return;

      const headers  = rows[0].map(h=>window.CSVUtils.safeText(h).trim());
      const dataRows = rows.slice(1);
      const norm = headers.map(window.CSVUtils.normalizeHeader);

      const colIndex = {
        type:  norm.findIndex(h=>h.includes("구분") || h.includes("분류") || h.includes("type")),
        title: norm.findIndex(h=>h.includes("제목") || h.includes("title")),
        date:  norm.findIndex(h=>h.includes("날짜") || h.includes("등록일") || h.includes("date")),
        url:   norm.findIndex(h=>h.includes("url") || h.includes("링크")),
        content: norm.findIndex(h=>h.includes("내용") || h.includes("본문") || h.includes("content")),
        image: norm.findIndex(h=>h.includes("사진") || h.includes("이미지") || h.includes("포스터")),
        status: norm.findIndex(h=>h.includes("상태") || h.includes("status"))
      };

      NOTICES = dataRows
        .filter(r=>r[colIndex.title] && window.CSVUtils.safeText(r[colIndex.title]).trim() !== "")
        .filter(r=>{
          if(colIndex.status<0) return true;
          const st=window.CSVUtils.safeText(r[colIndex.status]).trim();
          return st==="" || st==="활성" || st.toLowerCase()==="active";
        })
        .map(r=>({
          type:  colIndex.type>=0 ? window.CSVUtils.safeText(r[colIndex.type]).trim() : "공지",
          title: window.CSVUtils.safeText(r[colIndex.title]).trim(),
          date:  colIndex.date>=0 ? window.CSVUtils.safeText(r[colIndex.date]).trim() : "",
          url:   colIndex.url>=0  ? window.CSVUtils.safeText(r[colIndex.url]).trim() : "",
          content: colIndex.content>=0 ? window.CSVUtils.safeText(r[colIndex.content]) : "",
          images: colIndex.image>=0 ? window.CSVUtils.safeText(r[colIndex.image]).split(/[\r\n,]+/).map(s=>s.trim()).filter(Boolean) : [],
        }));

      renderPreview();
    }catch(err){
      console.error("공지사항 시트 로딩 오류:", err);
      const tbody = document.getElementById("notice-preview-tbody");
      if(tbody){
        tbody.innerHTML = `
          <tr><td colspan="3" class="notice-empty">
            공지사항을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
          </td></tr>
        `;
      }
    }
  }

  function renderPreview(){
    const tbody = document.getElementById("notice-preview-tbody");
    if(!tbody) return;

    if(!NOTICES.length){
      tbody.innerHTML = `
        <tr><td colspan="3" class="notice-empty">
          등록된 공지사항이 없습니다.
        </td></tr>
      `;
      return;
    }

    tbody.innerHTML = "";
    NOTICES.forEach(n=>{
      const tr      = document.createElement("tr");
      tr.dataset.action = "notice-preview-row";
      tr.dataset.noticeIndex = String(NOTICES.indexOf(n));
      tr.tabIndex = 0;
      tr.setAttribute("role", "button");
      tr.setAttribute("aria-label", `${n.title} 상세 보기`);
      const typeTd  = document.createElement("td");
      const titleTd = document.createElement("td");
      const dateTd  = document.createElement("td");

      typeTd.className  = "notice-type";
      typeTd.textContent = n.type || "공지";

      titleTd.className = "notice-title";
      const titleButton = document.createElement("button");
      titleButton.type = "button";
      titleButton.className = "notice-preview-title-button";
      titleButton.textContent = n.title;
      titleTd.appendChild(titleButton);

      dateTd.className  = "notice-date";
      dateTd.textContent = n.date;

      tr.appendChild(typeTd);
      tr.appendChild(titleTd);
      tr.appendChild(dateTd);
      tbody.appendChild(tr);
    });
  }

  function openPreview(index){
    const n = NOTICES[index];
    const modal = document.getElementById("notice-preview-modal");
    if(!n || !modal) return;

    document.getElementById("notice-preview-modal-title").textContent = n.title;
    document.getElementById("notice-preview-modal-meta").textContent = [n.type || "공지", n.date].filter(Boolean).join(" · ");
    document.getElementById("notice-preview-modal-content").textContent = n.content || "공지사항 상세 내용은 전체 공지사항에서 확인해 주세요.";
    const link = document.getElementById("notice-preview-modal-link");
    const params = new URLSearchParams();
    if(n.title) params.set("t", n.title);
    if(n.date) params.set("d", n.date);
    link.href = "notice.html" + (params.toString() ? `?${params.toString()}` : "");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closePreview(){
    const modal = document.getElementById("notice-preview-modal");
    if(!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  document.addEventListener("keydown", (event) => {
    const row = event.target.closest?.('[data-action="notice-preview-row"]');
    if(row && (event.key === "Enter" || event.key === " ")){
      event.preventDefault();
      openPreview(Number(row.dataset.noticeIndex));
    }
    if(event.key === "Escape") closePreview();
  });

  document.addEventListener("click", (event) => {
    const row = event.target.closest?.('[data-action="notice-preview-row"]');
    if(row){
      event.preventDefault();
      openPreview(Number(row.dataset.noticeIndex));
      return;
    }
    if(event.target.closest?.('[data-action="close-home-notice-modal"]') || event.target.closest?.("#notice-preview-modal .modal-backdrop-overlay")) closePreview();
  });

  return { load, openPreview, closePreview };
})();
