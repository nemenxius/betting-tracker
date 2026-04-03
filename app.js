const { createClient } = window.supabase;

const config = window.APP_CONFIG || {};
const hasValidConfig =
  typeof config.supabaseUrl === "string" &&
  typeof config.supabaseAnonKey === "string" &&
  config.supabaseUrl.startsWith("https://") &&
  !config.supabaseUrl.includes("YOUR_PROJECT_ID") &&
  !config.supabaseAnonKey.includes("YOUR_SUPABASE_ANON_KEY") &&
  config.supabaseAnonKey.trim().length > 20;

const elements = {
  authForm: document.querySelector("#auth-form"),
  email: document.querySelector("#auth-email"),
  password: document.querySelector("#auth-password"),
  logoutButton: document.querySelector("#logout-button"),
  openEntryButton: document.querySelector("#open-entry-button"),
  closeEntryButton: document.querySelector("#close-entry-button"),
  entryModal: document.querySelector("#entry-modal"),
  openOcrButton: document.querySelector("#open-ocr-button"),
  closeOcrButton: document.querySelector("#close-ocr-button"),
  ocrModal: document.querySelector("#ocr-modal"),
  ocrMessageBox: document.querySelector("#ocr-message-box"),
  ocrDebugText: document.querySelector("#ocr-debug-text"),
  ocrFile: document.querySelector("#ocr-file"),
  applyOcrButton: document.querySelector("#apply-ocr-button"),
  ocrButton: document.querySelector("#ocr-button"),
  openImportButton: document.querySelector("#open-import-button"),
  closeImportButton: document.querySelector("#close-import-button"),
  importModal: document.querySelector("#import-modal"),
  authMessageBox: document.querySelector("#auth-message-box"),
  userPanel: document.querySelector("#user-panel"),
  userEmail: document.querySelector("#user-email"),
  importMessageBox: document.querySelector("#import-message-box"),
  importFile: document.querySelector("#import-file"),
  importButton: document.querySelector("#import-button"),
  betForm: document.querySelector("#bet-form"),
  editingBanner: document.querySelector("#editing-banner"),
  cancelEditButton: document.querySelector("#cancel-edit-button"),
  saveBetButton: document.querySelector("#save-bet-button"),
  tipster: document.querySelector("#tipster"),
  bookie: document.querySelector("#bookie"),
  sport: document.querySelector("#sport"),
  tipsterOptions: document.querySelector("#tipster-options"),
  bookieOptions: document.querySelector("#bookie-options"),
  sportOptions: document.querySelector("#sport-options"),
  eventName: document.querySelector("#event-name"),
  marketName: document.querySelector("#market-name"),
  betType: document.querySelector("#bet-type"),
  betDate: document.querySelector("#bet-date"),
  stake: document.querySelector("#stake"),
  odds: document.querySelector("#odds"),
  status: document.querySelector("#status"),
  settlementField: document.querySelector("#settlement-field"),
  settlementReturn: document.querySelector("#settlement-return"),
  notes: document.querySelector("#notes"),
  betsList: document.querySelector("#bets-list"),
  pagination: document.querySelector("#pagination"),
  prevPageButton: document.querySelector("#prev-page-button"),
  nextPageButton: document.querySelector("#next-page-button"),
  pageIndicator: document.querySelector("#page-indicator"),
  messageBox: document.querySelector("#message-box"),
  configWarning: document.querySelector("#config-warning"),
  filterStatus: document.querySelector("#filter-status"),
  filterQuery: document.querySelector("#filter-query"),
  filterMonth: document.querySelector("#filter-month"),
  filterTipster: document.querySelector("#filter-tipster"),
  filterBookie: document.querySelector("#filter-bookie"),
  filterSport: document.querySelector("#filter-sport"),
  filterBetType: document.querySelector("#filter-bet-type"),
  sortBy: document.querySelector("#sort-by"),
  statTotal: document.querySelector("#stat-total"),
  statProfit: document.querySelector("#stat-profit"),
  statRoi: document.querySelector("#stat-roi"),
  statAverageOdds: document.querySelector("#stat-average-odds"),
  statTotalStake: document.querySelector("#stat-total-stake"),
  statStatusBreakdown: document.querySelector("#stat-status-breakdown"),
  statStatusDetail: document.querySelector("#stat-status-detail")
};

const defaultDate = new Date().toISOString().split("T")[0];
elements.betDate.value = defaultDate;

let supabaseClient = null;
let currentUser = null;
let bets = [];
let suggestions = {
  tipsters: [],
  bookies: [],
  sports: []
};
let authSubscription = null;
let editingBetId = null;
let currentPage = 1;
const PAGE_SIZE = 12;
let pendingOcrPrefill = null;

if (hasValidConfig) {
  supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey);
} else {
  elements.configWarning.classList.remove("hidden");
  setMessage("Preenche o ficheiro config.js antes de usar a app.", "warning");
  disableForms(true);
}

function disableForms(disabled) {
  [elements.authForm, elements.betForm].forEach((form) => {
    [...form.elements].forEach((field) => {
      field.disabled = disabled;
    });
  });
}

function setNotice(target, message, tone) {
  target.textContent = message;
  target.classList.remove("hidden", "warning");

  if (tone === "warning") {
    target.classList.add("warning");
  }
}

