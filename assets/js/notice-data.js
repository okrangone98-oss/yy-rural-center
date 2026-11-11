window.NoticeData = (function () {
  const titleKey = value => String(value ?? "").replace(/\s+/g, " ").trim();

  function dateKey(value) {
    const match = String(value ?? "").trim().match(/^(\d{4})\s*[.\/-년]\s*(\d{1,2})\s*[.\/-월]\s*(\d{1,2})(?!\d)/);
    if (!match) return "";
    const [, y, m, d] = match.map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
      ? date.toISOString().slice(0, 10) : "";
  }

  function identity(notice) {
    const date = dateKey(notice?.date);
    const title = titleKey(notice?.title);
    return date && title ? JSON.stringify([date, title]) : "";
  }

  function newestFirst(a, b) {
    return dateKey(b.date).localeCompare(dateKey(a.date));
  }

  function uniqueIndex(items, keyOf) {
    const result = new Map();
    items.forEach(item => {
      const key = keyOf(item);
      if (key) result.set(key, result.has(key) ? null : item);
    });
    return result;
  }

  function bindViewRecords(notices, records) {
    const pairs = uniqueIndex(records, identity);
    const titles = uniqueIndex(records, record => titleKey(record.title));
    const sourceTitles = uniqueIndex(notices, notice => titleKey(notice.title));
    const sourcePairs = uniqueIndex(notices, identity);
    const ids = uniqueIndex(records, record => record.id);
    const claims = uniqueIndex(notices, notice => notice.storageId);

    return notices.map(notice => {
      const key = identity(notice);
      if (!key || sourcePairs.get(key) !== notice) return null;
      const title = titleKey(notice.title);
      const exact = pairs.get(key);
      // Older rows have no date. Only a one-to-one title match is safe there.
      const legacy = titles.get(title);
      const candidate = exact || (legacy && !dateKey(legacy.date) && sourceTitles.get(title) === notice ? legacy : null);
      if (candidate && ids.get(candidate.id) === candidate) return candidate;
      const stored = ids.get(notice.storageId);
      // A dated ID can survive a rename, but never take a record belonging to another title.
      if (stored && claims.get(stored.id) === notice && dateKey(stored.date) === dateKey(notice.date) &&
          titleKey(stored.title) && !sourceTitles.has(titleKey(stored.title))) return stored;
      return null;
    });
  }

  return { titleKey, dateKey, identity, newestFirst, bindViewRecords };
})();
