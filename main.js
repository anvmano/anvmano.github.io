'use strict';

// =====================================================================
// Registro de instâncias de gráficos — evita memory leaks ao recriar
// =====================================================================
const chartInstances = {};
let pendingLoads = 0;
let zoomOverlay = null;
let firebaseDatabase = null;
let firebaseRef = null;
let firebaseOnValue = null;

const FIREBASE_SDK_VERSION = "12.13.0";
const FIREBASE_APP_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`;
const FIREBASE_DATABASE_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-database.js`;

// =====================================================================
// Utilitários de data
// =====================================================================
function dataAtual() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
}

function dataOntem() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
}

// =====================================================================
// Constantes globais
// =====================================================================
const currentDate   = dataAtual();
const yesterdayDate = dataOntem();

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
        if (!data) {
            renderEmptyState("data", "Sem dados de temperatura.");
            return;
        }
        const filtered = filterDataByDays(data, 2);
        createTemperatureChart(filtered);
        createSTChart(filtered);
        createUmidadeChart(filtered);
        renderTable("data", createTable(filtered), "Sem registros recentes de temperatura.");
    }, () => renderEmptyState("data", "Falha ao carregar dados de temperatura.", "error"));

    listenToPath("historico/NascePorDoSol", data => {
        if (!data) {
            renderChartMessage("chart-container-sun", "Sem dados solares.");
            renderChartMessage("chart-container-sun-today", "Sem dados solares de hoje.");
            return;
        }
        clearChartMessage("chart-container-sun");
        clearChartMessage("chart-container-sun-today");
        createSunriseSunsetChart(filterDataByDays(data, 365));
        createSolarTodayChart(data);
    }, () => {
        renderChartMessage("chart-container-sun", "Falha ao carregar dados solares.", "error");
        renderChartMessage("chart-container-sun-today", "Falha ao carregar ciclo solar.", "error");
    });

    listenToPath("historico/Aquario", data => {
        if (!data) {
            renderEmptyState("dataAquario", "Sem dados do aquário.");
            return;
        }
        const filtered = filterDataByDays(data, 2);
        createTemperatureChartAquario(filtered);
        createPHChartAquario(filtered);
        createTDSChartAquario(filtered);
        createTurbidezChartAquario(filtered);
        renderTable("dataAquario", createTableAquario(filtered), "Sem registros recentes do aquário.");
    }, () => renderEmptyState("dataAquario", "Falha ao carregar dados do aquário.", "error"));

    listenToPath("historico/AirQuality", data => {
        if (!data) {
            renderEmptyState("dataSala", "Sem dados da sala.");
            return;
        }
        const filtered = filterDataByDays(data, 2);
        createTemperatureChartSala(filtered);
        createSTChartSala(filtered);
        createUmidadeChartSala(filtered);
        createPressaoChartSala(filtered);
        renderTable("dataSala", createTableSala(filtered), "Sem registros recentes da sala.");
    }, () => renderEmptyState("dataSala", "Falha ao carregar dados da sala.", "error"));
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
        plugins: sourceId === "plotSolarToday" ? [solarDayBackgroundPlugin] : []
    };

    const zoomChart = new Chart(targetCtx, config);
    if (sourceId === "plotSolarToday") {
        zoomChart.$solarDayTimes = sourceChart.$solarDayTimes;
    }
    zoomOverlay._chart = zoomChart;
    return zoomChart;
}