function clearNotice(target) {
  target.classList.add("hidden");
  target.textContent = "";
  target.classList.remove("warning");
}

function setMessage(message, tone = "info") {
  setNotice(elements.messageBox, message, tone);
}

function clearMessage() {
  clearNotice(elements.messageBox);
}

function showTransientMessage(message, tone = "info", durationMs = 4000) {
  setMessage(message, tone);
  window.setTimeout(() => {
    if (elements.messageBox.textContent === message) {
      clearMessage();
    }
  }, durationMs);
}

function setAuthMessage(message, tone = "info") {
  setNotice(elements.authMessageBox, message, tone);
}

function clearAuthMessage() {
  clearNotice(elements.authMessageBox);
}

function setImportMessage(message, tone = "info") {
  setNotice(elements.importMessageBox, message, tone);
}

function clearImportMessage() {
  clearNotice(elements.importMessageBox);
}

function setOcrMessage(message, tone = "info") {
  setNotice(elements.ocrMessageBox, message, tone);
}

function clearOcrMessage() {
  clearNotice(elements.ocrMessageBox);
}

function openImportModal() {
  if (!currentUser) {
    return;
  }

  clearImportMessage();
  document.body.style.overflow = "hidden";
  elements.importModal.classList.remove("hidden");
}

function closeImportModal() {
  elements.importModal.classList.add("hidden");
  elements.importFile.value = "";
  clearImportMessage();
  if (elements.entryModal.classList.contains("hidden")) {
    document.body.style.overflow = "";
  }
}

function openOcrModal() {
  if (!currentUser) {
    return;
  }

  clearOcrMessage();
  document.body.style.overflow = "hidden";
  elements.ocrModal.classList.remove("hidden");
}

function closeOcrModal() {
  elements.ocrModal.classList.add("hidden");
  elements.ocrFile.value = "";
  elements.ocrDebugText.textContent = "";
  pendingOcrPrefill = null;
  clearOcrMessage();
  if (elements.entryModal.classList.contains("hidden") && elements.importModal.classList.contains("hidden")) {
    document.body.style.overflow = "";
  }
}

function openEntryModal() {
  if (!currentUser) {
    return;
  }

  document.body.style.overflow = "hidden";
  elements.entryModal.classList.remove("hidden");
}

function closeEntryModal() {
  elements.entryModal.classList.add("hidden");
  if (elements.importModal.classList.contains("hidden")) {
    document.body.style.overflow = "";
  }
}

function formatUnits(value) {
  return `${Number(value || 0).toFixed(2)}u`;
}

function formatStatus(status) {
  const labels = {
    pending: "Pendente",
    won: "Ganha",
    lost: "Perdida",
    half_won: "Half Won",
    half_lost: "Half Lost",
    cashout: "Cashout",
    partial_void: "Partial Void",
    void: "Void"
  };

  return labels[status] || status;
}

function deriveBetType(marketName) {
  const value = String(marketName || "").trim().toLowerCase();

  if (!value) {
    return "";
  }

  if (value.includes("over") || value.includes("mais") || value.includes("acima")) {
    return "Overs";
  }

  if (value.includes("under") || value.includes("menos") || value.includes("abaixo")) {
    return "Unders";
  }

  if (value.includes("btts no")) {
    return "BTTS NO";
  }

  if (value.includes("btts yes")) {
    return "BTTS YES";
  }

  if (value.includes("result")) {
    return "Result";
  }

  if (value.includes("handicap")) {
    return "Handicap";
  }

  return "Other";
}

function normalizeOcrText(text) {
  return text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .map((line) => line.replace(/^[•.\-: ]+/, "").trim())
    .filter(Boolean);
}

