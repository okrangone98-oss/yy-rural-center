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
      const typeTd  = document.createElement("td");
      const titleTd = document.createElement("td");
      const dateTd  = document.createElement("td");

      typeTd.className  = "notice-type";
      typeTd.textContent = n.type || "공지";

      titleTd.className = "notice-title";
      const a = document.createElement("a");
      const params = new URLSearchParams();
      if(n.title) params.set("t", n.title);
      if(n.date) params.set("d", n.date);
      a.href = "notice.html" + (params.toString() ? ("?" + params.toString()) : "");
      a.textContent = n.title;
      titleTd.appendChild(a);

      dateTd.className  = "notice-date";
      dateTd.textContent = n.date;

      tr.appendChild(typeTd);
      tr.appendChild(titleTd);
      tr.appendChild(dateTd);
      tbody.appendChild(tr);
    });
  }

  return { load };
})();