function getZoomOptions(sourceId) {
    if (sourceId === "plotSunriseSunset") {
        return getSunHistoryOptions({
            legend: true,
            tickSize: 12,
            labelSize: 12
        });
    }

    if (sourceId === "plotSolarToday") {
        return getSolarTodayOptions({
            tickSize: 12,
            labelSize: 12
        });
    }

    return mergeDeep(CHART_DEFAULTS, {
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
// Opções padrão do Chart.js — tema dark
// =====================================================================
const CHART_DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600, easing: 'easeInOutQuart' },
    interaction: {
        mode: 'index',
        intersect: false,
        axis: 'x'
    },
    hover: {
        mode: 'index',
        intersect: false
    },
    plugins: {
        legend: { display: false },
        tooltip: {
            mode: 'index',
            intersect: false,
            displayColors: false,
            backgroundColor: '#1a2234',
            borderColor: 'rgba(99,132,200,0.3)',
            borderWidth: 1,
            titleColor: '#94a3b8',
            bodyColor: '#f1f5f9',
            padding: 10,
            cornerRadius: 8,
        }
    },
    scales: {
        x: {
            grid:   { color: COLORS.grid, drawBorder: false },
            ticks:  { color: COLORS.text, font: { size: 11 } },
        },
        y: {
            grid:   { color: COLORS.grid, drawBorder: false },
            ticks:  { color: COLORS.text, font: { size: 11 } },
        }
    }
};

function mergeDeep(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = mergeDeep(target[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }
    return result;
}

// =====================================================================
// Criação de gráficos — reutilizável
// =====================================================================
function createChart(canvasCtx, data, key, label, color, yAxisTitle, yAxisSuffix = "", todasDatas) {
    const id = canvasCtx.canvas.id;
    if (chartInstances[id]) chartInstances[id].destroy();

    const { hours, [key]: chartData } = extractData(data, [key], todasDatas);

    const gradient = canvasCtx.createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, color + '33');
    gradient.addColorStop(1, color + '00');

    const options = mergeDeep(CHART_DEFAULTS, {
        plugins: {
            tooltip: {
                callbacks: {
                    label: context => {
                        const value = context.parsed.y;
                        const formatted = Number.isFinite(value) ? value.toFixed(2) : "--";
                        return `${context.dataset.label || label}: ${formatted}${yAxisSuffix || ""}`;
                    }
                }
            }
        },
        scales: {
            y: {
                title: {
                    display: !!yAxisTitle,
                    text: yAxisTitle,
                    color: COLORS.text,
                    font: { size: 11 }
                },
                ticks: {
                    precision: 1,
                    callback: v => v + (yAxisSuffix || "")
                }
            }
        }
    });

    chartInstances[id] = new Chart(canvasCtx, {
        type: "line",
        data: {
            labels: formatHoursArray(hours),
            datasets: [{
                label,
                data: chartData,
                borderColor: color,
                borderWidth: 2,
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHitRadius: 18,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: color,
                pointHoverBorderColor: '#0b1120',
                pointHoverBorderWidth: 2,
            }]
        },
        options
    });

    return chartInstances[id];
}

// =====================================================================
// Tabelas
// =====================================================================
const HEADER_LABELS = {
    temperaturaDS18B20: "Temperatura",
    Aceton:             "Acetona",
    Alcohol:            "Álcool",
    NH4:                "Amônia"
};

function createTables(headers, data) {
    const table = document.createElement("table");

    const headerRow = table.insertRow();
    headers.forEach(key => {
        const th = document.createElement("th");
        th.innerText = HEADER_LABELS[key] || key;
        headerRow.appendChild(th);
    });

    const parseDate = str => {
        const [d, m, y] = str.split("-").map(Number);
        return new Date(y, m - 1, d);
    };
    const allDates = Object.keys(data).sort((a, b) => parseDate(b) - parseDate(a));

    let lastDate = null;
    let rowCount = 0;

    for (const date of allDates) {
        if (rowCount >= 24) break;
        const dateData = data[date];
        if (!dateData || typeof dateData !== "object") continue;
        const allTimes = Object.keys(dateData).sort().reverse();

        for (const time of allTimes) {
            const timeData = dateData[time];
            if (!timeData || typeof timeData !== "object") continue;
            for (const key in timeData) {
                if (rowCount >= 24) break;
                const item = timeData[key];
                if (!item || typeof item !== "object") continue;
                const row = table.insertRow();

                row.insertCell().innerText = date !== lastDate ? date.replace(/-/g, "/") : "";
                const [hour, minute] = time.split("-");
                row.insertCell().innerText = `${hour.padStart(2,"0")}:${minute.padStart(2,"0")}`;

                for (let i = 2; i < headers.length; i++) {
                    const val = item[headers[i]];
                    const numericValue = Number(val);
                    row.insertCell().innerText = Number.isFinite(numericValue) ? numericValue.toFixed(2) : "--";
                }

                rowCount++;
                lastDate = date;
            }
        }
    }

    return table;
}

// =====================================================================
// Extração de dados
// =====================================================================
function extractData(data, keys, todasDatas) {
    const allDates = todasDatas
        ? Object.keys(data)
        : Object.keys(data).filter(d => d === currentDate || d === yesterdayDate);

    const hours = [];
    const extractedData = Object.fromEntries(keys.map(k => [k, []]));

    const parseDate = str => {
        const [d, m, y] = str.split("-").map(Number);
        return new Date(y, m - 1, d);
    };

    for (const date of allDates.sort((a, b) => parseDate(a) - parseDate(b))) {
        const dateData = data[date];
        if (!dateData || typeof dateData !== "object") continue;
        const allTimes = Object.keys(dateData).sort();
        for (const time of allTimes) {
            const timeData = dateData[time];
            if (!timeData || typeof timeData !== "object") continue;
            const [hourPart, minutePart = "0"] = time.split("-");
            const hour = Number(hourPart);
            const minute = Number(minutePart);
            const decimalHour = hour + (Number.isFinite(minute) ? minute / 60 : 0);
            for (const itemKey in timeData) {
                const item = timeData[itemKey];
                if (!item || typeof item !== "object") continue;
                hours.push(decimalHour);
                keys.forEach(dataKey => {
                    const numericValue = Number(item[dataKey]);
                    extractedData[dataKey].push(Number.isFinite(numericValue) ? numericValue : null);
                });
            }
        }
    }

    return { hours, ...extractedData };
}

// =====================================================================
// Filtro de datas
// =====================================================================
function filterDataByDays(data, days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);

    const parseDate = str => {
        const [d, m, y] = str.split("-").map(Number);
        return new Date(y, m - 1, d);
    };

    const filtered = {};
    for (const date of Object.keys(data).sort((a,b) => parseDate(a)-parseDate(b))) {
        if (parseDate(date) >= cutoff) filtered[date] = data[date];
    }
    return filtered;
}

