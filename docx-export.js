const JSZip = globalThis.JSZip;

if (!JSZip) {
  throw new Error("Word 匯出元件未能載入。");
}

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const OTHER_REMINDER_MODES = new Set(["自學套件", "派發溫習套件"]);
const integerLessons = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
};
const text = (node) => node ? Array.from(node.getElementsByTagNameNS(W_NS, "t")).map(item => item.textContent).join("") : "";
const direct = (node, localName) => Array.from(node.childNodes).filter(item => item.nodeType === Node.ELEMENT_NODE && item.namespaceURI === W_NS && item.localName === localName);
const w = (document, name) => document.createElementNS(W_NS, `w:${name}`);
const parseXml = (xml) => new DOMParser().parseFromString(xml, "application/xml");
const serialize = (document) => new XMLSerializer().serializeToString(document);
const hasXmlError = (document) => document.getElementsByTagName("parsererror").length > 0;

function cloneChild(node, localName) {
  return direct(node, localName)[0]?.cloneNode(true) || null;
}

function createParagraph(document, sourceCell, value, center = false) {
  const sourceParagraph = direct(sourceCell, "p")[0];
  const paragraph = w(document, "p");
  const properties = sourceParagraph && cloneChild(sourceParagraph, "pPr");
  if (properties) paragraph.append(properties);
  if (center) {
    const paragraphProperties = direct(paragraph, "pPr")[0] || paragraph.insertBefore(w(document, "pPr"), paragraph.firstChild);
    const alignment = w(document, "jc"); alignment.setAttributeNS(W_NS, "w:val", "center"); paragraphProperties.append(alignment);
  }
  const sourceRun = sourceParagraph && direct(sourceParagraph, "r")[0];
  const runProperties = sourceRun && cloneChild(sourceRun, "rPr");
  String(value || "").split("\n").forEach((line, index) => {
    const run = w(document, "r");
    if (runProperties) run.append(runProperties.cloneNode(true));
    const valueNode = w(document, "t");
    if (/^\s|\s$/.test(line)) valueNode.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
    valueNode.textContent = line;
    run.append(valueNode); paragraph.append(run);
    if (index < String(value || "").split("\n").length - 1) { const breakRun = w(document, "r"); if (runProperties) breakRun.append(runProperties.cloneNode(true)); breakRun.append(w(document, "br")); paragraph.append(breakRun); }
  });
  return paragraph;
}

function setCell(document, cell, value, center = false) {
  const replacement = createParagraph(document, cell, value, center);
  direct(cell, "p").forEach(paragraph => paragraph.remove());
  cell.append(replacement);
}

function appendRun(document, paragraph, runProperties, value, boxed = false) {
  const run = w(document, "r");
  if (runProperties) run.append(runProperties.cloneNode(true));
  if (boxed) {
    const properties = direct(run, "rPr")[0] || run.insertBefore(w(document, "rPr"), run.firstChild);
    const border = w(document, "bdr");
    border.setAttributeNS(W_NS, "w:val", "single");
    border.setAttributeNS(W_NS, "w:sz", "4");
    border.setAttributeNS(W_NS, "w:space", "1");
    border.setAttributeNS(W_NS, "w:color", "64756F");
    properties.append(border);
  }
  const valueNode = w(document, "t");
  if (/^\s|\s$/.test(value)) valueNode.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
  valueNode.textContent = value;
  run.append(valueNode); paragraph.append(run);
}

function appendBreak(document, paragraph, runProperties) {
  const breakRun = w(document, "r");
  if (runProperties) breakRun.append(runProperties.cloneNode(true));
  breakRun.append(w(document, "br"));
  paragraph.append(breakRun);
}

function appendMultilineText(document, paragraph, runProperties, value, boxed = false) {
  String(value || "").split("\n").forEach((line, index, lines) => {
    appendRun(document, paragraph, runProperties, line, boxed);
    if (index < lines.length - 1) appendBreak(document, paragraph, runProperties);
  });
}

