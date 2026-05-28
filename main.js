'use strict';

const ClimateData = window.ClimateData;
const ClimateAnalytics = window.ClimateAnalytics;
const ClimateSolar = window.ClimateSolar;
const ClimateCharts = window.ClimateCharts;

if (!ClimateData || !ClimateAnalytics || !ClimateSolar || !ClimateCharts) {
    throw new Error("Módulos auxiliares não foram carregados na ordem correta.");
}

// =====================================================================
// Registro de instâncias de gráficos — evita memory leaks ao recriar
// =====================================================================
const chartInstances = {};
let pendingLoads = 0;
let zoomOverlay = null;
let firebaseDatabase = null;
let firebaseRef = null;
let firebaseOnValue = null;
const latestData = {
    temperatura: null,
    solar: null,
    aquario: null,
    sala: null,
};

const FIREBASE_SDK_VERSION = "12.13.0";
const FIREBASE_APP_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`;
const FIREBASE_DATABASE_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-database.js`;

// =====================================================================
// Utilitários de data
// =====================================================================
function dataAtual() {
    return ClimateData.dataAtual();
}

function dataOntem() {
    return ClimateData.dataOntem();
}

// =====================================================================
// Constantes globais
// =====================================================================
const currentDate   = dataAtual();
const yesterdayDate = dataOntem();
let selectedDate = dataAtual();

// Paleta de cores do tema dark
const COLORS = {
    blue:   '#38bdf8',
    green:  '#34d399',
    purple: '#a78bfa',
    amber:  '#fbbf24',
    teal:   '#2dd4bf',
    rose:   '#fb7185',
    grid:   'rgba(99,132,200,0.1)',
    text:   '#94a3b8',
};

const COMFORT_BAND = { min: 20, max: 26, label: "Faixa de conforto" };
const CHART_DEFAULTS = ClimateCharts.createDefaults(COLORS);

// =====================================================================
// Configuração do Firebase
// =====================================================================
const firebaseConfig = {
    apiKey:            "AIzaSyD5gYEvLzvZItMrXGRlNbhfOPgNMj756_I",
    authDomain:        "estacaometereologicaesp32.firebaseapp.com",
    databaseURL:       "https://estacaometereologicaesp32-default-rtdb.firebaseio.com",
    projectId:         "estacaometereologicaesp32",
    storageBucket:     "estacaometereologicaesp32.appspot.com",
    messagingSenderId: "589754957740",
    appId:             "1:589754957740:web:6299b8ce6763127b600409",
    measurementId:     "G-8GE5G3X1Y9"
};

async function initializeFirebase() {
    if (firebaseDatabase) return;

    const [
        { initializeApp },
        { getDatabase, onValue, ref }
    ] = await Promise.all([
        import(FIREBASE_APP_URL),
        import(FIREBASE_DATABASE_URL)
    ]);

    const app = initializeApp(firebaseConfig);
    firebaseDatabase = getDatabase(app);
    firebaseRef = ref;
    firebaseOnValue = onValue;
}

function setLoading(isLoading) {
    const el = document.getElementById("loadingBar");
    if (!el) return;
    el.classList.toggle("is-active", isLoading);
}

function trackLoadStart() {
    pendingLoads++;
    setLoading(true);
}

function trackLoadEnd() {
    pendingLoads = Math.max(0, pendingLoads - 1);
    setLoading(pendingLoads > 0);
}

function handleFirebaseError(path, error) {
    console.error(`Erro ao carregar ${path}:`, error);
}

function listenToPath(path, onData, onError) {
    let firstLoad = true;
    trackLoadStart();

    return firebaseOnValue(firebaseRef(firebaseDatabase, path), snapshot => {
        if (firstLoad) {
            trackLoadEnd();
            firstLoad = false;
        }
        onData(snapshot.val());
    }, error => {
        if (firstLoad) {
            trackLoadEnd();
            firstLoad = false;
        }
        handleFirebaseError(path, error);
        if (onError) onError(error);
    });
}

// =====================================================================
// Canvas contexts
// =====================================================================
const plotsTemp          = document.getElementById("plotsTemp").getContext("2d");
const plotsST            = document.getElementById("plotsST").getContext("2d");
const plotsUmidade       = document.getElementById("plotsUmidade").getContext("2d");
const plotSunriseSunset  = document.getElementById("plotSunriseSunset").getContext("2d");
const plotSolarToday     = document.getElementById("plotSolarToday").getContext("2d");

const plotsTempAquario   = document.getElementById("plotsTempAquario").getContext("2d");
const plotsPH            = document.getElementById("plotsPH").getContext("2d");
const plotsTDS           = document.getElementById("plotsTDS").getContext("2d");
const plotsTurbidez      = document.getElementById("plotsTurbidez").getContext("2d");

