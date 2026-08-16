const CATEGORIES = [
  ["reading", "閱讀（單元／課次／銜接課程／童書教學）"], ["writing", "識字／語基／寫作"],
  ["listening", "聆聽／視訊／說話"], ["literature", "文學文化"], ["assessment", "默書／評估"],
  ["other", "其他（廣閱／閱讀策略／自學套件）"], ["values", "配合國家安全教育／價值觀教育"],
];
const LISTENING_OPTIONS = ["聆練", "視訊", "說練", "其他"];
const OTHER_OPTIONS = ["廣閱", "閱讀策略", "自學套件", "派發溫習套件", "其他"];
const OTHER_NO_LESSON_OPTIONS = ["自學套件", "派發溫習套件"];
const listeningMode = mode => mode === "說練習" ? "說練" : mode;
const otherNeedsLessons = mode => !OTHER_NO_LESSON_OPTIONS.includes(mode);
const otherAllowsZeroLessons = mode => otherNeedsLessons(mode) && mode !== "其他";
const otherLessons = (mode, lessons) => otherNeedsLessons(mode) ? Math.max(mode === "其他" ? 1 : 0, Number(lessons || 0)) : 0;
const combinedWith = item => item.combinedWith || (item.combined ? "閱讀" : "");
const combinedText = item => combinedWith(item) ? `結合${combinedWith(item)}進行` : "";
const VALUE_OPTIONS = ["堅毅", "尊重他人", "責任感", "國民身份認同", "承擔精神", "誠信", "仁愛", "守法", "同理心", "勤勞", "團結", "孝親"];
const SECURITY_OPTIONS = ["政治安全", "軍事安全", "國土安全", "經濟安全", "金融安全", "文化安全", "社會安全", "科技安全", "網絡安全", "糧食安全", "生態安全", "資源安全", "核安全", "海外利益安全", "太空安全", "深海安全", "極地安全", "生物安全", "人工智能安全", "數據安全"];
const STORE = "teaching-progress-plan-browser-v1";
const emptyCategories = () => Object.fromEntries(CATEGORIES.map(([key]) => [key, []]));
const week = (number) => ({ type: "week", week: number, date: "", startMonth: "", startDay: "", endMonth: "", endDay: "", categories: emptyCategories(), assessment: { dictation: false, dictationFrequency: "", evaluationEnabled: false, evaluations: [], notApplicable: false } });
const defaultPlan = () => ({ meta: { year: "", semester: "", grade: "", teacher: "" }, entries: Array.from({ length: 13 }, (_, i) => week(i + 1)) });
let plan = load();
let dragState = null;
let assessmentDragState = null;
let listeningDragState = null;
let otherDragState = null;