// =====================================================================
// Utilidades de tempo (gráfico nascer/pôr do sol)
// =====================================================================
function mapRange(value, inMin, inMax, outMin, outMax) {
    return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

function formatTime(value) {
    const hours   = Math.floor(value);
    const minutes = Math.floor((value - hours) * 60);
    return `${hours}:${String(minutes).padStart(2, "0")}`;
}

function tooltipLabel(context) {
    return `${context.dataset.label || ""}: ${formatTime(context.raw)}`;
}

function formatHoursArray(hours) {
    return hours.map(h => formatTime(h));
}

function secondsToHours(seconds) {
    return seconds / 3600;
}

function getNumberValue(item, names) {
    for (const name of names) {
        const value = Number(item[name]);
        if (Number.isFinite(value)) return value;
    }
    return null;
}

function readTimeSeconds(item, hourNames, minuteNames) {
    const hour = getNumberValue(item, hourNames);
    const minute = getNumberValue(item, minuteNames) || 0;
    if (hour == null) return null;
    return hour * 3600 + minute * 60;
}

function getFirstItemForDate(data, date) {
    const dateData = data[date];
    if (!dateData || typeof dateData !== "object") return null;
    for (const key of Object.keys(dateData).sort()) {
        const item = dateData[key];
        if (!item || typeof item !== "object") continue;
        if (
            item.HourNascerDoSol != null ||
            item.HoraNascerDoSol != null ||
            item.HoraAmanhecer != null ||
            item.HourAmanhecer != null
        ) {
            return item;
        }
        for (const nestedKey of Object.keys(item)) {
            const nestedItem = item[nestedKey];
            if (nestedItem && typeof nestedItem === "object") return nestedItem;
        }
    }
    return null;
}

function getLatestDate(data) {
    const parseDate = str => {
        const [d, m, y] = str.split("-").map(Number);
        return new Date(y, m - 1, d);
    };
    return Object.keys(data).sort((a, b) => parseDate(b) - parseDate(a))[0];
}

function getSolarEventsForToday(data) {
    const date = data[currentDate] ? currentDate : getLatestDate(data);
    const item = date ? getFirstItemForDate(data, date) : null;
    if (!item) return null;

    const dawn = readTimeSeconds(item, ["HoraAmanhecer", "HourAmanhecer"], ["MinuteAmanhecer", "MinutoAmanhecer"]);
    const sunrise = readTimeSeconds(item, ["HourNascerDoSol", "HoraNascerDoSol"], ["MinuteNascerDoSol", "MinutoNascerDoSol"]);
    const sunset = readTimeSeconds(item, ["HoraPorDoSol", "HourPorDoSol"], ["MinutePorDoSol", "MinutoPorDoSol"]);
    const dusk = readTimeSeconds(item, ["HourAnoitecer", "HoraAnoitecer"], ["MinuteAnoitecer", "MinutoAnoitecer"]);
    const zenithFromData = readTimeSeconds(
        item,
        ["HoraZenite", "HourZenith", "HoraZenith", "HourZenite", "HoraZênite"],
        ["MinuteZenite", "MinutoZenite", "MinuteZenith", "MinutoZenith", "MinutoZênite"]
    );

    if ([dawn, sunrise, sunset, dusk].some(value => value == null)) return null;

    const zenith = zenithFromData != null ? zenithFromData : sunrise + ((sunset - sunrise) / 2);

    return {
        date,
        dawn: secondsToHours(dawn),
        sunrise: secondsToHours(sunrise),
        zenith: secondsToHours(zenith),
        sunset: secondsToHours(sunset),
        dusk: secondsToHours(dusk)
    };
}

// =====================================================================
// Nascer / Pôr do sol
// =====================================================================
function getSunriseSunsetData(data) {
    const dates = [], sunriseTimes = [], sunsetTimes = [], amanhecerTimes = [], anoitecerTimes = [];

    const parseDate = str => {
        const [d, m, y] = str.split("-").map(Number);
        return new Date(y, m - 1, d);
    };

    for (const date of Object.keys(data).sort((a,b) => parseDate(a)-parseDate(b))) {
        dates.push(date);
        for (const key in data[date]) {
            const item = data[date][key];
            sunriseTimes.push(item.HourNascerDoSol  * 3600 + item.MinuteNascerDoSol  * 60);
            sunsetTimes.push( item.HoraPorDoSol     * 3600 + item.MinutePorDoSol     * 60);
            amanhecerTimes.push(item.HoraAmanhecer  * 3600 + item.MinuteAmanhecer    * 60);
            anoitecerTimes.push(item.HourAnoitecer  * 3600 + item.MinuteAnoitecer    * 60);
        }
    }
    return { dates, sunriseTimes, sunsetTimes, amanhecerTimes, anoitecerTimes };
}

function getSunHistoryOptions({ legend = true, tickSize = 11, labelSize = 11 } = {}) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600 },
        interaction: {
            mode: 'nearest',
            intersect: false,
            axis: 'x'
        },
        hover: {
            mode: 'nearest',
            intersect: false
        },
        plugins: {
            legend: {
                display: legend,
                position: 'top',
                labels: { color: COLORS.text, font: { size: labelSize }, boxWidth: 12, padding: 16 }
            },
            tooltip: {
                ...CHART_DEFAULTS.plugins.tooltip,
                callbacks: { label: tooltipLabel }
            }
        },
        scales: {
            x: {
                grid:  { color: COLORS.grid, drawBorder: false },
                ticks: { color: COLORS.text, font: { size: tickSize }, maxRotation: 45 }
            },
            yLeft: {
                type: "linear", position: "right",
                min: 4, max: 7,
                grid: { color: COLORS.grid, drawBorder: false },
                ticks: { callback: formatTime, color: COLORS.text, font: { size: tickSize } }
            },
            yRight: {
                type: "linear", position: "left",
                min: 17, max: 21,
                grid: { drawOnChartArea: false },
                ticks: { callback: formatTime, color: COLORS.text, font: { size: tickSize } }
            }
        }
    };
}