const plotsTempSala      = document.getElementById("plotsTempSala").getContext("2d");
const plotsSTSala        = document.getElementById("plotsSTSala").getContext("2d");
const plotsUmidadeSala   = document.getElementById("plotsUmidadeSala").getContext("2d");
const plotsPressaoSala   = document.getElementById("plotsPressaoSala").getContext("2d");

// =====================================================================
// Listeners Firebase
// =====================================================================
async function setupFirebaseListeners() {
    trackLoadStart();
    try {
        await initializeFirebase();
    } finally {
        trackLoadEnd();
    }

    listenToPath("historico/Temperatura", data => {
        latestData.temperatura = data;
        if (!data) {
            renderEmptyState("data", "Sem dados de temperatura.");
            return;
        }
        renderTemperaturaData(data);
    }, () => renderEmptyState("data", "Falha ao carregar dados de temperatura.", "error"));

    listenToPath("historico/NascePorDoSol", data => {
        latestData.solar = data;
        if (!data) {
            renderChartMessage("chart-container-sun", "Sem dados solares.");
            renderChartMessage("chart-container-sun-today", "Sem dados solares de hoje.");
            return;
        }
        renderSolarData(data);
    }, () => {
        renderChartMessage("chart-container-sun", "Falha ao carregar dados solares.", "error");
        renderChartMessage("chart-container-sun-today", "Falha ao carregar ciclo solar.", "error");
    });

    listenToPath("historico/Aquario", data => {
        latestData.aquario = data;
        if (!data) {
            renderEmptyState("dataAquario", "Sem dados do aquário.");
            return;
        }
        renderAquarioData(data);
    }, () => renderEmptyState("dataAquario", "Falha ao carregar dados do aquário.", "error"));

    listenToPath("historico/AirQuality", data => {
        latestData.sala = data;
        if (!data) {
            renderEmptyState("dataSala", "Sem dados da sala.");
            return;
        }
        renderSalaData(data);
    }, () => renderEmptyState("dataSala", "Falha ao carregar dados da sala.", "error"));
}

function renderTemperaturaData(data) {
    const filtered = ClimateData.filterDataByDays(data, 2, selectedDate);
    ClimateAnalytics.renderStats("quarto", filtered, selectedDate);
    ClimateAnalytics.renderAdvancedClimateViews(data, selectedDate);
    createTemperatureChart(filtered);
    createSTChart(filtered);
    createUmidadeChart(filtered);
    renderTable("data", createTable(filtered), `Sem registros de temperatura em ${selectedDate.replace(/-/g, "/")}.`);
}

function renderSolarData(data) {
    clearChartMessage("chart-container-sun");
    clearChartMessage("chart-container-sun-today");
    createSunriseSunsetChart(ClimateData.filterDataByDays(data, 365, selectedDate, false));
    createSolarTodayChart(data);
}

function renderAquarioData(data) {
    const filtered = ClimateData.filterDataByDays(data, 2, selectedDate);
    ClimateAnalytics.renderStats("aquario", filtered, selectedDate);
    createTemperatureChartAquario(filtered);
    createPHChartAquario(filtered);
    createTDSChartAquario(filtered);
    createTurbidezChartAquario(filtered);
    renderTable("dataAquario", createTableAquario(filtered), `Sem registros do aquário em ${selectedDate.replace(/-/g, "/")}.`);
}

function renderSalaData(data) {
    const filtered = ClimateData.filterDataByDays(data, 2, selectedDate);
    ClimateAnalytics.renderStats("sala", filtered, selectedDate);
    createTemperatureChartSala(filtered);
    createSTChartSala(filtered);
    createUmidadeChartSala(filtered);
    createPressaoChartSala(filtered);
    renderTable("dataSala", createTableSala(filtered), `Sem registros da sala em ${selectedDate.replace(/-/g, "/")}.`);
}

function rerenderDashboardFromSelectedDate() {
    if (latestData.temperatura) renderTemperaturaData(latestData.temperatura);
    if (latestData.solar) renderSolarData(latestData.solar);
    if (latestData.aquario) renderAquarioData(latestData.aquario);
    if (latestData.sala) renderSalaData(latestData.sala);
}

function renderTable(id, table, emptyMessage = "Sem registros recentes.") {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = "";
    if (table.rows && table.rows.length <= 1) {
        renderEmptyState(id, emptyMessage);
        return;
    }
    el.appendChild(table);
}

