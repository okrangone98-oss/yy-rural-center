// ====== Utils ======
window.CSVUtils = (function(){
  function parseCSV(text){
    const rows = [];
    let row = [], field = "", insideQuotes = false;

    for(let i=0;i<text.length;i++){
      const c = text[i];
      if(c === '"'){
        if(insideQuotes && text[i+1] === '"'){ field+='"'; i++; }
        else insideQuotes = !insideQuotes;
      }else if(c === "," && !insideQuotes){
        row.push(field); field="";
      }else if((c === "\n" || c === "\r") && !insideQuotes){
        if(field!=="" || row.length>0){ row.push(field); rows.push(row); row=[]; field=""; }
      }else{
        field += c;
      }
    }
    if(field!=="" || row.length>0){ row.push(field); rows.push(row); }
    return rows;
  }

  async function fetchCSV(url){
    const res = await fetch(url);
    if(!res.ok) throw new Error("CSV fetch failed: " + res.status);
    const text = await res.text();
    return parseCSV(text);
  }

  function safeText(s){
    return (s ?? "").toString();
  }

  function normalizeHeader(h){
    return safeText(h).trim().replace(/\s+/g,"");
  }

  return { parseCSV, fetchCSV, safeText, normalizeHeader };
})();