function createRecommendedContentParagraph(document, sourceCell, items) {
  const sourceParagraph = direct(sourceCell, "p")[0];
  const paragraph = w(document, "p");
  const properties = sourceParagraph && cloneChild(sourceParagraph, "pPr");
  if (properties) paragraph.append(properties);
  const sourceRun = sourceParagraph && direct(sourceParagraph, "r")[0];
  const runProperties = sourceRun && cloneChild(sourceRun, "rPr");
  const records = items?.length ? items : [{ text: "／", lessons: 0 }];
  records.forEach((item, index) => {
    const value = String(item.text || "").trim() || "／";
    if (value === "／") appendRun(document, paragraph, runProperties, "／");
    else {
      appendMultilineText(document, paragraph, runProperties, value, !!item.recommended);
      appendBreak(document, paragraph, runProperties);
      appendMultilineText(document, paragraph, runProperties, item.combined || item.combinedWith ? "（結合閱讀／寫作進行）" : `（${integerLessons(item.lessons)}節）`);
    }
    if (index < records.length - 1) { appendBreak(document, paragraph, runProperties); appendBreak(document, paragraph, runProperties); }
  });
  return paragraph;
}

function setRecommendedContentCell(document, cell, items) {
  const replacement = createRecommendedContentParagraph(document, cell, items);
  direct(cell, "p").forEach(paragraph => paragraph.remove());
  cell.append(replacement);
}

function cellText(items, { showLessons = true, category = "" } = {}) {
  const output = [];
  for (const item of items || []) {
    const value = String(item.text || "").trim() || "／";
    const lessons = integerLessons(item.lessons);
    const marker = item.priority ? "*" : "";
    if (value === "／") output.push("／");
    else if (!showLessons) output.push(`${value}${marker}`);
    else if (category === "other" && (OTHER_REMINDER_MODES.has(item.mode) || Array.from(OTHER_REMINDER_MODES).some(mode => value.startsWith(`${mode}：`)))) output.push(`${value}${marker}`);
    else if (item.combined || item.combinedWith) output.push(`${value}${marker}\n（結合閱讀／寫作進行）`);
    else output.push(`${value}${marker}\n（${lessons}節）`);
  }
  return output.join("\n\n") || "／";
}

function assessmentText(entry) {
  const assessment = entry.assessment || {};
  const dictations = assessment.dictation ? assessment.dictations || [] : [];
  const evaluations = assessment.evaluationEnabled ? assessment.evaluations || [] : [];
  const records = [
    ...dictations.map(item => `默書（${item.frequency || "未填頻次"}）\n日期：${item.month && item.day ? `${item.day}/${item.month}` : "未填日期"}${item.noteText?.trim() ? `\n${item.noteText.trim()}` : ""}\n（${integerLessons(item.lessons)}節）`),
    ...evaluations.map(item => `${item.type || "評估"}\n日期：${item.dateTBD ? "待定" : item.month && item.day ? `${item.day}/${item.month}` : "未填日期"}${item.noteText?.trim() ? `\n${item.noteText.trim()}` : ""}\n（${integerLessons(item.lessons)}節）`),
  ];
  return records.join("\n\n") || "／";
}

function isEmptyWeek(entry) {
  if (String(entry.date || "").trim()) return false;
  if (Object.values(entry.categories || {}).flat().some(item => String(item.text || "").trim() && item.text !== "／")) return false;
  return !(entry.assessment?.dictations?.length || entry.assessment?.evaluations?.length);
}

function rowCells(row) { return direct(row, "tc"); }

function writeWeek(document, row, entry, number) {
  const cells = rowCells(row);
  if (isEmptyWeek(entry)) { cells.forEach(cell => setCell(document, cell, "")); return; }
  const categories = entry.categories || {};
  const output = [String(number), entry.date || "", cellText(categories.reading), cellText(categories.writing), cellText(categories.listening), cellText(categories.literature), assessmentText(entry), cellText(categories.other, { category: "other" }), cellText(categories.values, { showLessons: false })];
  cells.forEach((cell, index) => {
    if (index === 2) setRecommendedContentCell(document, cell, categories.reading);
    else if (index === 5) setRecommendedContentCell(document, cell, categories.literature);
    else setCell(document, cell, output[index] || "", index < 2);
  });
}