function createSunriseSunsetChart(data, chartElement) {
    const { dates, sunriseTimes, sunsetTimes, amanhecerTimes, anoitecerTimes } = getSunriseSunsetData(data);
    const formattedDates = dates.map(d => d.replace(/-/g, "/"));
    const remap = (arr, i1, i2, o1, o2) => arr.map(t => mapRange(t, i1, i2, o1, o2));

    const ctx = chartElement || plotSunriseSunset;
    const id  = ctx.canvas.id;
    if (chartInstances[id]) chartInstances[id].destroy();

    if (!dates.length) {
        renderChartMessage("chart-container-sun", "Sem histórico solar recente.");
        return;
    }

    chartInstances[id] = new Chart(ctx, {
        type: "line",
        data: {
            labels: formattedDates,
            datasets: [
                { label: "Amanhecer",     yAxisID: "yLeft",  data: remap(amanhecerTimes,14400,25200,4,7),  borderColor: "#fde68a", backgroundColor: "transparent", tension: 0.4, borderWidth: 2, pointRadius: 0, pointHitRadius: 18, pointHoverRadius: 6, order: 1 },
                { label: "Nascer do sol", yAxisID: "yLeft",  data: remap(sunriseTimes,  14400,25200,4,7),  borderColor: "#fb923c", backgroundColor: "transparent", tension: 0.4, borderWidth: 2, pointRadius: 0, pointHitRadius: 18, pointHoverRadius: 6, order: 2 },
                { label: "Pôr do sol",    yAxisID: "yRight", data: remap(sunsetTimes,   61200,75600,17,21), borderColor: "#f87171", backgroundColor: "transparent", tension: 0.4, borderWidth: 2, pointRadius: 0, pointHitRadius: 18, pointHoverRadius: 6, order: 3 },
                { label: "Anoitecer",     yAxisID: "yRight", data: remap(anoitecerTimes,61200,75600,17,21), borderColor: "#818cf8", backgroundColor: "transparent", tension: 0.4, borderWidth: 2, pointRadius: 0, pointHitRadius: 18, pointHoverRadius: 6, order: 4 }
            ]
        },
        options: getSunHistoryOptions()
    });
}