function load() { try { const saved = JSON.parse(localStorage.getItem(STORE)); return saved?.entries?.some(entry => entry.type === "week") ? saved : defaultPlan(); } catch { return defaultPlan(); } }
function save() { localStorage.setItem(STORE, JSON.stringify(plan)); }
function total(entry) {
  const contentLessons = Object.entries(entry.categories).filter(([key]) => key !== "assessment").flatMap(([, items]) => items).reduce((sum, item) => sum + Number(item.lessons || 0), 0);
  const assessment = assessmentState(entry);
  const dictationLessons = assessment.dictation ? assessment.dictations.reduce((sum, item) => sum + Number(item.lessons || 0), 0) : 0;
  const evaluationLessons = assessment.evaluationEnabled ? assessment.evaluations.reduce((sum, item) => sum + Number(item.lessons || 0), 0) : 0;
  return contentLessons + dictationLessons + evaluationLessons;
}
function dateOptions(value, max, label) { return [`<option value="">${label}</option>`, ...Array.from({length:max}, (_, i) => `<option value="${i + 1}" ${String(i + 1) === String(value) ? "selected" : ""}>${i + 1}${label}</option>`)].join(""); }
function dictationFrequencyOptions(value) { return [`<option value="">頻次</option>`, ...["一", "二", "三", "四", "五", "六"].map(number => `<option value="${number}" ${value === number ? "selected" : ""}>${number}</option>`)].join(""); }
function syncDateRange(entry) { entry.date = entry.startMonth && entry.startDay && entry.endMonth && entry.endDay ? `${entry.startDay}/${entry.startMonth} — ${entry.endDay}/${entry.endMonth}` : ""; }
function blankDictation() { return { frequency: "", lessons: 1, month: "", day: "", noteText: "" }; }
function blankEvaluation() { return { type: "L評（單元評估）", lessons: 1, month: "", day: "", dateTBD: false, noteText: "" }; }
function assessmentState(entry) {
  const previous = entry.assessment || {};
  const rawDictations = Array.isArray(previous.dictations) ? previous.dictations : previous.dictation ? [{ frequency: previous.dictationFrequency || "", lessons: previous.dictationLessons ?? 1, month: previous.dictationMonth || "", day: previous.dictationDay || "", noteText: previous.dictationNoteText || "" }] : [];
  const unfinishedDictation = rawDictations.find(item => !item.frequency || !item.month || !item.day);
  const dictations = rawDictations.filter(item => item.frequency && item.month && item.day);
  const hasDraftDictation = previous.dictationDraft && (previous.dictationDraft.frequency || previous.dictationDraft.month || previous.dictationDraft.day || previous.dictationDraft.noteText);
  const evaluations = Array.isArray(previous.evaluations) ? previous.evaluations : previous.evaluation ? [{ type: previous.evaluationType || "L評（單元評估）", lessons: previous.evaluationLessons ?? 1, month: previous.evaluationMonth || "", day: previous.evaluationDay || "", dateTBD: !!previous.evaluationDateTBD, noteText: previous.note ? previous.noteText || "" : "" }] : [];
  const evaluationEnabled = typeof previous.evaluationEnabled === "boolean" ? previous.evaluationEnabled : !!previous.evaluation || evaluations.length > 0;
  return entry.assessment = { dictation: false, dictations: [], dictationDraft: blankDictation(), evaluationEnabled, evaluations: [], evaluationDraft: blankEvaluation(), ...previous, dictations: dictations.map(item => ({ ...blankDictation(), ...item })), dictationDraft: { ...blankDictation(), ...(hasDraftDictation ? previous.dictationDraft : unfinishedDictation) }, evaluations: evaluations.map(item => ({ ...blankEvaluation(), ...item })), evaluationDraft: { ...blankEvaluation(), ...previous.evaluationDraft } };
}
function assessmentDate(month, day) { return month && day ? `${day}/${month}` : ""; }
function syncAssessment(entry) {
  const state = assessmentState(entry);
  const items = [...(state.dictation ? state.dictations : []).map(item => { const name = item.frequency.trim() ? `默書（${item.frequency.trim()}）` : "默書"; return { text: `${name}${assessmentDate(item.month, item.day) ? `\n日期：${assessmentDate(item.month, item.day)}` : ""}${item.noteText.trim() ? `\n${item.noteText.trim()}` : ""}`, lessons: Number(item.lessons || 0) }; }), ...(state.evaluationEnabled ? state.evaluations : []).map(item => { const date = item.dateTBD ? "待定" : assessmentDate(item.month, item.day); return { text: `${item.type}${date ? `\n日期：${date}` : ""}${item.noteText.trim() ? `\n${item.noteText.trim()}` : ""}`, lessons: Number(item.lessons || 0) }; })];
  entry.categories.assessment = items.length ? items : [{ text: "／", lessons: 0 }];
}
function listeningItem(item) {
  const content = item.content === undefined ? (item.text === "／" ? "" : item.text || "") : item.content;
  return { mode: listeningMode(item.mode || ""), content, lessons: Number(item.lessons ?? 1) };
}
function blankListening() { return { mode: "", content: "", lessons: 1 }; }
function listeningState(entry) {
  const previous = entry.listening || {};
  const legacy = (entry.categories.listening || []).filter(item => item.text !== "／").map(listeningItem);
  const items = Array.isArray(previous.items) ? previous.items : legacy;
  const notApplicable = previous.notApplicable === true || (entry.categories.listening || []).some(item => item.text === "／");
  return entry.listening = { items: items.map(item => ({ ...blankListening(), ...item, mode: listeningMode(item.mode || "") })), draft: { ...blankListening(), ...previous.draft, mode: listeningMode(previous.draft?.mode || "") }, open: !!previous.open, notApplicable };
}
function syncListening(entry, state = listeningState(entry)) {
  entry.categories.listening = state.notApplicable ? [{ text: "／", lessons: 0 }] : state.items.map(item => ({ text: `${listeningMode(item.mode)}：${item.content.trim()}`, lessons: Number(item.lessons || 0), mode: listeningMode(item.mode), content: item.content }));
}
function otherItem(item) {
  const rawContent = item.content === undefined ? (item.text === "／" ? "" : item.text || "") : item.content;
  const match = String(rawContent).match(/^([^：:]+)[：:]\s*(.*)$/);
  const mode = item.mode || (match && OTHER_OPTIONS.includes(match[1]) ? match[1] : "其他");
  return { mode, content: match ? match[2] : rawContent, lessons: otherLessons(mode, item.lessons ?? 1), combined: !!item.combined && otherAllowsZeroLessons(mode), combinedWith: otherAllowsZeroLessons(mode) ? combinedWith(item) : "" };
}
function blankOther() { return { mode: "", content: "", lessons: 1, combined: false, combinedWith: "" }; }
function otherState(entry) {
  const previous = entry.other || {};
  const legacy = (entry.categories.other || []).filter(item => item.text !== "／").map(otherItem);
  const items = Array.isArray(previous.items) ? previous.items : legacy;
  const notApplicable = previous.notApplicable === true || (entry.categories.other || []).some(item => item.text === "／");
  const draft = { ...blankOther(), ...previous.draft };
  if (!draft.combinedWith && draft.combined) draft.combinedWith = "閱讀";
  draft.lessons = otherLessons(draft.mode, draft.lessons);
  if (!otherAllowsZeroLessons(draft.mode)) draft.combinedWith = "";
  return entry.other = { items: items.map(item => ({ ...blankOther(), ...item, lessons: otherLessons(item.mode, item.lessons), combinedWith: otherAllowsZeroLessons(item.mode) ? combinedWith(item) : "" })), draft, open: !!previous.open, notApplicable };
}
function syncOther(entry, state = otherState(entry)) {
  entry.categories.other = state.notApplicable ? [{ text: "／", lessons: 0 }] : state.items.map(item => ({ text: `${item.mode}：${item.content.trim()}`, lessons: !otherNeedsLessons(item.mode) || combinedWith(item) ? 0 : otherLessons(item.mode, item.lessons), mode: item.mode, content: item.content, combined: !!combinedWith(item), combinedWith: combinedWith(item) }));
}
function valueState(entry) {
  if (!entry.values) {
    const existing = entry.categories.values || [];
    entry.values = { notApplicable: existing.some(item => item.text === "／"), items: existing.filter(item => item.text && item.text !== "／").map(item => ({ text: item.text, priority: !!item.priority })) };
  }
  return entry.values;
}
function syncValues(entry) { const state = valueState(entry); entry.categories.values = state.notApplicable ? [{ text: "／", lessons: 0 }] : state.items.map(item => ({ text: item.text, lessons: 0, priority: !!item.priority })); }
function currentFilename() { const { year, semester, grade } = plan.meta; return year && semester && grade ? `${year}${semester}${grade}教學進度表` : "請先填寫基本資料"; }
function allIssues() {
  const errors = []; const { year, semester, grade } = plan.meta;
  if (!year || !semester || !grade) errors.push("請先填寫學年、學期及年級。");
  plan.entries.filter(e => e.type === "week").forEach(entry => {
    syncAssessment(entry);
    if (!entry.date.trim()) errors.push(`第${entry.week}循環週：請填寫日期。`);
    CATEGORIES.forEach(([key, label]) => { if (key !== "listening" && !entry.categories[key].some(item => item.text.trim())) errors.push(`第${entry.week}循環週：${label}未填寫。`); });
    const assessment = assessmentState(entry);
    if (assessment.dictation && !assessment.dictations.length) errors.push(`第${entry.week}循環週：請填寫默書資料後按「＋」加入。`);
    assessment.dictations.forEach((item, index) => { if (!item.frequency.trim()) errors.push(`第${entry.week}循環週：請填寫第${index + 1}項默書頻次。`); if (!item.month || !item.day) errors.push(`第${entry.week}循環週：請填寫第${index + 1}項默書日期。`); });
    if (assessment.evaluationEnabled && !assessment.evaluations.length) errors.push(`第${entry.week}循環週：請填寫評估資料後按「＋」加入。`);
    if (assessment.evaluationEnabled) assessment.evaluations.forEach((item, index) => { if (!item.dateTBD && (!item.month || !item.day)) errors.push(`第${entry.week}循環週：請填寫第${index + 1}項評估日期或選擇待定。`); });
    if (total(entry) !== 8) errors.push(`第${entry.week}循環週：目前合計${total(entry)}節，應為8節。`);
  });
  return errors;
}
function refreshValidation() {
  const errors = allIssues(); const issues = document.querySelector("#issues");
  const visibleErrors = errors.slice(0, 3);
  const more = errors.length > visibleErrors.length ? `<div class="issue">另有 ${errors.length - visibleErrors.length} 項需要在各循環週內處理。</div>` : "";
  issues.innerHTML = errors.length ? visibleErrors.map(error => `<div class="issue">${escapeHtml(error)}</div>`).join("") + more : '<div class="ok">所有循環週均已填妥並合計 8 節，可以下載。</div>';
  document.querySelector("#summary").textContent = errors.length ? `尚有 ${errors.length} 項需要處理` : "已通過完整性及 8 節檢核";
  document.querySelectorAll("#download-docx").forEach(button => button.disabled = false);
  document.querySelectorAll(".week-row").forEach(row => {
    const entry = plan.entries[Number(row.dataset.entryIndex)];
    const status = row.querySelector(".week-status");
    if (!entry || !status) return;
    const lessons = total(entry); status.textContent = `${lessons}/8節`;
    status.classList.toggle("valid", lessons === 8); status.classList.toggle("invalid", lessons !== 8);
  });
}
function renumber() { let number = 1; plan.entries.forEach(entry => { if (entry.type === "week") entry.week = number++; }); }
function render() {
  const previousScroll = { x: window.scrollX, y: window.scrollY, tableX: document.querySelector(".planner-table-wrap")?.scrollLeft || 0 };
  renumber(); save();
  ["year", "semester", "grade", "teacher"].forEach(key => document.querySelector(`#${key}`).value = plan.meta[key] || "");
  document.querySelector("#filename-preview").textContent = currentFilename();
  const entries = document.querySelector("#entries"); entries.innerHTML = "";
  entries.append(renderPlannerTable());
  refreshValidation();
  const restoreScroll = () => {
    const tableWrap = document.querySelector(".planner-table-wrap");
    if (tableWrap) tableWrap.scrollLeft = previousScroll.tableX;
    window.scrollTo(previousScroll.x, previousScroll.y);
  };
  restoreScroll();
  requestAnimationFrame(() => { restoreScroll(); requestAnimationFrame(restoreScroll); });
}
function renderPlannerTable() {
  const wrap = document.createElement("div"); wrap.className = "planner-table-wrap";
  const table = document.createElement("table"); table.className = "planner-table";
  const headerLabel = label => {
    const bracket = label.indexOf("（");
    return bracket === -1 ? label : `${label.slice(0, bracket)}<br><span class="header-note">${label.slice(bracket)}</span>`;
  };
  const teachingHeaders = CATEGORIES.slice(0, 4).map(([key, label]) => `<th class="category-${key}">${headerLabel(label)}</th>`).join("");
  const [, , , , assessment, other, values] = CATEGORIES;
  const valuesHeader = `${headerLabel(values[1])}<br><span class="priority-header-note">* 本年度學校關注項目</span>`;
  table.innerHTML = `<colgroup><col style="width:60px"><col style="width:105px"><col style="width:230px"><col style="width:155px"><col style="width:155px"><col style="width:155px"><col style="width:130px"><col style="width:165px"><col style="width:175px"></colgroup><thead><tr><th rowspan="2">循環週</th><th rowspan="2">日期</th><th colspan="4" class="teaching-content-heading">教學內容</th><th rowspan="2" class="category-assessment">${headerLabel(assessment[1])}</th><th rowspan="2" class="category-other">${headerLabel(other[1])}</th><th rowspan="2" class="category-values">${valuesHeader}</th></tr><tr>${teachingHeaders}</tr></thead><tbody></tbody>`;
  const body = table.querySelector("tbody");
  plan.entries.forEach((entry, index) => body.append(entry.type === "week" ? renderWeekRow(entry, index) : renderNoteRow(entry, index)));
  wrap.append(table); return wrap;
}
function renderWeekRow(entry, index) {
  const row = document.createElement("tr"); row.className = "week-row";
  row.dataset.entryIndex = index;
  const totalLessons = total(entry);
  row.innerHTML = `<th class="week-number" scope="row"><strong>${entry.week}</strong><span class="week-status ${totalLessons === 8 ? "valid" : "invalid"}">${totalLessons}/8節</span><button class="delete-week" title="刪除此循環週">×</button></th><td class="date-cell"><label>開始<span><select class="start-month" aria-label="第${entry.week}循環週開始月份">${dateOptions(entry.startMonth, 12, "月")}</select><select class="start-day" aria-label="第${entry.week}循環週開始日">${dateOptions(entry.startDay, 31, "日")}</select></span></label><label>結束<span><select class="end-month" aria-label="第${entry.week}循環週結束月份">${dateOptions(entry.endMonth, 12, "月")}</select><select class="end-day" aria-label="第${entry.week}循環週結束日">${dateOptions(entry.endDay, 31, "日")}</select></span></label><small>${escapeHtml(entry.date)}</small></td>`;
  [[".start-month", "startMonth"], [".start-day", "startDay"], [".end-month", "endMonth"], [".end-day", "endDay"]].forEach(([selector, field]) => row.querySelector(selector).onchange = event => { entry[field] = event.target.value; syncDateRange(entry); render(); });
  row.querySelector(".delete-week").onclick = () => { plan.entries.splice(index, 1); render(); };
  CATEGORIES.forEach(([key, label]) => row.append(key === "assessment" ? renderAssessmentCell(entry) : key === "values" ? renderValuesCell(entry) : key === "listening" ? renderListeningCell(entry, label) : key === "other" ? renderOtherCell(entry, label) : renderCategoryCell(entry, key, label)));
  return row;
}
function renderCategoryCell(entry, key, label) {
  const cell = document.createElement("td"); cell.className = `content-cell standard-cell category-${key}`;
  entry.categoryForms ||= {};
  const form = entry.categoryForms[key] ||= { open: false, draft: { text: "", lessons: 1, combinedWith: "" } };
  form.draft ||= { text: "", lessons: 1, combinedWith: "" };
  if (form.draft.combinedWith === undefined) form.draft.combinedWith = form.draft.combined ? "閱讀" : "";
  const notApplicable = entry.categories[key].some(item => item.text === "／");
  const items = entry.categories[key].filter(item => item.text !== "／");
  const saved = notApplicable ? `<div class="saved-assessment standard-saved not-applicable"><span>不適用</span><button type="button" data-standard-action="restore" title="改回填寫內容">✖</button></div>` : items.map((item, index) => `<div class="saved-assessment standard-saved saved-${key} draggable-standard" draggable="true" data-standard-index="${index}"><span>${escapeHtml(item.text)}｜${combinedText(item) || `${item.lessons}節`}</span><button type="button" class="copy-saved" data-standard-action="copy" data-standard-index="${index}" title="複製此項">▼</button><button type="button" data-standard-action="remove" data-standard-index="${index}" title="移除此項">✖</button></div>`).join("");
  const combineField = Number(form.draft.lessons) === 0 ? `<label class="combined">結合<select class="standard-combined-with" aria-label="${label}結合方式"><option value="">選擇</option><option value="閱讀" ${form.draft.combinedWith === "閱讀" ? "selected" : ""}>閱讀</option><option value="寫作" ${form.draft.combinedWith === "寫作" ? "selected" : ""}>寫作</option></select>進行</label>` : "";
  cell.innerHTML = `<div class="saved-assessment-list">${saved}</div>${form.open ? `<div class="standard-form"><textarea class="standard-text" aria-label="${label}內容" placeholder="填寫內容">${escapeHtml(form.draft.text)}</textarea><div class="lesson-line"><input class="standard-lessons" aria-label="${label}節數" type="number" min="0" step="1" value="${form.draft.lessons}" /><span>節</span></div>${combineField}<button type="button" class="add-assessment" data-standard-action="add">＋ 加入</button></div>` : ""}<div class="cell-actions"><button class="add" data-standard-action="open" title="新增內容">＋</button><button class="slash" data-standard-action="slash" title="不適用（0節）">／</button></div>`;
  const updateDraft = () => { form.draft.text = cell.querySelector(".standard-text")?.value || ""; form.draft.lessons = Math.max(0, Number(cell.querySelector(".standard-lessons")?.value || 0)); const select = cell.querySelector(".standard-combined-with"); form.draft.combinedWith = select ? select.value : ""; save(); };
  cell.querySelector(".standard-text")?.addEventListener("input", updateDraft);
  cell.querySelector(".standard-lessons")?.addEventListener("input", updateDraft);
  cell.querySelector(".standard-lessons")?.addEventListener("change", () => { updateDraft(); render(); });
  cell.querySelector(".standard-combined-with")?.addEventListener("change", () => { updateDraft(); render(); });
  cell.querySelectorAll(".draggable-standard").forEach(item => {
    item.ondragstart = () => { dragState = { entry, key, index: Number(item.dataset.standardIndex) }; item.classList.add("dragging"); };
    item.ondragend = () => { dragState = null; item.classList.remove("dragging"); };
  });
  const flexibleKeys = ["reading", "writing", "literature"];
  const canDrop = () => dragState && dragState.entry !== entry && ((flexibleKeys.includes(dragState.key) && flexibleKeys.includes(key)) || (dragState.key === "other" && key === "other"));
  cell.ondragover = event => { if (canDrop()) { event.preventDefault(); cell.classList.add("drag-over"); } };
  cell.ondragleave = () => cell.classList.remove("drag-over");
  cell.ondrop = event => { event.preventDefault(); cell.classList.remove("drag-over"); if (!canDrop()) return; const source = dragState.entry.categories[dragState.key]; const [moved] = source.splice(dragState.index, 1); if (moved) { if (entry.categories[key].length === 1 && entry.categories[key][0].text === "／") entry.categories[key] = []; entry.categories[key].push(moved); } dragState = null; render(); };
  cell.addEventListener("click", event => {
    const control = event.target.closest("[data-standard-action]"); if (!control) return;
    const action = control.dataset.standardAction;
    if (action === "open") { form.open = true; if (entry.categories[key].length === 1 && entry.categories[key][0].text === "／") entry.categories[key] = []; render(); return; }
    if (action === "slash") { entry.categories[key] = [{ text: "／", lessons: 0 }]; form.open = false; render(); return; }
    if (action === "restore") { entry.categories[key] = []; form.open = true; render(); return; }
    if (action === "copy") { const item = entry.categories[key][Number(control.dataset.standardIndex)]; if (item) entry.categories[key].push({ ...item }); render(); return; }
    if (action === "remove") { entry.categories[key].splice(Number(control.dataset.standardIndex), 1); render(); return; }
    if (action === "add") { const text = cell.querySelector(".standard-text").value.trim(); if (!text) { alert("請先填寫內容。"); return; } const lessons = Math.max(0, Number(cell.querySelector(".standard-lessons").value)); const combinedWithValue = lessons === 0 ? cell.querySelector(".standard-combined-with")?.value || "" : ""; entry.categories[key].push({ text, lessons, combined: !!combinedWithValue, combinedWith: combinedWithValue }); form.draft = { text: "", lessons: 1, combinedWith: "" }; form.open = false; render(); }
  });
  return cell;
}
function renderListeningCell(entry, label) {
  const cell = document.createElement("td"); cell.className = "content-cell listening-cell category-listening";
  const state = listeningState(entry); syncListening(entry, state);
  const saved = state.items.map((item, index) => `<div class="saved-assessment listening-saved saved-listening draggable-listening" draggable="true" data-listening-index="${index}"><span>${escapeHtml(item.mode)}：${escapeHtml(item.content)}｜${item.lessons}節</span><button type="button" class="copy-saved" data-listening-action="copy" data-listening-index="${index}" title="複製此項">▼</button><button type="button" data-listening-action="remove" data-listening-index="${index}" title="移除此項">✖</button></div>`).join("");
  const draft = state.draft;
  cell.innerHTML = `<div class="saved-assessment-list">${saved}</div>${state.open ? `<div class="listening-form"><select class="listening-mode" aria-label="${label}類型"><option value="">選擇類型</option>${LISTENING_OPTIONS.map(option => `<option value="${option}" ${draft.mode === option ? "selected" : ""}>${option}</option>`).join("")}</select><textarea class="listening-content" aria-label="${label}內容" placeholder="填寫內容">${escapeHtml(draft.content)}</textarea><div class="lesson-line"><input class="listening-lessons" aria-label="${label}節數" type="number" min="0" step="1" value="${draft.lessons}" /><span>節</span></div><button type="button" class="add-assessment" data-listening-action="add">＋ 加入</button></div>` : ""}<div class="cell-actions"><button class="add" data-listening-action="open" title="新增聆聽／視訊／說話內容">＋</button></div>`;
  const update = () => { syncListening(entry, state); save(); refreshValidation(); };
  cell.querySelector(".listening-mode")?.addEventListener("change", event => { state.draft.mode = event.target.value; update(); });
  cell.querySelector(".listening-content")?.addEventListener("input", event => { state.draft.content = event.target.value; update(); });
  cell.querySelector(".listening-lessons")?.addEventListener("input", event => { state.draft.lessons = Math.max(0, Number(event.target.value)); update(); });
  cell.querySelectorAll(".draggable-listening").forEach(item => {
    item.ondragstart = () => { listeningDragState = { entry, index: Number(item.dataset.listeningIndex) }; item.classList.add("dragging"); };
    item.ondragend = () => { listeningDragState = null; item.classList.remove("dragging"); };
  });
  cell.ondragover = event => { if (listeningDragState && listeningDragState.entry !== entry) { event.preventDefault(); cell.classList.add("drag-over"); } };
  cell.ondragleave = () => cell.classList.remove("drag-over");
  cell.ondrop = event => { event.preventDefault(); cell.classList.remove("drag-over"); if (!listeningDragState || listeningDragState.entry === entry) return; const source = listeningState(listeningDragState.entry); const target = listeningState(entry); const [moved] = source.items.splice(listeningDragState.index, 1); if (!moved) return; target.items.push(moved); target.notApplicable = false; syncListening(listeningDragState.entry, source); syncListening(entry, target); listeningDragState = null; render(); };
  cell.addEventListener("click", event => {
    const control = event.target.closest("[data-listening-action]"); if (!control) return;
    const action = control.dataset.listeningAction;
    if (action === "open") { state.open = true; state.notApplicable = false; render(); return; }
    if (action === "copy") { const item = state.items[Number(control.dataset.listeningIndex)]; if (item) state.items.push({ ...item }); syncListening(entry, state); render(); return; }
    if (action === "remove") { state.items.splice(Number(control.dataset.listeningIndex), 1); render(); return; }
    if (action === "add") {
      const item = { mode: cell.querySelector(".listening-mode").value, content: cell.querySelector(".listening-content").value, lessons: Math.max(0, Number(cell.querySelector(".listening-lessons").value)) };
      if (!item.mode || !item.content.trim()) { alert("請先選擇類型並填寫內容。"); return; }
      state.items.push(item); state.draft = blankListening(); state.open = false; state.notApplicable = false; render();
    }
  });
  return cell;
}
function renderOtherCell(entry, label) {
  const cell = document.createElement("td"); cell.className = "content-cell listening-cell other-cell category-other";
  const state = otherState(entry); syncOther(entry, state);
  const saved = state.notApplicable
    ? `<div class="saved-assessment not-applicable"><span>不適用</span><button type="button" data-other-action="restore" title="改回填寫內容">✖</button></div>`
    : state.items.map((item, index) => `<div class="saved-assessment saved-other draggable-other" draggable="true" data-other-index="${index}"><span>${escapeHtml(item.mode)}：${escapeHtml(item.content)}${otherNeedsLessons(item.mode) ? `｜${combinedText(item) || `${item.lessons}節`}` : ""}</span><button type="button" class="copy-saved" data-other-action="copy" data-other-index="${index}" title="複製此項">▼</button><button type="button" data-other-action="remove" data-other-index="${index}" title="移除此項">✖</button></div>`).join("");
  const draft = state.draft;
  const showLessons = otherNeedsLessons(draft.mode);
  const lessonField = showLessons ? `<div class="lesson-line"><input class="other-lessons" aria-label="${label}節數" type="number" min="${draft.mode === "其他" ? 1 : 0}" step="1" value="${draft.lessons}" /><span>節</span></div>` : "";
  const combineField = otherAllowsZeroLessons(draft.mode) && Number(draft.lessons) === 0 ? `<label class="combined">結合<select class="other-combined-with" aria-label="${label}結合方式"><option value="">選擇</option><option value="閱讀" ${draft.combinedWith === "閱讀" ? "selected" : ""}>閱讀</option><option value="寫作" ${draft.combinedWith === "寫作" ? "selected" : ""}>寫作</option></select>進行</label>` : "";
  cell.innerHTML = `<div class="saved-assessment-list">${saved}</div>${state.open ? `<div class="listening-form"><select class="other-mode" aria-label="${label}類型"><option value="">選擇類型</option>${OTHER_OPTIONS.map(option => `<option value="${option}" ${draft.mode === option ? "selected" : ""}>${option}</option>`).join("")}</select><textarea class="other-content" aria-label="${label}內容" placeholder="填寫內容">${escapeHtml(draft.content)}</textarea>${lessonField}${combineField}<button type="button" class="add-assessment" data-other-action="add">＋ 加入</button></div>` : ""}<div class="cell-actions"><button class="add" data-other-action="open" title="新增其他內容">＋</button><button class="slash" data-other-action="slash" title="不適用（0節）">／</button></div>`;
  const update = () => { const select = cell.querySelector(".other-combined-with"); state.draft.combinedWith = select ? select.value : ""; syncOther(entry, state); save(); refreshValidation(); };
  cell.querySelector(".other-mode")?.addEventListener("change", event => { state.draft.mode = event.target.value; state.draft.lessons = otherLessons(state.draft.mode, state.draft.lessons); if (!otherAllowsZeroLessons(state.draft.mode)) state.draft.combinedWith = ""; update(); render(); });
  cell.querySelector(".other-content")?.addEventListener("input", event => { state.draft.content = event.target.value; update(); });
  cell.querySelector(".other-lessons")?.addEventListener("input", event => { state.draft.lessons = otherLessons(state.draft.mode, event.target.value); update(); });
  cell.querySelector(".other-lessons")?.addEventListener("change", () => { update(); render(); });
  cell.querySelector(".other-combined-with")?.addEventListener("change", event => { state.draft.combinedWith = event.target.value; update(); render(); });
  cell.querySelectorAll(".draggable-other").forEach(item => {
    item.ondragstart = () => { otherDragState = { entry, index: Number(item.dataset.otherIndex) }; item.classList.add("dragging"); };
    item.ondragend = () => { otherDragState = null; item.classList.remove("dragging"); };
  });
  cell.ondragover = event => { if (otherDragState && otherDragState.entry !== entry) { event.preventDefault(); cell.classList.add("drag-over"); } };
  cell.ondragleave = () => cell.classList.remove("drag-over");
  cell.ondrop = event => { event.preventDefault(); cell.classList.remove("drag-over"); if (!otherDragState || otherDragState.entry === entry) return; const source = otherState(otherDragState.entry); const target = otherState(entry); const [moved] = source.items.splice(otherDragState.index, 1); if (!moved) return; target.items.push(moved); target.notApplicable = false; syncOther(otherDragState.entry, source); syncOther(entry, target); otherDragState = null; render(); };
  cell.addEventListener("click", event => {
    const control = event.target.closest("[data-other-action]"); if (!control) return;
    const action = control.dataset.otherAction;
    if (action === "open") { state.open = true; state.notApplicable = false; render(); return; }
    if (action === "slash") { state.items = []; state.notApplicable = true; state.open = false; syncOther(entry, state); render(); return; }
    if (action === "restore") { state.items = []; state.notApplicable = false; state.open = true; syncOther(entry, state); render(); return; }
    if (action === "copy") { const item = state.items[Number(control.dataset.otherIndex)]; if (item) state.items.push({ ...item }); syncOther(entry, state); render(); return; }
    if (action === "remove") { state.items.splice(Number(control.dataset.otherIndex), 1); syncOther(entry, state); render(); return; }
    if (action === "add") {
      const mode = cell.querySelector(".other-mode").value;
      const lessons = otherLessons(mode, cell.querySelector(".other-lessons")?.value);
      const combinedWithValue = otherAllowsZeroLessons(mode) && lessons === 0 ? cell.querySelector(".other-combined-with")?.value || "" : "";
      const item = { mode, content: cell.querySelector(".other-content").value, lessons, combined: !!combinedWithValue, combinedWith: combinedWithValue };
      if (!item.mode || !item.content.trim()) { alert("請先選擇類型並填寫內容。"); return; }
      state.items.push(item); state.draft = blankOther(); state.open = false; state.notApplicable = false; syncOther(entry, state); render();
    }
  });
  return cell;
}
function renderAssessmentCell(entry) {
  const state = assessmentState(entry); syncAssessment(entry);
  const cell = document.createElement("td"); cell.className = "content-cell assessment-cell category-assessment";
  const dictationList = state.dictations.map((item, index) => `<div class="saved-assessment saved-assessment-item draggable-assessment" draggable="true" data-drag-kind="dictation" data-drag-index="${index}"><span>默書（${escapeHtml(item.frequency || "未填頻次")}）｜${item.lessons}節｜${escapeHtml(assessmentDate(item.month, item.day) || "未填日期")}${item.noteText.trim() ? `｜${escapeHtml(item.noteText.trim())}` : ""}</span><button type="button" class="copy-saved" data-assessment-action="copy-dictation" data-dictation-index="${index}" title="複製此默書">▼</button><button type="button" data-assessment-action="remove-dictation" data-dictation-index="${index}" title="移除此默書">✖</button></div>`).join("");
  const evaluationList = state.evaluations.map((item, index) => `<div class="saved-assessment saved-assessment-item draggable-assessment" draggable="true" data-drag-kind="evaluation" data-drag-index="${index}"><span>${escapeHtml(item.type)}｜${item.lessons}節｜${item.dateTBD ? "待定" : escapeHtml(assessmentDate(item.month, item.day) || "未填日期")}${item.noteText.trim() ? `｜${escapeHtml(item.noteText.trim())}` : ""}</span><button type="button" class="copy-saved" data-assessment-action="copy-evaluation" data-evaluation-index="${index}" title="複製此評估">▼</button><button type="button" data-assessment-action="remove-evaluation" data-evaluation-index="${index}" title="移除此評估">✖</button></div>`).join("");
  const draft = state.dictationDraft, evaluationDraft = state.evaluationDraft;
  cell.innerHTML = `<div class="saved-assessment-list">${dictationList}${evaluationList}</div><div class="assessment-block"><label><button type="button" class="dictation-check assessment-check ${state.dictation ? "checked" : ""}" data-assessment-action="dictation" role="checkbox" aria-checked="${state.dictation}">${state.dictation ? "✓" : ""}</button> 默書</label><div class="assessment-details ${state.dictation ? "" : "hidden"}"><div class="assessment-form"><label>頻次<select class="dictation-frequency" aria-label="默書頻次">${dictationFrequencyOptions(draft.frequency)}</select></label><label>節數<input class="dictation-lessons" type="number" min="0" step="1" value="${draft.lessons}" /></label><label>日期<span><select class="dictation-month">${dateOptions(draft.month, 12, "月")}</select><select class="dictation-day">${dateOptions(draft.day, 31, "日")}</select></span></label><input class="dictation-note" aria-label="默書範圍備註" placeholder="填寫範圍" value="${escapeAttr(draft.noteText)}" /><button type="button" class="add-assessment" data-assessment-action="add-dictation">＋ 加入默書</button></div></div></div><div class="assessment-block"><label><button type="button" class="assessment-check ${state.evaluationEnabled ? "checked" : ""}" data-assessment-action="evaluation" role="checkbox" aria-checked="${state.evaluationEnabled}">${state.evaluationEnabled ? "✓" : ""}</button> 評估</label><div class="assessment-details evaluation-details ${state.evaluationEnabled ? "" : "hidden"}"><div class="assessment-form"><select class="evaluation-type"><option ${evaluationDraft.type === "L評（單元評估）" ? "selected" : ""}>L評（單元評估）</option><option ${evaluationDraft.type === "寫作評估" ? "selected" : ""}>寫作評估</option><option ${evaluationDraft.type === "說話評估" ? "selected" : ""}>說話評估</option><option ${evaluationDraft.type === "聆聽評估" ? "selected" : ""}>聆聽評估</option></select><label>節數<input class="evaluation-lessons" type="number" min="0" step="1" value="${evaluationDraft.lessons}" /></label><label>日期<span><select class="evaluation-month" ${evaluationDraft.dateTBD ? "disabled" : ""}>${dateOptions(evaluationDraft.month, 12, "月")}</select><select class="evaluation-day" ${evaluationDraft.dateTBD ? "disabled" : ""}>${dateOptions(evaluationDraft.day, 31, "日")}</select></span></label><label class="tbd-label"><button type="button" class="assessment-check ${evaluationDraft.dateTBD ? "checked" : ""}" data-assessment-action="tbd" role="checkbox" aria-checked="${evaluationDraft.dateTBD}">${evaluationDraft.dateTBD ? "✓" : ""}</button> 日期待定</label><input class="assessment-note" aria-label="評估範圍備註" placeholder="填寫範圍" value="${escapeAttr(evaluationDraft.noteText)}" /><button type="button" class="add-assessment" data-assessment-action="add-evaluation">＋ 加入評估</button></div></div></div>`;
  const updateAssessment = () => { syncAssessment(entry); save(); refreshValidation(); };
  [[".dictation-frequency", "frequency"], [".dictation-lessons", "lessons"], [".dictation-month", "month"], [".dictation-day", "day"]].forEach(([selector, field]) => cell.querySelector(selector).onchange = event => { state.dictationDraft[field] = event.target.value; updateAssessment(); });
  cell.querySelector(".dictation-note").oninput = event => { state.dictationDraft.noteText = event.target.value; updateAssessment(); };
  cell.querySelectorAll(".evaluation-type, .evaluation-lessons, .evaluation-month, .evaluation-day").forEach(control => { const field = control.classList.contains("evaluation-type") ? "type" : control.classList.contains("evaluation-lessons") ? "lessons" : control.classList.contains("evaluation-month") ? "month" : "day"; control.onchange = event => { state.evaluationDraft[field] = event.target.value; updateAssessment(); }; });
  cell.querySelector(".assessment-note").oninput = event => { state.evaluationDraft.noteText = event.target.value; updateAssessment(); };
  cell.querySelectorAll(".draggable-assessment").forEach(item => {
    item.ondragstart = () => { assessmentDragState = { entry, kind: item.dataset.dragKind, index: Number(item.dataset.dragIndex) }; item.classList.add("dragging"); };
    item.ondragend = () => { assessmentDragState = null; item.classList.remove("dragging"); };
  });
  cell.ondragover = event => { if (assessmentDragState && assessmentDragState.entry !== entry) { event.preventDefault(); cell.classList.add("assessment-drop-target"); } };
  cell.ondragleave = () => cell.classList.remove("assessment-drop-target");
  cell.ondrop = event => { event.preventDefault(); cell.classList.remove("assessment-drop-target"); if (!assessmentDragState || assessmentDragState.entry === entry) return; const source = assessmentState(assessmentDragState.entry); const target = assessmentState(entry); const sourceList = assessmentDragState.kind === "dictation" ? source.dictations : source.evaluations; const [moved] = sourceList.splice(assessmentDragState.index, 1); if (!moved) return; if (assessmentDragState.kind === "dictation") { target.dictation = true; target.dictations.push(moved); } else { target.evaluationEnabled = true; target.evaluations.push(moved); } syncAssessment(assessmentDragState.entry); syncAssessment(entry); assessmentDragState = null; render(); };
  return cell;
}
function renderValuesCell(entry) {
  const state = valueState(entry); syncValues(entry);
  const cell = document.createElement("td"); cell.className = "content-cell values-cell category-values";
  const remainingValues = VALUE_OPTIONS.filter(value => !state.items.some(item => item.text === value));
  const remainingSecurity = SECURITY_OPTIONS.filter(value => !state.items.some(item => item.text === value));
  cell.innerHTML = `<div class="selection-row"><select class="value-select" aria-label="選擇價值觀"><option value="">價值觀</option>${remainingValues.map(value => `<option>${value}</option>`).join("")}</select><button class="add-value">＋</button></div><div class="selection-row"><select class="security-select" aria-label="選擇國家安全領域"><option value="">國家安全領域</option>${remainingSecurity.map(value => `<option>${value}</option>`).join("")}</select><button class="add-security">＋</button></div><div class="value-chips"></div><div class="cell-actions"><button class="slash" title="不適用（0節）">／</button></div>`;
  const select = cell.querySelector(".value-select"), securitySelect = cell.querySelector(".security-select"), add = cell.querySelector(".add-value"), addSecurity = cell.querySelector(".add-security"), chips = cell.querySelector(".value-chips");
  const addSelected = selected => { if (!selected.value) return; state.items.push({ text: selected.value, priority: false }); state.notApplicable = false; syncValues(entry); render(); };
  add.onclick = () => addSelected(select);
  addSecurity.onclick = () => addSelected(securitySelect);
  state.items.forEach((item, index) => { const chip = document.createElement("div"); chip.className = "value-chip saved-values"; chip.innerHTML = `<span>${escapeHtml(item.text)}</span><button class="priority ${item.priority ? "active" : ""}" title="本年度學校關注項目">${item.priority ? "★" : "☆"}</button><button class="remove-value" title="移除此項">×</button>`; chip.querySelector(".priority").onclick = () => { item.priority = !item.priority; syncValues(entry); render(); }; chip.querySelector(".remove-value").onclick = () => { state.items.splice(index, 1); syncValues(entry); render(); }; chips.append(chip); });
  cell.querySelector(".slash").onclick = () => { state.items = []; state.notApplicable = true; syncValues(entry); render(); };
  return cell;
}
function renderItem(entry, key, item, itemIndex) {
  const fragment = document.querySelector("#item-template").content.cloneNode(true); const row = fragment.querySelector(".lesson-item");
  const text = row.querySelector(".item-text"), lessons = row.querySelector(".item-lessons"), combined = row.querySelector(".item-combined-with"), priority = row.querySelector(".priority"); text.value = item.text; lessons.value = item.lessons; combined.value = combinedWith(item); lessons.disabled = !!combined.value;
  text.oninput = event => { item.text = event.target.value; save(); }; lessons.oninput = event => { item.lessons = Math.max(0, Number(event.target.value)); render(); };
  combined.onchange = event => { item.combinedWith = event.target.value; item.combined = !!event.target.value; item.lessons = event.target.value ? 0 : 1; render(); };
  if (key === "values") { priority.textContent = item.priority ? "★" : "☆"; priority.classList.toggle("active", !!item.priority); priority.onclick = () => { item.priority = !item.priority; render(); }; } else { priority.remove(); }
  row.querySelector(".remove-item").onclick = () => { entry.categories[key].splice(itemIndex, 1); render(); };
  const handle = row.querySelector(".drag-handle"); handle.draggable = true;
  handle.ondragstart = () => { dragState = { entry, key, index: itemIndex }; row.classList.add("dragging"); };
  handle.ondragend = () => { dragState = null; row.classList.remove("dragging"); };
  return row;
}
function renderNoteRow(entry, index) { const row = document.createElement("tr"); row.className = "note-table-row"; row.innerHTML = `<td colspan="9"><div class="note-inline"><textarea aria-label="全寬備註" placeholder="例：第一次考試（24–28/11）\n對卷日（3–4/12）">${escapeHtml(entry.note || "")}</textarea><button title="刪除此備註列">×</button></div></td>`; row.querySelector("textarea").oninput = event => { entry.note = event.target.value; save(); }; row.querySelector("button").onclick = () => { plan.entries.splice(index, 1); render(); }; return row; }
function escapeHtml(value) { return String(value).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }
function escapeAttr(value) { return escapeHtml(value); }
function chooseLocalTemplate() { return new Promise(resolve => { const input = document.querySelector("#template-file"); input.value = ""; input.onchange = () => resolve(input.files?.[0] || null); input.click(); }); }
async function download() { const errors = allIssues(); if (errors.length && !confirm(`表格尚有 ${errors.length} 項未完成資料。是否仍要下載未完成表格？`)) return; const button = document.querySelector("#download-docx"); button.disabled = true; button.textContent = "正在建立 Word…"; try { const localTemplate = location.protocol === "file:" ? await chooseLocalTemplate() : null; if (location.protocol === "file:" && !localTemplate) return; const { exportDocx } = await import("./docx-export.js"); await exportDocx(plan, `${currentFilename()}.docx`, localTemplate); } catch (error) { alert(error?.message || "瀏覽器未能建立 Word 檔案。"); } finally { button.disabled = false; button.textContent = "下載 Word"; } }
["year", "semester", "grade", "teacher"].forEach(key => document.querySelector(`#${key}`).oninput = event => { plan.meta[key] = event.target.value; render(); });
document.querySelector("#add-week").onclick = () => { plan.entries.push(week(0)); render(); };
document.querySelector("#add-note").onclick = () => { plan.entries.push({ type: "note", note: "" }); render(); };
document.querySelector("#clear").onclick = () => { if (confirm("確定要清除目前草稿嗎？")) { plan = defaultPlan(); render(); } };
document.querySelector("#download-docx").onclick = () => download();
document.querySelector("#entries").addEventListener("click", event => {
  const control = event.target.closest("[data-assessment-action]");
  if (!control) return;
  const row = control.closest(".week-row");
  const entry = row && plan.entries[Number(row.dataset.entryIndex)];
  if (!entry) return;
  const state = assessmentState(entry);
  const cell = control.closest(".assessment-cell");
  if (control.dataset.assessmentAction === "dictation") { state.dictation = !state.dictation; state.notApplicable = false; }
  if (control.dataset.assessmentAction === "evaluation") state.evaluationEnabled = !state.evaluationEnabled;
  if (control.dataset.assessmentAction === "add-dictation") {
    const draft = { frequency: cell.querySelector(".dictation-frequency").value, lessons: cell.querySelector(".dictation-lessons").value, month: cell.querySelector(".dictation-month").value, day: cell.querySelector(".dictation-day").value, noteText: cell.querySelector(".dictation-note").value };
    if (!draft.frequency || !draft.month || !draft.day) { alert("請先選擇默書頻次及日期。"); return; }
    state.dictations.push(draft); state.dictationDraft = blankDictation();
  }
  if (control.dataset.assessmentAction === "add-evaluation") {
    const draft = { type: cell.querySelector(".evaluation-type").value, lessons: cell.querySelector(".evaluation-lessons").value, month: cell.querySelector(".evaluation-month").value, day: cell.querySelector(".evaluation-day").value, dateTBD: state.evaluationDraft.dateTBD, noteText: cell.querySelector(".assessment-note").value };
    if (!draft.dateTBD && (!draft.month || !draft.day)) { alert("請先選擇評估日期或勾選日期待定。"); return; }
    state.evaluations.push(draft); state.evaluationDraft = blankEvaluation();
  }
  if (control.dataset.assessmentAction === "copy-dictation") { const item = state.dictations[Number(control.dataset.dictationIndex)]; if (item) state.dictations.push({ ...item }); }
  if (control.dataset.assessmentAction === "copy-evaluation") { const item = state.evaluations[Number(control.dataset.evaluationIndex)]; if (item) state.evaluations.push({ ...item }); }
  if (control.dataset.assessmentAction === "remove-dictation") state.dictations.splice(Number(control.dataset.dictationIndex), 1);
  if (control.dataset.assessmentAction === "remove-evaluation") state.evaluations.splice(Number(control.dataset.evaluationIndex), 1);
  if (control.dataset.assessmentAction === "tbd") state.evaluationDraft.dateTBD = !state.evaluationDraft.dateTBD;
  syncAssessment(entry); render();
});
render();