function stripScorePrefix(line) {
  return line
    .replace(/^\d+[:.]\d+\s*/, "")
    .replace(/\(\d+[-:]\d+\)\s*/g, "")
    .replace(/^&\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMarketSegment(line) {
  const cleaned = stripScorePrefix(line);
  const patterns = [
    /btts\s+(yes|no)/i,
    /under\s*\d+[.,]?\d*/i,
    /over\s*\d+[.,]?\d*/i,
    /mais\s*de?\s*\d+[.,]?\d*/i,
    /menos\s*de?\s*\d+[.,]?\d*/i,
    /handicap.+/i
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      return match[0]
        .replace(/\bunder\s*25\b/i, "under 2.5")
        .replace(/\bover\s*25\b/i, "over 2.5")
        .replace(/\b25\b/g, "2.5")
        .replace(/\s+/g, " ")
        .trim();
    }
  }

  return "";
}

function extractDatesFromLines(lines) {
  const dates = [];
  const regex = /\b(\d{2})[./](\d{2})[./](\d{4})\b/g;

  lines.forEach((line) => {
    let match;
    while ((match = regex.exec(line)) !== null) {
      const [, day, month, year] = match;
      dates.push(`${year}-${month}-${day}`);
    }
  });

  return [...new Set(dates)];
}

function detectEventFromLines(lines) {
  const cleanLines = lines.map((line) => stripScorePrefix(line));

  for (let index = 0; index < cleanLines.length - 1; index += 1) {
    const first = cleanLines[index];
    const second = cleanLines[index + 1];

    if (/total:/i.test(first) && extractMarketSegment(second)) {
      const homeTeam = first.replace(/total:.*/i, "").trim();
      const awayTeam = second.replace(extractMarketSegment(second), "").trim();

      if (homeTeam && awayTeam) {
        return `${homeTeam} - ${awayTeam}`;
      }
    }
  }

  const versusLine = cleanLines.find((line) => /\b(vs| - )\b/i.test(line) && !/single|pending|pick|result|total:|bet_id|liga|league|\d{2}[./]\d{2}[./]\d{4}/i.test(line));
  if (versusLine) {
    return versusLine.replace(/\s+/g, " ").trim();
  }

  for (let index = 0; index < cleanLines.length - 1; index += 1) {
    const first = cleanLines[index];
    const secondRaw = cleanLines[index + 1];
    const second = secondRaw.replace(extractMarketSegment(secondRaw), "").replace(/^&\s*/, "").trim();
    const looksLikeMeta = /single|pending|pick|result|total:?|odds|stake|bet_id|liga|league|mexico|football|soccer|€|\d{2}[./]\d{2}[./]\d{4}|\b\d+[.,]\d{2}\b/i;
    if (
      first.length > 5 &&
      second.length > 3 &&
      !looksLikeMeta.test(first) &&
      !looksLikeMeta.test(second) &&
      !/\b(total|under|over|btts|handicap|result)\b/i.test(first) &&
      !/\b(total|under|over|btts|handicap|result)\b/i.test(second)
    ) {
      return `${first} - ${second}`;
    }
  }

  return "";
}

function detectMarketFromLines(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = stripScorePrefix(lines[index]);
    if (/^total:/i.test(line)) {
      const rest = line.replace(/^total:\s*/i, "").trim();
      if (rest) {
        return rest;
      }

      for (let offset = 1; offset <= 2; offset += 1) {
        const nextLine = lines[index + offset];
        if (nextLine && !/^(pick|result)$/i.test(nextLine)) {
          return nextLine;
        }
      }
    }
  }

  for (const line of lines) {
    const extracted = extractMarketSegment(line);
    if (extracted) {
      return extracted;
    }
  }

  const directMatch = lines
    .map((line) => extractMarketSegment(line))
    .find(Boolean);
  return directMatch || "";
}

function detectOddsFromLines(lines) {
  const exactLine = lines.find((line) => /^\d+[.,]\d{2}$/.test(line));
  if (exactLine) {
    return Number(exactLine.replace(",", "."));
  }

  const singleBetLine = lines.find((line) => /single bet/i.test(line));
  if (singleBetLine) {
    const match = singleBetLine.match(/(\d+[.,]\d{2})/);
    if (match) {
      return Number(match[1].replace(",", "."));
    }
  }

  const candidates = [];
  lines.forEach((line) => {
    const matches = line.match(/\d+[.,]\d{2}/g) || [];
    matches.forEach((value) => {
      const parsed = Number(value.replace(",", "."));
      if (parsed >= 1.01 && parsed <= 20) {
        candidates.push(parsed);
      }
    });
  });

  return candidates[0] || "";
}

function detectStatusFromLines(lines) {
  const joined = lines.join(" ").toLowerCase();

  if (joined.includes("pending")) {
    return "pending";
  }
  if (joined.includes("won")) {
    return "won";
  }
  if (joined.includes("lost")) {
    return "lost";
  }
  if (joined.includes("refund") || joined.includes("void")) {
    return "void";
  }

  return "pending";
}

function extractBetFromOcrText(text) {
  const lines = normalizeOcrText(text);
  const dates = extractDatesFromLines(lines);
  let market = detectMarketFromLines(lines);
  let eventName = detectEventFromLines(lines);
  const odds = detectOddsFromLines(lines);
  const status = detectStatusFromLines(lines);
  const hasLikelyGameDate = dates.length >= 2;

  // Explicit fallback for the bookmaker layout seen in exemplo1.
  const totalLineIndex = lines.findIndex((line) => /total:/i.test(line));
  if (totalLineIndex >= 0 && totalLineIndex + 1 < lines.length) {
    const homeLine = stripScorePrefix(lines[totalLineIndex]);
    const awayLine = stripScorePrefix(lines[totalLineIndex + 1]);
    const homeTeam = homeLine.replace(/total:.*/i, "").trim();
    const extractedMarket = extractMarketSegment(awayLine);
    const awayTeam = awayLine.replace(extractedMarket, "").trim();

    if (!eventName && homeTeam && awayTeam) {
      eventName = `${homeTeam} - ${awayTeam}`;
    }

    if (!market && extractedMarket) {
      market = extractedMarket;
    }
  }

  return {
    eventName,
    marketName: market,
    odds,
    status,
    betDate: hasLikelyGameDate ? dates[1] : "",
    notes: "Pré-preenchido por OCR. Confirma os dados antes de guardar."
  };
}

function applyOcrPrefill(prefill) {
  openEntryModal();
  clearMessage();
  elements.eventName.value = prefill.eventName || "";
  elements.marketName.value = prefill.marketName || "";
  elements.betType.value = deriveBetType(prefill.marketName || "");
  elements.odds.value = prefill.odds || "";
  elements.status.value = prefill.status || "pending";
  elements.betDate.value = prefill.betDate || "";
  elements.notes.value = prefill.notes || "";
  updateSettlementVisibility();
}