const solarDayBackgroundPlugin = {
    id: "solarDayBackground",
    beforeDatasetsDraw(chart) {
        const times = chart.$solarDayTimes;
        const xScale = chart.scales.x;
        const area = chart.chartArea;
        if (!times || !xScale || !area) return;

        const ctx = chart.ctx;
        const dawnX = xScale.getPixelForValue(times.dawn);
        const sunriseX = xScale.getPixelForValue(times.sunrise);
        const zenithX = xScale.getPixelForValue(times.zenith);
        const sunsetX = xScale.getPixelForValue(times.sunset);
        const duskX = xScale.getPixelForValue(times.dusk);

        ctx.save();
        ctx.fillStyle = "rgba(15, 23, 42, 0.72)";
        ctx.fillRect(area.left, area.top, Math.max(0, dawnX - area.left), area.bottom - area.top);
        ctx.fillRect(duskX, area.top, Math.max(0, area.right - duskX), area.bottom - area.top);

        const twilight = ctx.createLinearGradient(dawnX, 0, sunriseX, 0);
        twilight.addColorStop(0, "rgba(148, 163, 184, 0.24)");
        twilight.addColorStop(1, "rgba(251, 191, 36, 0.22)");
        ctx.fillStyle = twilight;
        ctx.fillRect(dawnX, area.top, Math.max(0, sunriseX - dawnX), area.bottom - area.top);

        const daylight = ctx.createLinearGradient(sunriseX, 0, sunsetX, 0);
        daylight.addColorStop(0, "rgba(251, 191, 36, 0.20)");
        daylight.addColorStop(0.5, "rgba(254, 240, 138, 0.38)");
        daylight.addColorStop(1, "rgba(251, 191, 36, 0.20)");
        ctx.fillStyle = daylight;
        ctx.fillRect(sunriseX, area.top, Math.max(0, sunsetX - sunriseX), area.bottom - area.top);

        const evening = ctx.createLinearGradient(sunsetX, 0, duskX, 0);
        evening.addColorStop(0, "rgba(251, 146, 60, 0.24)");
        evening.addColorStop(1, "rgba(129, 140, 248, 0.18)");
        ctx.fillStyle = evening;
        ctx.fillRect(sunsetX, area.top, Math.max(0, duskX - sunsetX), area.bottom - area.top);

        ctx.strokeStyle = "rgba(251, 191, 36, 0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(zenithX, area.top);
        ctx.lineTo(zenithX, area.bottom);
        ctx.stroke();
        ctx.restore();
    }
};

function getSolarTodayOptions({ tickSize = 11, labelSize = 11 } = {}) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600 },
        interaction: {
            mode: "nearest",
            intersect: false,
            axis: "x"
        },
        hover: {
            mode: "nearest",
            intersect: false
        },
        plugins: {
            legend: {
                display: true,
                position: "top",
                labels: { color: COLORS.text, font: { size: labelSize }, boxWidth: 12, padding: 16 }
            },
            tooltip: {
                ...CHART_DEFAULTS.plugins.tooltip,
                filter: context => context.dataset.label === "Eventos solares",
                callbacks: {
                    title: items => items[0]?.raw?.label || "",
                    label: context => {
                        const raw = context.raw;
                        return raw && raw.timeLabel ? raw.timeLabel : formatTime(context.parsed.x);
                    }
                }
            }
        },
        scales: {
            x: {
                type: "linear",
                min: 0,
                max: 24,
                grid: { color: "rgba(99,132,200,0.13)", drawBorder: false },
                ticks: {
                    stepSize: 2,
                    color: COLORS.text,
                    font: { size: tickSize },
                    callback: value => `${value}h`
                }
            },
            y: {
                min: 0,
                max: 1.12,
                grid: { color: "rgba(99,132,200,0.10)", drawBorder: false },
                ticks: { display: false }
            }
        }
    };
}