function renderEmptyState(id, message, type = "empty") {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = "";
    const empty = document.createElement("p");
    empty.className = `state-message state-message--${type}`;
    empty.innerText = message;
    el.appendChild(empty);
}

function renderChartMessage(id, message, type = "empty") {
    const el = document.getElementById(id);
    if (!el) return;
    clearChartMessage(id);
    const status = document.createElement("p");
    status.className = `chart-message state-message state-message--${type}`;
    status.innerText = message;
    el.appendChild(status);
}

function clearChartMessage(id) {
    const el = document.getElementById(id);
    const status = el ? el.querySelector(".chart-message") : null;
    if (status) status.remove();
}

function renderStartupError() {
    renderEmptyState("data", "Falha ao carregar o Firebase. Verifique a conexão com a internet.");
    renderEmptyState("dataSala", "Falha ao carregar o Firebase. Verifique a conexão com a internet.");
    renderEmptyState("dataAquario", "Falha ao carregar o Firebase. Verifique a conexão com a internet.");
    renderChartMessage("chart-container-sun", "Falha ao carregar o Firebase.", "error");
    renderChartMessage("chart-container-sun-today", "Falha ao carregar o Firebase.", "error");
}

// =====================================================================
// Zoom via overlay modal
// =====================================================================
function handleZoom(card) {
    closeZoom();

    const sourceCanvas = card.querySelector("canvas");
    if (!sourceCanvas) return;

    const sourceChart = chartInstances[sourceCanvas.id];
    if (!sourceChart) return;

    const overlay = document.createElement("div");
    overlay.className = "plot-zoom-overlay";

    const clone = card.cloneNode(false);
    const label = card.querySelector(".chart-label");
    const zoomCanvas = document.createElement("canvas");
    zoomCanvas.className = "plot plot--zoom";
    zoomCanvas.setAttribute("aria-label", sourceCanvas.getAttribute("aria-label") || "Gráfico ampliado");
    zoomCanvas.setAttribute("role", "img");

    if (label) clone.appendChild(label.cloneNode(true));
    clone.appendChild(zoomCanvas);
    overlay.appendChild(clone);

    overlay.addEventListener("click", e => {
        if (e.target.closest(".chart-card")) closeZoom();
    });

    zoomOverlay = overlay;
    document.body.appendChild(overlay);
    createZoomChart(sourceChart, zoomCanvas.getContext("2d"));
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function createZoomButton(card) {
    if (card.querySelector(".chart-zoom-button")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "chart-zoom-button";
    button.setAttribute("aria-label", "Ampliar gráfico");
    button.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M15 3h6v6"/>
            <path d="M21 3l-7 7"/>
            <path d="M9 21H3v-6"/>
            <path d="M3 21l7-7"/>
        </svg>
    `;
    button.addEventListener("click", event => {
        event.stopPropagation();
        handleZoom(card);
    });

    card.appendChild(button);
}

function closeZoom() {
    if (!zoomOverlay) return;
    const zoomChart = zoomOverlay._chart;
    if (zoomChart) zoomChart.destroy();
    zoomOverlay.remove();
    zoomOverlay = null;
}

function cloneChartData(sourceChart) {
    return {
        labels: sourceChart.data.labels ? [...sourceChart.data.labels] : undefined,
        datasets: sourceChart.data.datasets.map(dataset => ({
            type: dataset.type,
            label: dataset.label,
            data: Array.isArray(dataset.data)
                ? dataset.data.map(item => item && typeof item === "object" ? { ...item } : item)
                : dataset.data,
            yAxisID: dataset.yAxisID,
            borderColor: dataset.borderColor,
            backgroundColor: Array.isArray(dataset.backgroundColor) || typeof dataset.backgroundColor === "string"
                ? dataset.backgroundColor
                : "transparent",
            fill: dataset.fill,
            tension: dataset.tension,
            borderWidth: dataset.borderWidth,
            pointRadius: dataset.pointRadius,
            pointHitRadius: dataset.pointHitRadius || 18,
            pointHoverRadius: dataset.pointHoverRadius || 6,
            pointBackgroundColor: dataset.pointBackgroundColor,
            pointBorderColor: dataset.pointBorderColor,
            pointHoverBackgroundColor: dataset.pointHoverBackgroundColor,
            pointHoverBorderColor: dataset.pointHoverBorderColor,
            pointHoverBorderWidth: dataset.pointHoverBorderWidth,
            showLine: dataset.showLine,
            order: dataset.order,
            parsing: dataset.parsing,
        }))
    };
}

function createZoomChart(sourceChart, targetCtx) {
    const sourceId = sourceChart.canvas.id;
    const config = {
        type: sourceChart.config.type || "line",
        data: cloneChartData(sourceChart),
        options: getZoomOptions(sourceId),
        plugins: sourceId === "plotSolarToday" ? [ClimateSolar.solarDayBackgroundPlugin] : []
    };

    const zoomChart = new Chart(targetCtx, config);
    if (sourceId === "plotSolarToday") {
        zoomChart.$solarDayTimes = sourceChart.$solarDayTimes;
    }
    if (sourceChart.$comfortBand) {
        zoomChart.$comfortBand = sourceChart.$comfortBand;
        zoomChart.update();
    }
    zoomOverlay._chart = zoomChart;
    return zoomChart;
}

function getZoomOptions(sourceId) {
    if (sourceId === "plotSunriseSunset") {
        return ClimateSolar.getSunHistoryOptions({
            legend: true,
            tickSize: 12,
            labelSize: 12,
            defaults: CHART_DEFAULTS,
            colors: COLORS
        });
    }

    if (sourceId === "plotSolarToday") {
        return ClimateSolar.getSolarTodayOptions({
            tickSize: 12,
            labelSize: 12,
            defaults: CHART_DEFAULTS,
            colors: COLORS
        });
    }

    return ClimateCharts.mergeDeep(CHART_DEFAULTS, {
        animation: false,
        plugins: {
            tooltip: {
                callbacks: {
                    label: context => {
                        const value = context.parsed.y;
                        const formatted = Number.isFinite(value) ? value.toFixed(2) : "--";
                        return `${context.dataset.label || ""}: ${formatted}`;
                    }
                }
            }
        },
        scales: {
            x: {
                ticks: { font: { size: 12 } }
            },
            y: {
                ticks: { font: { size: 12 } }
            }
        }
    });
}

document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeZoom();
});

// =====================================================================
// Navegação por abas
// =====================================================================
function getStoredTab() {
    try {
        return localStorage.getItem("activeTab");
    } catch {
        return null;
    }
}

function storeActiveTab(tabName) {
    try {
        localStorage.setItem("activeTab", tabName);
    } catch {
        // localStorage can be blocked in private or embedded contexts.
    }
}

function openTab(tabName, trigger) {
    document.querySelectorAll(".tabcontent").forEach(el => {
        el.style.display = "none";
        el.setAttribute("hidden", "");
    });
    document.querySelectorAll(".tablink").forEach(el => {
        el.classList.remove("active");
        el.setAttribute("aria-selected", "false");
    });

    const tab = document.getElementById(tabName);
    if (tab) {
        tab.style.display = "block";
        tab.removeAttribute("hidden");
    }

    const selectedButton = trigger || document.querySelector(`.tablink[data-tab-target="${tabName}"]`);
    if (selectedButton) {
        selectedButton.classList.add("active");
        selectedButton.setAttribute("aria-selected", "true");
    }

    storeActiveTab(tabName);
}

document.addEventListener("DOMContentLoaded", () => {
    const tabButtons = document.querySelectorAll(".tablink[data-tab-target]");
    tabButtons.forEach(button => {
        button.addEventListener("click", () => openTab(button.dataset.tabTarget, button));
    });

    const storedTab = getStoredTab();
    const initialTab = storedTab && document.getElementById(storedTab) ? storedTab : "Tab1";
    openTab(initialTab);
    setupDateControls();
    setupCollapsibleSections();

    setupFirebaseListeners().catch(error => {
        handleFirebaseError("Firebase", error);
        setLoading(false);
        renderStartupError();
    });

    // Duplo clique amplia sem atrapalhar o hover dos tooltips do Chart.js.
    document.querySelectorAll(".chart-card").forEach(card => {
        card.classList.add("chart-card--zoomable");
        card.title = "Dê duplo clique ou use o botão para ampliar";
        createZoomButton(card);
        card.addEventListener("dblclick", () => handleZoom(card));
    });
});

// =====================================================================
// Criação de gráficos — reutilizável
// =====================================================================
function createChart(canvasCtx, data, key, label, color, yAxisTitle, yAxisSuffix = "", todasDatas) {
    const id = canvasCtx.canvas.id;
    chartInstances[id] = ClimateCharts.createLineChart({
        canvasCtx,
        data,
        key,
        label,
        color,
        yAxisTitle,
        yAxisSuffix,
        todasDatas,
        existingChart: chartInstances[id],
        defaults: CHART_DEFAULTS,
        colors: COLORS,
        comfortBand: COMFORT_BAND
    });
    return chartInstances[id];
}

ClimateCharts.registerComfortBand();

function setupDateControls() {
    const dateInput = document.getElementById("selectedDate");
    const todayButton = document.getElementById("btnToday");

    if (dateInput) {
        dateInput.value = ClimateData.convertFirebaseDateToInput(selectedDate);
        dateInput.addEventListener("change", () => {
            selectedDate = ClimateData.convertInputDateToFirebase(dateInput.value);
            rerenderDashboardFromSelectedDate();
        });
    }

    if (todayButton) {
        todayButton.addEventListener("click", () => {
            selectedDate = dataAtual();
            if (dateInput) dateInput.value = ClimateData.convertFirebaseDateToInput(selectedDate);
            rerenderDashboardFromSelectedDate();
        });
    }
}

function setupCollapsibleSections() {
    document.querySelectorAll(".collapsible-section").forEach(section => {
        const trigger = section.querySelector(".collapsible-trigger");
        if (!trigger) return;

        trigger.addEventListener("click", () => {
            const isCollapsed = section.classList.toggle("is-collapsed");
            trigger.setAttribute("aria-expanded", String(!isCollapsed));
        });
    });
}

// =====================================================================
// Nascer / Pôr do sol
// =====================================================================
function createSunriseSunsetChart(data, chartElement) {
    const ctx = chartElement || plotSunriseSunset;
    const id  = ctx.canvas.id;
    const chart = ClimateSolar.createSunriseSunsetChart({
        data,
        ctx,
        existingChart: chartInstances[id],
        defaults: CHART_DEFAULTS,
        colors: COLORS,
        onEmpty: () => renderChartMessage("chart-container-sun", "Sem histórico solar recente.")
    });
    if (chart) chartInstances[id] = chart;
}

function createSolarTodayChart(data, chartElement) {
    const ctx = chartElement || plotSolarToday;
    const id = ctx.canvas.id;
    const chart = ClimateSolar.createSolarTodayChart({
        data,
        selectedDate,
        ctx,
        existingChart: chartInstances[id],
        defaults: CHART_DEFAULTS,
        colors: COLORS,
        onEmpty: () => renderChartMessage("chart-container-sun-today", `Sem dados suficientes para o ciclo solar em ${selectedDate.replace(/-/g, "/")}.`)
    });
    if (chart) chartInstances[id] = chart;
}

// =====================================================================
// Quarto
// =====================================================================
function createTable(data)          { return ClimateData.createTables(["Data","Hora","Temperatura","Sensacao termica","Umidade"], data); }
function createTemperatureChart(d)  { return createChart(plotsTemp,    d, "Temperatura",      "Temperatura",      COLORS.blue,   "(°C)", "°",  false); }
function createSTChart(d)           { return createChart(plotsST,      d, "Sensacao termica", "Sensação Térmica", COLORS.green,  "(°C)", "°",  false); }
function createUmidadeChart(d)      { return createChart(plotsUmidade, d, "Umidade",          "Umidade",          COLORS.purple, null,   "%",  false); }

// =====================================================================
// Aquário
// =====================================================================
function createTableAquario(d)             { return ClimateData.createTables(["Data","Hora","temperaturaDS18B20","PH","TDS","Turbidez"], d); }
function createTemperatureChartAquario(d)  { return createChart(plotsTempAquario, d, "temperaturaDS18B20", "Temperatura", COLORS.blue,  "(°C)", "°", false); }
function createPHChartAquario(d)           { return createChart(plotsPH,          d, "PH",                "PH",          COLORS.teal,  null,   "",  false); }
function createTDSChartAquario(d)          { return createChart(plotsTDS,         d, "TDS",               "TDS",         COLORS.amber, null,   "",  false); }
function createTurbidezChartAquario(d)     { return createChart(plotsTurbidez,    d, "Turbidez",          "Turbidez",    COLORS.rose,  null,   "",  false); }

// =====================================================================
// Sala
// =====================================================================
function createTableSala(d)             { return ClimateData.createTables(["Data","Hora","CO","CO2","Aceton","Alcohol","NH4"], d); }
function createTemperatureChartSala(d)  { return createChart(plotsTempSala,    d, "temperatura",    "Temperatura",      COLORS.blue,   "(°C)", "°", false); }
function createSTChartSala(d)           { return createChart(plotsSTSala,      d, "sensacaoTermica","Sensação Térmica", COLORS.green,  "(°C)", "°", false); }
function createUmidadeChartSala(d)      { return createChart(plotsUmidadeSala, d, "umidade",        "Umidade",          COLORS.purple, null,   "%", false); }
function createPressaoChartSala(d)      { return createChart(plotsPressaoSala, d, "pressao",        "Pressão (hPa)",    COLORS.amber,  null,   "",  false); }
