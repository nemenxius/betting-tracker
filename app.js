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
  eventName: document.querySelector("#event-name"),
  marketName: document.querySelector("#market-name"),
  bookmaker: document.querySelector("#bookmaker"),
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
  statTotal: document.querySelector("#stat-total"),
  statProfit: document.querySelector("#stat-profit"),
  statRoi: document.querySelector("#stat-roi")
};

const defaultDate = new Date().toISOString().split("T")[0];
elements.betDate.value = defaultDate;

let supabaseClient = null;
let currentUser = null;
let bets = [];
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

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR"
  }).format(Number(value || 0));
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

function updateStats() {
  const resolvedBets = bets.filter((bet) => bet.status !== "pending");
  const totalProfit = bets.reduce((sum, bet) => sum + Number(bet.profit || 0), 0);
  const totalStake = resolvedBets.reduce((sum, bet) => sum + Number(bet.stake || 0), 0);
  const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;

  elements.statTotal.textContent = String(bets.length);
  elements.statProfit.textContent = formatCurrency(totalProfit);
  elements.statRoi.textContent = `${roi.toFixed(1)}%`;
}

function renderBets() {
  const query = elements.filterQuery.value.trim().toLowerCase();
  const filterStatus = elements.filterStatus.value;

  const visibleBets = bets.filter((bet) => {
    const matchesStatus = filterStatus === "all" || bet.status === filterStatus;
    const haystack = [bet.event_name, bet.market_name, bet.bookmaker, bet.notes]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesQuery = !query || haystack.includes(query);

    return matchesStatus && matchesQuery;
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
            <span>${escapeHtml(bet.bookmaker || "Sem casa")}</span>
            <span>Stake: ${formatCurrency(bet.stake)}</span>
            <span>Odds: ${Number(bet.odds).toFixed(2)}</span>
            <span class="${profitClass}">Lucro: ${formatCurrency(bet.profit)}</span>
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
  renderBets();
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
    event_name: elements.eventName.value.trim(),
    market_name: elements.marketName.value.trim(),
    bookmaker: elements.bookmaker.value.trim() || null,
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

  elements.betForm.reset();
  elements.betDate.value = defaultDate;
  elements.status.value = "pending";
  setMessage("Aposta guardada com sucesso.");
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
    await fetchBets();
  }

  if (authSubscription && authSubscription.subscription) {
    authSubscription.subscription.unsubscribe();
  }

  authSubscription = supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    setAuthUi(session ? session.user : null);
    await fetchBets();
  });
}

elements.authForm.addEventListener("submit", handleAuthSubmit);
elements.logoutButton.addEventListener("click", handleLogout);
elements.betForm.addEventListener("submit", handleBetSubmit);
elements.filterStatus.addEventListener("change", renderBets);
elements.filterQuery.addEventListener("input", renderBets);

init();