function createSolarTodayChart(data, chartElement) {
    const events = getSolarEventsForToday(data);
    const ctx = chartElement || plotSolarToday;
    const id = ctx.canvas.id;
    if (chartInstances[id]) chartInstances[id].destroy();

    if (!events) {
        renderChartMessage("chart-container-sun-today", "Sem dados suficientes para o ciclo solar de hoje.");
        return;
    }

    const daylightPoints = [
        { x: 0, y: 0 },
        { x: events.dawn, y: 0.08, label: "Amanhecer", timeLabel: formatTime(events.dawn) },
        { x: events.sunrise, y: 0.52, label: "Nascer do sol", timeLabel: formatTime(events.sunrise) },
        { x: events.zenith, y: 1, label: "Zenite", timeLabel: formatTime(events.zenith) },
        { x: events.sunset, y: 0.52, label: "Pôr do sol", timeLabel: formatTime(events.sunset) },
        { x: events.dusk, y: 0.08, label: "Anoitecer", timeLabel: formatTime(events.dusk) },
        { x: 24, y: 0 }
    ];
    const eventPoints = [
        daylightPoints[1],
        daylightPoints[2],
        daylightPoints[3],
        daylightPoints[4],
        daylightPoints[5]
    ];

    chartInstances[id] = new Chart(ctx, {
        type: "line",
        data: {
            datasets: [
                {
                    label: "Luz do dia",
                    data: daylightPoints,
                    borderColor: "#facc15",
                    backgroundColor: "rgba(250, 204, 21, 0.22)",
                    fill: true,
                    tension: 0.42,
                    pointRadius: 0,
                    pointHitRadius: 18,
                    pointHoverRadius: 0,
                    order: 2
                },
                {
                    type: "scatter",
                    label: "Eventos solares",
                    data: eventPoints,
                    borderColor: "#f8fafc",
                    backgroundColor: ["#fde68a", "#fb923c", "#facc15", "#f87171", "#818cf8"],
                    pointBorderColor: "#0b1120",
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHitRadius: 18,
                    pointHoverRadius: 7,
                    order: 1
                }
            ]
        },
        options: getSolarTodayOptions(),
        plugins: [solarDayBackgroundPlugin]
    });

    chartInstances[id].$solarDayTimes = events;
}

// =====================================================================
// Quarto
// =====================================================================
function createTable(data)          { return createTables(["Data","Hora","Temperatura","Sensacao termica","Umidade"], data); }
function createTemperatureChart(d)  { return createChart(plotsTemp,    d, "Temperatura",      "Temperatura",      COLORS.blue,   "(°C)", "°",  false); }
function createSTChart(d)           { return createChart(plotsST,      d, "Sensacao termica", "Sensação Térmica", COLORS.green,  "(°C)", "°",  false); }
function createUmidadeChart(d)      { return createChart(plotsUmidade, d, "Umidade",          "Umidade",          COLORS.purple, null,   "%",  false); }

// =====================================================================
// Aquário
// =====================================================================
function createTableAquario(d)             { return createTables(["Data","Hora","temperaturaDS18B20","PH","TDS","Turbidez"], d); }
function createTemperatureChartAquario(d)  { return createChart(plotsTempAquario, d, "temperaturaDS18B20", "Temperatura", COLORS.blue,  "(°C)", "°", false); }
function createPHChartAquario(d)           { return createChart(plotsPH,          d, "PH",                "PH",          COLORS.teal,  null,   "",  false); }
function createTDSChartAquario(d)          { return createChart(plotsTDS,         d, "TDS",               "TDS",         COLORS.amber, null,   "",  false); }
function createTurbidezChartAquario(d)     { return createChart(plotsTurbidez,    d, "Turbidez",          "Turbidez",    COLORS.rose,  null,   "",  false); }

// =====================================================================
// Sala
// =====================================================================
function createTableSala(d)             { return createTables(["Data","Hora","CO","CO2","Aceton","Alcohol","NH4"], d); }
function createTemperatureChartSala(d)  { return createChart(plotsTempSala,    d, "temperatura",    "Temperatura",      COLORS.blue,   "(°C)", "°", false); }
function createSTChartSala(d)           { return createChart(plotsSTSala,      d, "sensacaoTermica","Sensação Térmica", COLORS.green,  "(°C)", "°", false); }
function createUmidadeChartSala(d)      { return createChart(plotsUmidadeSala, d, "umidade",        "Umidade",          COLORS.purple, null,   "%", false); }
function createPressaoChartSala(d)      { return createChart(plotsPressaoSala, d, "pressao",        "Pressão (hPa)",    COLORS.amber,  null,   "",  false); }
