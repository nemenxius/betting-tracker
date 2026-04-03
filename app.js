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
  authMessageBox: document.querySelector("#auth-message-box"),
  userPanel: document.querySelector("#user-panel"),
  userEmail: document.querySelector("#user-email"),
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
  statRoi: document.querySelector("#stat-roi")
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

function setAuthMessage(message, tone = "info") {
  setNotice(elements.authMessageBox, message, tone);
}

function clearAuthMessage() {
  clearNotice(elements.authMessageBox);
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

function updateStats() {
  const resolvedBets = bets.filter((bet) => bet.status !== "pending");
  const totalProfit = bets.reduce((sum, bet) => sum + Number(bet.profit || 0), 0);
  const totalStake = resolvedBets.reduce((sum, bet) => sum + Number(bet.stake || 0), 0);
  const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;

  elements.statTotal.textContent = String(bets.length);
  elements.statProfit.textContent = formatUnits(totalProfit);
  elements.statRoi.textContent = `${roi.toFixed(1)}%`;
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

  updateStats();

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

  if (action === "delete") {
    const confirmed = window.confirm("Queres mesmo apagar esta aposta?");
    if (!confirmed) {
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

init();
