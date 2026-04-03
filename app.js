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
  profit: document.querySelector("#profit"),
  notes: document.querySelector("#notes"),
  betsList: document.querySelector("#bets-list"),
  messageBox: document.querySelector("#message-box"),
  configWarning: document.querySelector("#config-warning"),
  filterStatus: document.querySelector("#filter-status"),
  filterQuery: document.querySelector("#filter-query"),
  filterTipster: document.querySelector("#filter-tipster"),
  filterBookie: document.querySelector("#filter-bookie"),
  filterSport: document.querySelector("#filter-sport"),
  filterBetType: document.querySelector("#filter-bet-type"),
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

function calculateProfit(stake, odds, status, profitInput) {
  if (profitInput !== "") {
    return Number(profitInput);
  }

  const numericStake = Number(stake);
  const numericOdds = Number(odds);

  if (status === "won") {
    return Number((numericStake * numericOdds - numericStake).toFixed(2));
  }

  if (status === "lost") {
    return Number((-numericStake).toFixed(2));
  }

  return 0;
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

function renderBets() {
  const query = elements.filterQuery.value.trim().toLowerCase();
  const filterStatus = elements.filterStatus.value;
  const filterTipster = elements.filterTipster.value.trim().toLowerCase();
  const filterBookie = elements.filterBookie.value.trim().toLowerCase();
  const filterSport = elements.filterSport.value.trim().toLowerCase();
  const filterBetType = elements.filterBetType.value;

  const visibleBets = bets.filter((bet) => {
    const matchesStatus = filterStatus === "all" || bet.status === filterStatus;
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

    return matchesStatus && matchesQuery && matchesTipster && matchesBookie && matchesSport && matchesBetType;
  });

  updateStats();

  if (!currentUser) {
    elements.betsList.className = "bets-list empty-state";
    elements.betsList.textContent = "Inicia sessão para veres e criares registos.";
    return;
  }

  if (!visibleBets.length) {
    elements.betsList.className = "bets-list empty-state";
    elements.betsList.textContent = "Ainda não existem apostas para este filtro.";
    return;
  }

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
            <span class="${profitClass}">Lucro: ${formatUnits(bet.profit)}</span>
          </div>
          ${notes}
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
  const profit = calculateProfit(stake, odds, status, elements.profit.value);

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
    profit,
    notes: elements.notes.value.trim() || null
  };

  const { error } = await supabaseClient.from("bets").insert(payload);

  if (error) {
    setMessage(error.message, "warning");
    return;
  }

  await Promise.all([
    syncSuggestion("tipsters", payload.tipster),
    syncSuggestion("bookies", payload.bookie),
    syncSuggestion("sports", payload.sport)
  ]);

  elements.betForm.reset();
  elements.betDate.value = defaultDate;
  elements.status.value = "pending";
  elements.betType.value = "";
  setMessage("Aposta guardada com sucesso.");
  await fetchSuggestions();
  await fetchBets();
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
elements.marketName.addEventListener("input", () => {
  elements.betType.value = deriveBetType(elements.marketName.value);
});
elements.filterStatus.addEventListener("change", renderBets);
elements.filterQuery.addEventListener("input", renderBets);
elements.filterTipster.addEventListener("input", renderBets);
elements.filterBookie.addEventListener("input", renderBets);
elements.filterSport.addEventListener("input", renderBets);
elements.filterBetType.addEventListener("change", renderBets);

init();