function handleApplyOcrPrefill() {
  if (!pendingOcrPrefill) {
    setOcrMessage("Analisa uma imagem primeiro.", "warning");
    return;
  }

  applyOcrPrefill(pendingOcrPrefill);
  closeOcrModal();
  showTransientMessage("Campos pré-preenchidos por OCR. Revê e guarda a aposta.");
}

function normalizeImportedStatus(rawStatus) {
  const value = String(rawStatus || "").trim().toUpperCase();

  if (value === "W") {
    return "won";
  }

  if (value === "L") {
    return "lost";
  }

  if (value === "R") {
    return "void";
  }

  if (value === "TBD" || value === "") {
    return "pending";
  }

  return "pending";
}

function parsePtDateToIso(rawDate) {
  const value = String(rawDate || "").trim();
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return "";
  }

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function parseCsv(text) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((line) => line.trim() !== "");
  if (!lines.length) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((record, header, index) => {
      record[header] = values[index] || "";
      return record;
    }, {});
  });
}

function mapImportedRow(row) {
  const marketName = row.Bet || "";
  const status = normalizeImportedStatus(row.Result);
  const stake = Number(row.Stake || 0);
  const odds = Number(row.Odds || 0);
  const payout = row.Payout === "" ? null : Number(row.Payout);
  const profit = row["P/L"] === "" ? calculateProfit(stake, odds, status, payout) : Number(row["P/L"]);

  return {
    tipster: row.Tipster || null,
    bookie: row.Bookie || null,
    sport: row.Sport || null,
    event_name: row.Match || "Sem evento",
    market_name: marketName,
    bet_type: row.Type || deriveBetType(marketName),
    bet_date: parsePtDateToIso(row.Date),
    stake,
    odds,
    status,
    settlement_return: status === "cashout" || status === "partial_void" ? payout : null,
    profit,
    notes: null
  };
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function calculateProfit(stake, odds, status, settlementReturn) {
  const numericStake = Number(stake);
  const numericOdds = Number(odds);
  const numericSettlement = Number(settlementReturn);

  if (status === "won") {
    return Number((numericStake * numericOdds - numericStake).toFixed(2));
  }

  if (status === "lost") {
    return Number((-numericStake).toFixed(2));
  }

  if (status === "half_won") {
    return Number((((numericStake / 2) * numericOdds + numericStake / 2) - numericStake).toFixed(2));
  }

  if (status === "half_lost") {
    return Number((-(numericStake / 2)).toFixed(2));
  }

  if (status === "cashout" || status === "partial_void") {
    return Number((numericSettlement - numericStake).toFixed(2));
  }

  return 0;
}

function requiresSettlement(status) {
  return status === "cashout" || status === "partial_void";
}

function getStatusOptionsMarkup(selectedStatus) {
  const options = [
    ["pending", "Pendente"],
    ["won", "Ganha"],
    ["lost", "Perdida"],
    ["half_won", "Half Won"],
    ["half_lost", "Half Lost"],
    ["cashout", "Cashout"],
    ["partial_void", "Partial Void"],
    ["void", "Void"]
  ];

  return options
    .map(([value, label]) => `<option value="${value}"${value === selectedStatus ? " selected" : ""}>${label}</option>`)
    .join("");
}

function updateSettlementVisibility() {
  const visible = requiresSettlement(elements.status.value);
  elements.settlementField.classList.toggle("hidden", !visible);
  elements.settlementReturn.required = visible;
  if (!visible) {
    elements.settlementReturn.value = "";
  }
}

function renderDataList(target, values) {
  const uniqueValues = [...new Set(values.filter(Boolean).map((value) => String(value).trim()))]
    .sort((left, right) => left.localeCompare(right, "pt-PT"));

  target.innerHTML = uniqueValues
    .map((value) => `<option value="${escapeHtml(value)}"></option>`)
    .join("");
}

function updateAutocompleteOptions() {
  renderDataList(elements.tipsterOptions, suggestions.tipsters.concat(bets.map((bet) => bet.tipster)));
  renderDataList(elements.bookieOptions, suggestions.bookies.concat(bets.map((bet) => bet.bookie)));
  renderDataList(elements.sportOptions, suggestions.sports.concat(bets.map((bet) => bet.sport)));
}

function updateStats(sourceBets) {
  const resolvedBets = sourceBets.filter((bet) => bet.status !== "pending");
  const totalProfit = sourceBets.reduce((sum, bet) => sum + Number(bet.profit || 0), 0);
  const totalStake = sourceBets.reduce((sum, bet) => sum + Number(bet.stake || 0), 0);
  const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;
  const averageOdds = sourceBets.length
    ? sourceBets.reduce((sum, bet) => sum + Number(bet.odds || 0), 0) / sourceBets.length
    : 0;
  const wins = sourceBets.filter((bet) => bet.status === "won" || bet.status === "half_won").length;
  const losses = sourceBets.filter((bet) => bet.status === "lost" || bet.status === "half_lost").length;
  const voids = sourceBets.filter((bet) => bet.status === "void" || bet.status === "partial_void").length;
  const cashouts = sourceBets.filter((bet) => bet.status === "cashout").length;
  const pending = sourceBets.filter((bet) => bet.status === "pending").length;

  elements.statTotal.textContent = String(sourceBets.length);
  elements.statProfit.textContent = formatUnits(totalProfit);
  elements.statRoi.textContent = `${roi.toFixed(1)}%`;
  elements.statAverageOdds.textContent = averageOdds.toFixed(2);
  elements.statTotalStake.textContent = formatUnits(totalStake);
  elements.statStatusBreakdown.textContent = `${wins}W / ${losses}L`;
  elements.statStatusDetail.textContent = `${voids}V / ${cashouts}C / ${pending}P`;
}

function updatePagination(totalItems) {
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  currentPage = Math.min(currentPage, totalPages);

  if (totalItems <= PAGE_SIZE) {
    elements.pagination.classList.add("hidden");
    return totalPages;
  }

  elements.pagination.classList.remove("hidden");
  elements.pageIndicator.textContent = `Página ${currentPage} de ${totalPages}`;
  elements.prevPageButton.disabled = currentPage <= 1;
  elements.nextPageButton.disabled = currentPage >= totalPages;
  return totalPages;
}

function resetBetForm() {
  editingBetId = null;
  elements.betForm.reset();
  elements.betDate.value = defaultDate;
  elements.status.value = "pending";
  elements.betType.value = "";
  elements.settlementReturn.value = "";
  updateSettlementVisibility();
  elements.editingBanner.classList.add("hidden");
  elements.saveBetButton.textContent = "Guardar aposta";
  closeEntryModal();
}

function startEditingBet(betId) {
  const bet = bets.find((entry) => String(entry.id) === String(betId));
  if (!bet) {
    return;
  }

  editingBetId = bet.id;
  elements.tipster.value = bet.tipster || "";
  elements.bookie.value = bet.bookie || "";
  elements.sport.value = bet.sport || "";
  elements.eventName.value = bet.event_name || "";
  elements.marketName.value = bet.market_name || "";
  elements.betType.value = bet.bet_type || deriveBetType(bet.market_name);
  elements.betDate.value = bet.bet_date || defaultDate;
  elements.stake.value = bet.stake ?? "";
  elements.odds.value = bet.odds ?? "";
  elements.status.value = bet.status || "pending";
  elements.settlementReturn.value = bet.settlement_return ?? "";
  elements.notes.value = bet.notes || "";
  updateSettlementVisibility();
  elements.editingBanner.classList.remove("hidden");
  elements.saveBetButton.textContent = "Atualizar aposta";
  openEntryModal();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderBets() {
  const query = elements.filterQuery.value.trim().toLowerCase();
  const filterStatus = elements.filterStatus.value;
  const filterMonth = elements.filterMonth.value;
  const filterTipster = elements.filterTipster.value.trim().toLowerCase();
  const filterBookie = elements.filterBookie.value.trim().toLowerCase();
  const filterSport = elements.filterSport.value.trim().toLowerCase();
  const filterBetType = elements.filterBetType.value;
  const sortBy = elements.sortBy.value;

  const filteredBets = bets.filter((bet) => {
    const matchesStatus = filterStatus === "all" || bet.status === filterStatus;
    const matchesMonth = !filterMonth || String(bet.bet_date || "").startsWith(filterMonth);
    const matchesTipster = !filterTipster || String(bet.tipster || "").toLowerCase().includes(filterTipster);
    const matchesBookie = !filterBookie || String(bet.bookie || "").toLowerCase().includes(filterBookie);
    const matchesSport = !filterSport || String(bet.sport || "").toLowerCase().includes(filterSport);
    const matchesBetType = filterBetType === "all" || bet.bet_type === filterBetType;
    const haystack = [bet.event_name, bet.market_name, bet.notes]
      .concat([bet.tipster, bet.bookie, bet.sport, bet.bet_type])
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesQuery = !query || haystack.includes(query);

    return matchesStatus && matchesMonth && matchesQuery && matchesTipster && matchesBookie && matchesSport && matchesBetType;
  }).sort((left, right) => {
    if (sortBy === "date_asc") {
      return String(left.bet_date).localeCompare(String(right.bet_date));
    }
    if (sortBy === "profit_desc") {
      return Number(right.profit || 0) - Number(left.profit || 0);
    }
    if (sortBy === "profit_asc") {
      return Number(left.profit || 0) - Number(right.profit || 0);
    }
    if (sortBy === "stake_desc") {
      return Number(right.stake || 0) - Number(left.stake || 0);
    }
    if (sortBy === "stake_asc") {
      return Number(left.stake || 0) - Number(right.stake || 0);
    }
    return String(right.bet_date).localeCompare(String(left.bet_date));
  });

  updateStats(filteredBets);

  if (!currentUser) {
    elements.betsList.className = "bets-list empty-state";
    elements.betsList.textContent = "Inicia sessão para veres e criares registos.";
    elements.pagination.classList.add("hidden");
    return;
  }

  if (!filteredBets.length) {
    elements.betsList.className = "bets-list empty-state";
    elements.betsList.textContent = "Ainda não existem apostas para este filtro.";
    elements.pagination.classList.add("hidden");
    return;
  }

  const totalPages = updatePagination(filteredBets.length);
  currentPage = Math.min(currentPage, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleBets = filteredBets.slice(startIndex, startIndex + PAGE_SIZE);

  elements.betsList.className = "bets-list";
  elements.betsList.innerHTML = visibleBets
    .map((bet) => {
      const profitClass = Number(bet.profit) >= 0 ? "status-won" : "status-lost";
      const notes = bet.notes ? `<p>${escapeHtml(bet.notes)}</p>` : "";

      return `
        <article class="bet-item">
          <div class="bet-item-header">
            <div>
              <h3>${escapeHtml(bet.event_name)}</h3>
              <p>${escapeHtml(bet.market_name)}</p>
            </div>
            <span class="status-pill status-${escapeHtml(bet.status)}">${formatStatus(bet.status)}</span>
          </div>
          <div class="bet-tags">
            <span>${formatDate(bet.bet_date)}</span>
            <span>${escapeHtml(bet.tipster || "Sem tipster")}</span>
            <span>${escapeHtml(bet.bookie || "Sem bookie")}</span>
            <span>${escapeHtml(bet.sport || "Sem sport")}</span>
            <span>${escapeHtml(bet.bet_type || "Other")}</span>
            <span>Stake: ${formatUnits(bet.stake)}</span>
            <span>Odds: ${Number(bet.odds).toFixed(2)}</span>
            <span class="${profitClass}">Lucro: ${bet.status === "pending" ? "-" : formatUnits(bet.profit)}</span>
          </div>
          ${notes}
          <div class="bet-item-actions">
            <select class="status-select" data-id="${bet.id}">
              ${getStatusOptionsMarkup(bet.status)}
            </select>
            <button type="button" class="ghost-button" data-action="update-status" data-id="${bet.id}">Atualizar estado</button>
            <button type="button" class="ghost-button" data-action="edit" data-id="${bet.id}">Editar</button>
            <button type="button" class="ghost-button" data-action="delete" data-id="${bet.id}">Apagar</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function formatDate(rawDate) {
  if (!rawDate) {
    return "Sem data";
  }

  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "medium"
  }).format(new Date(rawDate));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setAuthUi(user) {
  currentUser = user;
  const isLoggedIn = Boolean(user);

  elements.userPanel.classList.toggle("hidden", !isLoggedIn);
  elements.logoutButton.classList.toggle("hidden", !isLoggedIn);
  elements.authForm.classList.toggle("hidden", isLoggedIn);

  if (isLoggedIn) {
    clearAuthMessage();
  } else {
    resetBetForm();
    currentPage = 1;
    closeEntryModal();
    closeImportModal();
    closeOcrModal();
  }

  elements.betForm.querySelectorAll("input, select, textarea, button").forEach((field) => {
    field.disabled = !isLoggedIn;
  });

  renderBets();
}

async function fetchBets() {
  if (!supabaseClient || !currentUser) {
    bets = [];
    suggestions = { tipsters: [], bookies: [], sports: [] };
    updateAutocompleteOptions();
    currentPage = 1;
    renderBets();
    return;
  }

  const { data, error } = await supabaseClient
    .from("bets")
    .select("*")
    .order("bet_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    setMessage(error.message, "warning");
    return;
  }

  bets = data || [];
  bets = bets.map((bet) => ({
    ...bet,
    bookie: bet.bookie || bet.bookmaker || null,
    bet_type: bet.bet_type || deriveBetType(bet.market_name)
  }));
  updateAutocompleteOptions();
  renderBets();
}

async function fetchSuggestions() {
  if (!supabaseClient || !currentUser) {
    suggestions = { tipsters: [], bookies: [], sports: [] };
    updateAutocompleteOptions();
    return;
  }

  const [tipstersResult, bookiesResult, sportsResult] = await Promise.all([
    supabaseClient.from("tipsters").select("name").order("name", { ascending: true }),
    supabaseClient.from("bookies").select("name").order("name", { ascending: true }),
    supabaseClient.from("sports").select("name").order("name", { ascending: true })
  ]);

  const maybeError = tipstersResult.error || bookiesResult.error || sportsResult.error;
  if (maybeError) {
    setMessage(maybeError.message, "warning");
    return;
  }

  suggestions = {
    tipsters: (tipstersResult.data || []).map((row) => row.name),
    bookies: (bookiesResult.data || []).map((row) => row.name),
    sports: (sportsResult.data || []).map((row) => row.name)
  };

  updateAutocompleteOptions();
}

async function syncSuggestion(table, value) {
  const cleanValue = String(value || "").trim();
  if (!cleanValue) {
    return;
  }

  const { error } = await supabaseClient
    .from(table)
    .upsert({ name: cleanValue }, { onConflict: "user_id,name", ignoreDuplicates: true });

  if (error) {
    setMessage(error.message, "warning");
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  clearMessage();
  clearAuthMessage();

  const email = elements.email.value.trim();
  const password = elements.password.value.trim();

  try {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      setAuthMessage(error.message, "warning");
      return;
    }

    setAuthMessage("Sessão iniciada com sucesso.");
    elements.authForm.reset();
  } catch (error) {
    setAuthMessage(error.message || "Ocorreu um erro ao iniciar sessão.", "warning");
  }
}

async function handleLogout() {
  clearAuthMessage();
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    setMessage(error.message, "warning");
    return;
  }

  bets = [];
  setMessage("Sessão terminada.");
}

async function handleBetSubmit(event) {
  event.preventDefault();
  clearMessage();

  const status = elements.status.value;
  const stake = Number(elements.stake.value);
  const odds = Number(elements.odds.value);
  const settlementReturn = requiresSettlement(status) ? Number(elements.settlementReturn.value) : null;

  if (requiresSettlement(status) && Number.isNaN(settlementReturn)) {
    setMessage("Preenche o retorno final para este tipo de liquidação.", "warning");
    return;
  }

  const profit = calculateProfit(stake, odds, status, settlementReturn);

  const payload = {
    tipster: elements.tipster.value.trim() || null,
    bookie: elements.bookie.value.trim() || null,
    sport: elements.sport.value.trim() || null,
    event_name: elements.eventName.value.trim(),
    market_name: elements.marketName.value.trim(),
    bet_type: deriveBetType(elements.marketName.value),
    bet_date: elements.betDate.value,
    stake,
    odds,
    status,
    settlement_return: settlementReturn,
    profit,
    notes: elements.notes.value.trim() || null
  };

  const query = editingBetId
    ? supabaseClient.from("bets").update(payload).eq("id", editingBetId)
    : supabaseClient.from("bets").insert(payload);

  const { error } = await query;

  if (error) {
    setMessage(error.message, "warning");
    return;
  }

  await Promise.all([
    syncSuggestion("tipsters", payload.tipster),
    syncSuggestion("bookies", payload.bookie),
    syncSuggestion("sports", payload.sport)
  ]);

  setMessage(editingBetId ? "Aposta atualizada com sucesso." : "Aposta guardada com sucesso.");
  resetBetForm();
  await fetchSuggestions();
  await fetchBets();
}

async function handleBetListClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const { action, id } = button.dataset;

  if (action === "edit") {
    startEditingBet(id);
    return;
  }

  if (action === "update-status") {
    const select = elements.betsList.querySelector(`select.status-select[data-id="${id}"]`);
    const bet = bets.find((entry) => String(entry.id) === String(id));
    if (!select || !bet) {
      return;
    }

    const nextStatus = select.value;
    let settlementReturn = bet.settlement_return;

    if (requiresSettlement(nextStatus)) {
      const response = window.prompt("Indica o retorno final em unidades para este estado.", settlementReturn ?? "");
      if (response === null) {
        return;
      }

      const parsed = Number(response);
      if (Number.isNaN(parsed)) {
        setMessage("Retorno final inválido.", "warning");
        return;
      }

      settlementReturn = parsed;
    } else {
      settlementReturn = null;
    }

    const payload = {
      status: nextStatus,
      settlement_return: settlementReturn,
      profit: calculateProfit(bet.stake, bet.odds, nextStatus, settlementReturn)
    };

    const { error } = await supabaseClient.from("bets").update(payload).eq("id", id);
    if (error) {
      setMessage(error.message, "warning");
      return;
    }

    setMessage("Estado da aposta atualizado com sucesso.");
    await fetchBets();
    return;
  }

  if (action === "delete") {
    const firstConfirm = window.confirm("Queres mesmo apagar esta aposta?");
    if (!firstConfirm) {
      return;
    }

    const secondConfirm = window.confirm("Confirma novamente: esta ação é irreversível.");
    if (!secondConfirm) {
      return;
    }

    const { error } = await supabaseClient.from("bets").delete().eq("id", id);
    if (error) {
      setMessage(error.message, "warning");
      return;
    }

    if (String(editingBetId) === String(id)) {
      resetBetForm();
    }

    setMessage("Aposta apagada com sucesso.");
    await fetchBets();
  }
}

async function handleImportCsv() {
  clearImportMessage();

  if (!currentUser) {
    setImportMessage("Inicia sessão antes de importar apostas.", "warning");
    return;
  }

  const file = elements.importFile.files[0];
  if (!file) {
    setImportMessage("Seleciona um ficheiro CSV primeiro.", "warning");
    return;
  }

  elements.importButton.disabled = true;
  elements.importButton.textContent = "A importar...";
  setImportMessage("A processar o ficheiro e a preparar a importação...");

  try {
    const text = await file.text();
    const rows = parseCsv(text);
    if (!rows.length) {
      setImportMessage("O ficheiro está vazio ou não foi possível ler linhas válidas.", "warning");
      return;
    }

    const payload = rows
      .map(mapImportedRow)
      .filter((row) => row.bet_date && row.market_name && row.event_name);

    if (!payload.length) {
      setImportMessage("Não encontrei linhas importáveis após o mapeamento.", "warning");
      return;
    }

    const chunks = chunkArray(payload, 200);

    for (let index = 0; index < chunks.length; index += 1) {
      setImportMessage(`A importar bloco ${index + 1} de ${chunks.length}...`);
      const { error } = await supabaseClient.from("bets").insert(chunks[index]);
      if (error) {
        setImportMessage(`Erro no bloco ${index + 1}: ${error.message}`, "warning");
        return;
      }
    }

    const uniqueTipsters = [...new Set(payload.map((row) => row.tipster).filter(Boolean))];
    const uniqueBookies = [...new Set(payload.map((row) => row.bookie).filter(Boolean))];
    const uniqueSports = [...new Set(payload.map((row) => row.sport).filter(Boolean))];

    await Promise.all([
      ...uniqueTipsters.map((value) => syncSuggestion("tipsters", value)),
      ...uniqueBookies.map((value) => syncSuggestion("bookies", value)),
      ...uniqueSports.map((value) => syncSuggestion("sports", value))
    ]);

    elements.importFile.value = "";
    setImportMessage(`Importação concluída: ${payload.length} apostas carregadas.`);
    await fetchSuggestions();
    await fetchBets();
    closeImportModal();
  } catch (error) {
    setImportMessage(error.message || "Ocorreu um erro durante a importação.", "warning");
  } finally {
    elements.importButton.disabled = false;
    elements.importButton.textContent = "Importar apostas";
  }
}

async function handleOcrImport() {
  clearOcrMessage();

  if (!currentUser) {
    setOcrMessage("Inicia sessão antes de analisar uma imagem.", "warning");
    return;
  }

  const file = elements.ocrFile.files[0];
  if (!file) {
    setOcrMessage("Seleciona uma imagem primeiro.", "warning");
    return;
  }

  if (!window.Tesseract) {
    setOcrMessage("OCR indisponível neste browser.", "warning");
    return;
  }

  elements.ocrButton.disabled = true;
  elements.applyOcrButton.disabled = true;
  elements.ocrButton.textContent = "A analisar...";
  setOcrMessage("A ler texto da imagem...");

  try {
    const worker = await window.Tesseract.createWorker("eng");
    await worker.setParameters({
      tessedit_pageseg_mode: 6
    });
    const result = await worker.recognize(file);
    await worker.terminate();
    elements.ocrDebugText.textContent = result.data.text || "";

    const extracted = extractBetFromOcrText(result.data.text || "");
    if (!extracted.marketName && !extracted.eventName) {
      setOcrMessage("Não consegui extrair informação suficiente desta imagem.", "warning");
      return;
    }

    pendingOcrPrefill = extracted;
    elements.applyOcrButton.disabled = false;
    setOcrMessage("Análise concluída. Revê o debug e clica em 'Usar pre-preenchimento'.");
  } catch (error) {
    setOcrMessage(error.message || "Ocorreu um erro ao analisar a imagem.", "warning");
  } finally {
    elements.ocrButton.disabled = false;
    elements.ocrButton.textContent = "Analisar imagem";
  }
}

async function init() {
  if (!supabaseClient) {
    return;
  }

  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    setMessage(error.message, "warning");
    return;
  }

  setAuthUi(data.session ? data.session.user : null);

  if (data.session && data.session.user) {
    await fetchSuggestions();
    await fetchBets();
  }

  if (authSubscription && authSubscription.subscription) {
    authSubscription.subscription.unsubscribe();
  }

  authSubscription = supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    setAuthUi(session ? session.user : null);
    await fetchSuggestions();
    await fetchBets();
  });
}

elements.authForm.addEventListener("submit", handleAuthSubmit);
elements.logoutButton.addEventListener("click", handleLogout);
elements.openEntryButton.addEventListener("click", openEntryModal);
elements.closeEntryButton.addEventListener("click", closeEntryModal);
elements.openOcrButton.addEventListener("click", openOcrModal);
elements.closeOcrButton.addEventListener("click", closeOcrModal);
elements.applyOcrButton.addEventListener("click", handleApplyOcrPrefill);
elements.ocrButton.addEventListener("click", handleOcrImport);
elements.openImportButton.addEventListener("click", openImportModal);
elements.closeImportButton.addEventListener("click", closeImportModal);
elements.importButton.addEventListener("click", handleImportCsv);
elements.betForm.addEventListener("submit", handleBetSubmit);
elements.cancelEditButton.addEventListener("click", resetBetForm);
elements.betsList.addEventListener("click", handleBetListClick);
elements.marketName.addEventListener("input", () => {
  elements.betType.value = deriveBetType(elements.marketName.value);
});
elements.status.addEventListener("change", updateSettlementVisibility);
elements.filterStatus.addEventListener("change", () => {
  currentPage = 1;
  renderBets();
});
elements.filterQuery.addEventListener("input", () => {
  currentPage = 1;
  renderBets();
});
elements.filterMonth.addEventListener("change", () => {
  currentPage = 1;
  renderBets();
});
elements.filterTipster.addEventListener("input", () => {
  currentPage = 1;
  renderBets();
});
elements.filterBookie.addEventListener("input", () => {
  currentPage = 1;
  renderBets();
});
elements.filterSport.addEventListener("input", () => {
  currentPage = 1;
  renderBets();
});
elements.filterBetType.addEventListener("change", () => {
  currentPage = 1;
  renderBets();
});
elements.sortBy.addEventListener("change", () => {
  currentPage = 1;
  renderBets();
});
elements.prevPageButton.addEventListener("click", () => {
  currentPage = Math.max(1, currentPage - 1);
  renderBets();
});
elements.nextPageButton.addEventListener("click", () => {
  currentPage += 1;
  renderBets();
});
elements.entryModal.addEventListener("click", (event) => {
  if (event.target === elements.entryModal) {
    closeEntryModal();
  }
});
elements.importModal.addEventListener("click", (event) => {
  if (event.target === elements.importModal) {
    closeImportModal();
  }
});
elements.ocrModal.addEventListener("click", (event) => {
  if (event.target === elements.ocrModal) {
    closeOcrModal();
  }
});

init();