function fullYear(value) {
  const digits = "零一二三四五六七八九";
  const groups = String(value || "").match(/\d+/g) || [];
  let start = "", end = "";
  if (groups.length === 1 && groups[0].length === 4) { start = `20${groups[0].slice(0, 2)}`; end = `20${groups[0].slice(2)}`; }
  else if (groups.length >= 2) { start = groups[0].length === 4 ? groups[0] : `20${groups[0].padStart(2, "0")}`; end = groups[1].length === 4 ? groups[1] : `20${groups[1].padStart(2, "0")}`; }
  return start && end ? `${start.replace(/\d/g, digit => digits[digit])}至${end.replace(/\d/g, digit => digits[digit])}年度` : String(value || "");
}

function replaceParagraph(document, paragraph, value, center = false) {
  const cell = paragraph.parentNode;
  const replacement = createParagraph(document, cell, value, center);
  paragraph.replaceWith(replacement);
}

function removeOldTemplateNote(document) {
  Array.from(document.getElementsByTagName("mc:AlternateContent")).forEach(node => { if (text(node).includes("要在新年假前完成")) node.remove(); });
}

function replaceRepeatedColumnHeader(document) {
  Array.from(document.getElementsByTagNameNS(W_NS, "p")).forEach(paragraph => {
    const compact = text(paragraph).replace(/[\s／/]/g, "");
    if (compact === "識字寫作") replaceParagraph(document, paragraph, "識字／語基／寫作", true);
  });
}

function fillTemplate(document, header, plan) {
  removeOldTemplateNote(document);
  replaceRepeatedColumnHeader(document);
  const body = document.getElementsByTagNameNS(W_NS, "body")[0];
  const firstParagraph = direct(body, "p")[0];
  if (firstParagraph) replaceParagraph(document, firstParagraph, `年級：${plan.meta.grade || ""}\t\t\t\t教師：${plan.meta.teacher || ""}`);
  const headerParagraphs = direct(header.getElementsByTagNameNS(W_NS, "hdr")[0], "p");
  if (headerParagraphs[1]) replaceParagraph(header, headerParagraphs[1], `${fullYear(plan.meta.year)}${plan.meta.semester || ""}中文科教學進度簡表`, true);

  const weekRows = [];
  const noteRows = [];
  Array.from(document.getElementsByTagNameNS(W_NS, "tbl")).forEach(table => direct(table, "tr").forEach(row => {
    const first = text(rowCells(row)[0]).trim();
    if (/^\d+$/.test(first)) weekRows.push(row);
    else if (first.includes("考試") || rowCells(row).length === 1) noteRows.push(row);
  }));
  const weeks = (plan.entries || []).filter(entry => entry.type === "week");
  weekRows.forEach((row, index) => writeWeek(document, row, weeks[index] || {}, index + 1));
  const sourceRow = weekRows.at(-1);
  weeks.slice(weekRows.length).forEach((entry, index) => { const row = sourceRow.cloneNode(true); sourceRow.parentNode.append(row); writeWeek(document, row, entry, weekRows.length + index + 1); });
  const note = (plan.entries || []).filter(entry => entry.type === "note" && String(entry.note || "").trim()).map(entry => entry.note.trim()).join("\n");
  noteRows.forEach((row, index) => { if (note && index === 0) setCell(document, rowCells(row)[0], note, true); else row.remove(); });
}

async function readTemplate(localTemplate) {
  if (localTemplate) return localTemplate.arrayBuffer();
  const response = await fetch("./template.docx");
  if (!response.ok) throw new Error("找不到 browser-version/template.docx。");
  return response.arrayBuffer();
}

export async function exportDocx(plan, filename, localTemplate = null) {
  let bytes;
  try { bytes = await readTemplate(localTemplate); }
  catch { throw new Error("純靜態版本需透過網頁網址開啟，才能讀取內置 Word 範本。請將 browser-version 發佈至靜態網站後再測試。\n\n本機 V1 不受影響，仍可使用原有下載 Word 功能。 "); }
  const zip = await JSZip.loadAsync(bytes);
  const documentPath = "word/document.xml";
  const headerPath = "word/header1.xml";
  const document = parseXml(await zip.file(documentPath).async("string"));
  const header = parseXml(await zip.file(headerPath).async("string"));
  if (hasXmlError(document) || hasXmlError(header)) throw new Error("Word 範本 XML 無法讀取。");
  fillTemplate(document, header, plan);
  zip.file(documentPath, serialize(document));
  zip.file(headerPath, serialize(header));
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 }, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const url = URL.createObjectURL(blob); const download = globalThis.document.createElement("a"); download.href = url; download.download = filename; download.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
