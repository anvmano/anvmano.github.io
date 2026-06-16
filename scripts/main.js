'use strict';

const AppConfig = window.AppConfig;
const ClimateData = window.ClimateData;
const ClimateAnalytics = window.ClimateAnalytics;
const ClimateSolar = window.ClimateSolar;
const ClimateCharts = window.ClimateCharts;
const ClimateAqi = window.ClimateAqi;
const ClimateSeason = window.ClimateSeason;
const FirebaseService = window.FirebaseService;
const ClimateUI = window.ClimateUI;
const ClimateZoom = window.ClimateZoom;
const ClimatePdfReport = window.ClimatePdfReport;
const ClimateAIService = window.ClimateAIService;
const ClimateChat = window.ClimateChat;
const QuartoView = window.QuartoView;
const AquarioView = window.AquarioView;
const SalaView = window.SalaView;
const SolarView = window.SolarView;
const EstacaoView = window.EstacaoView;

if (
    !AppConfig ||
    !ClimateData ||
    !ClimateAnalytics ||
    !ClimateSolar ||
    !ClimateCharts ||
    !ClimateAqi ||
    !ClimateSeason ||
    !FirebaseService ||
    !ClimateUI ||
    !ClimateZoom ||
    !ClimatePdfReport ||
    !ClimateAIService ||
    !ClimateChat ||
    !QuartoView ||
    !AquarioView ||
    !SalaView ||
    !SolarView ||
    !EstacaoView
) {
    throw new Error("Módulos auxiliares não foram carregados na ordem correta.");
}

const chartInstances = {};
const latestData = {
    room: null,
    solar: null,
    aquarium: null,
    livingRoom: null,
};

const COLORS = AppConfig.colors;
const COMFORT_BAND = AppConfig.comfortBand;
const CHART_DEFAULTS = ClimateCharts.createDefaults(COLORS);
const FIREBASE_PATHS = AppConfig.firebasePaths;
const IDS = AppConfig.ids;

let selectedDate = ClimateData.dataAtual();
let astroIndicatorTimer = null;
let lastAstroState = null;

ClimateCharts.registerComfortBand();

function getSelectedDate() {
    return selectedDate;
}

function setSelectedDate(date) {
    selectedDate = date;
    ClimateSeason.update(selectedDate);
}

function createChart({
    canvasCtx,
    containerId,
    data,
    key,
    label,
    color,
    yAxisTitle,
    yAxisSuffix = "",
    comfortBand = COMFORT_BAND,
    emptyMessage = "Sem dados para esta data."
}) {
    const id = canvasCtx.canvas.id;
    const chart = ClimateCharts.createLineChart({
        canvasCtx,
        data,
        key,
        label,
        color,
        yAxisTitle,
        yAxisSuffix,
        existingChart: chartInstances[id],
        defaults: CHART_DEFAULTS,
        colors: COLORS,
        comfortBand,
        onEmpty: () => {
            delete chartInstances[id];
            if (containerId) ClimateUI.renderChartMessage(containerId, emptyMessage);
        },
        onReady: () => {
            if (containerId) ClimateUI.clearChartMessage(containerId);
        }
    });
    if (chart) chartInstances[id] = chart;
    return chartInstances[id];
}

function getZoomOptions(sourceId) {
    if (sourceId === IDS.charts.sunHistory) {
        return ClimateSolar.getSunHistoryOptions({
            legend: true,
            tickSize: 12,
            labelSize: 12,
            defaults: CHART_DEFAULTS,
            colors: COLORS
        });
    }

    if (sourceId === IDS.charts.solarToday) {
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

function renderRoomData(data) {
    QuartoView.render({
        data,
        selectedDate,
        createChart,
        colors: COLORS,
        ui: ClimateUI
    });
}

function renderStationData() {
    EstacaoView.render({
        latestData,
        selectedDate,
        chartInstances,
        defaults: CHART_DEFAULTS,
        colors: COLORS,
        ui: ClimateUI
    });
}

function renderAquariumData(data) {
    AquarioView.render({
        data,
        selectedDate,
        createChart,
        colors: COLORS,
        ui: ClimateUI
    });
}

function renderLivingRoomData(data) {
    ClimateAqi.update(data);
    SalaView.render({
        data,
        selectedDate,
        createChart,
        colors: COLORS,
        ui: ClimateUI
    });
}

function rerenderDashboardFromSelectedDate() {
    renderStationData();
    if (latestData.room) renderRoomData(latestData.room);
    if (latestData.aquarium) renderAquariumData(latestData.aquarium);
    if (latestData.livingRoom) renderLivingRoomData(latestData.livingRoom);
}

function getCurrentHourValue(now = new Date()) {
    return now.getHours() + (now.getMinutes() / 60) + (now.getSeconds() / 3600);
}

function getTodaySolarEvents() {
    if (!latestData.solar) return null;
    return ClimateSolar.getSolarEventsForSelectedDate(latestData.solar, ClimateData.dataAtual());
}

function getFallbackSolarEvents() {
    return {
        dawn: 5.5,
        sunrise: 6,
        zenith: 12,
        sunset: 18,
        dusk: 18.5
    };
}

function formatAstroHour(value) {
    if (!Number.isFinite(value)) return "--";
    const totalMinutes = Math.round(value * 60);
    const hour = Math.floor(totalMinutes / 60) % 24;
    const minute = totalMinutes % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function getAstroDescription(state) {
    return `Nascer do sol: ${formatAstroHour(state.events.sunrise)} · Pôr do sol: ${formatAstroHour(state.events.sunset)}`;
}

function getAstroModeLabel(mode) {
    if (mode === "day") return "Dia";
    if (mode === "twilight") return "Transição";
    return "Noite";
}

function formatAstroDuration(start, end) {
    if (!Number.isFinite(start) || !Number.isFinite(end)) return "--";
    const totalMinutes = Math.max(0, Math.round((end - start) * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h${String(minutes).padStart(2, "0")}`;
}

function getAstroState(now = new Date()) {
    const solarEvents = getTodaySolarEvents();
    const events = solarEvents || getFallbackSolarEvents();
    const hour = getCurrentHourValue(now);
    const isTwilight = (hour >= events.dawn && hour < events.sunrise) || (hour > events.sunset && hour <= events.dusk);
    const isDay = hour >= events.sunrise && hour <= events.sunset;
    const isSolarPath = hour >= events.dawn && hour <= events.dusk;
    const mode = isTwilight ? "twilight" : isDay ? "day" : "night";
    const rangeStart = isSolarPath ? events.dawn : events.dusk;
    const rangeEnd = isSolarPath ? events.dusk : events.sunrise + 24;
    const adjustedHour = !isSolarPath && hour < events.sunrise ? hour + 24 : hour;
    const progress = Math.min(1, Math.max(0, (adjustedHour - rangeStart) / (rangeEnd - rangeStart || 1)));
    const y = 3 + Math.sin(progress * Math.PI) * 12;

    return {
        mode,
        progress,
        x: `${(progress * 100).toFixed(1)}%`,
        y: `${y.toFixed(1)}px`,
        events,
        source: solarEvents ? "dados solares" : "fallback 06:00-18:00",
    };
}

function updateAstroIndicator() {
    const indicator = document.getElementById("astroIndicator");
    if (!indicator) return;

    const state = getAstroState();
    lastAstroState = state;
    const labelElement = indicator.querySelector(".astro-indicator__label");

    indicator.classList.remove("astro-indicator--day", "astro-indicator--twilight", "astro-indicator--night");
    indicator.classList.add(`astro-indicator--${state.mode}`);
    indicator.style.setProperty("--astro-progress", state.progress.toFixed(3));
    const track = indicator.querySelector(".astro-indicator__track");
    if (track) track.style.setProperty("--astro-x", state.x);
    indicator.style.setProperty("--astro-y", state.y);
    if (labelElement) labelElement.textContent = "";
    indicator.title = getAstroDescription(state);
    indicator.setAttribute("aria-label", indicator.title);
    updateAstroPopover(state);
}

function setupAstroIndicator() {
    const indicator = document.getElementById("astroIndicator");
    const popover = document.getElementById("astroPopover");

    if (indicator && popover) {
        indicator.setAttribute("role", "button");
        indicator.setAttribute("tabindex", "0");
        indicator.setAttribute("aria-controls", "astroPopover");
        indicator.setAttribute("aria-expanded", "false");
        indicator.addEventListener("click", event => {
            event.stopPropagation();
            toggleAstroPopover();
        });
        indicator.addEventListener("keydown", event => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            toggleAstroPopover();
        });
        document.addEventListener("click", event => {
            if (popover.hidden) return;
            if (popover.contains(event.target) || indicator.contains(event.target)) return;
            closeAstroPopover();
        });
        document.addEventListener("keydown", event => {
            if (event.key === "Escape") closeAstroPopover();
        });
        window.addEventListener("header-popover-open", event => {
            if (event.detail?.source !== "astro") closeAstroPopover();
        });
    }

    updateAstroIndicator();
    if (astroIndicatorTimer) clearInterval(astroIndicatorTimer);
    astroIndicatorTimer = setInterval(updateAstroIndicator, 60000);
}

function toggleAstroPopover() {
    const indicator = document.getElementById("astroIndicator");
    const popover = document.getElementById("astroPopover");
    if (!indicator || !popover) return;

    if (popover.hidden) {
        window.dispatchEvent(new CustomEvent("header-popover-open", { detail: { source: "astro" } }));
        updateAstroPopover(lastAstroState || getAstroState());
        popover.hidden = false;
        indicator.setAttribute("aria-expanded", "true");
    } else {
        closeAstroPopover();
    }
}

function closeAstroPopover() {
    const indicator = document.getElementById("astroIndicator");
    const popover = document.getElementById("astroPopover");
    if (!indicator || !popover) return;

    popover.hidden = true;
    indicator.setAttribute("aria-expanded", "false");
}

function updateAstroPopover(state) {
    const popover = document.getElementById("astroPopover");
    if (!popover || !state) return;

    const headerValue = popover.querySelector(".astro-popover__header strong");
    const list = popover.querySelector(".astro-popover__list");
    if (!headerValue || !list) return;

    headerValue.textContent = getAstroModeLabel(state.mode);
    list.innerHTML = [
        ["Amanhecer", formatAstroHour(state.events.dawn)],
        ["Nascer do sol", formatAstroHour(state.events.sunrise)],
        ["Zênite", formatAstroHour(state.events.zenith)],
        ["Pôr do sol", formatAstroHour(state.events.sunset)],
        ["Anoitecer", formatAstroHour(state.events.dusk)],
        ["Duração do dia", formatAstroDuration(state.events.sunrise, state.events.sunset)],
    ].map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("");
}

async function setupFirebaseListeners() {
    FirebaseService.trackLoadStart();
    try {
        await FirebaseService.initialize();
    } finally {
        FirebaseService.trackLoadEnd();
    }

    FirebaseService.listenToPath(FIREBASE_PATHS.room, data => {
        latestData.room = data;
        if (!data) {
            ClimateUI.renderEmptyState(IDS.tables.room, "Sem dados de temperatura.");
            renderStationData();
            return;
        }
        renderRoomData(data);
        renderStationData();
    }, () => ClimateUI.renderEmptyState(IDS.tables.room, "Falha ao carregar dados de temperatura.", "error"));

    FirebaseService.listenToPath(FIREBASE_PATHS.solar, data => {
        latestData.solar = data;
        if (!data) {
            const formattedDate = selectedDate.replace(/-/g, "/");
            ClimateUI.renderChartMessage(IDS.chartContainers.sunHistory, `Sem dados de nascer e pôr do sol em ${formattedDate}.`);
            ClimateUI.renderChartMessage(IDS.chartContainers.solarToday, `Sem dados de ciclo solar em ${formattedDate}.`);
            renderStationData();
            updateAstroIndicator();
            return;
        }
        renderStationData();
        updateAstroIndicator();
    }, () => {
        ClimateUI.renderChartMessage(IDS.chartContainers.sunHistory, "Falha ao carregar dados solares.", "error");
        ClimateUI.renderChartMessage(IDS.chartContainers.solarToday, "Falha ao carregar ciclo solar.", "error");
        renderStationData();
        updateAstroIndicator();
    });

    FirebaseService.listenToPath(FIREBASE_PATHS.aquarium, data => {
        latestData.aquarium = data;
        if (!data) {
            ClimateUI.renderEmptyState(IDS.tables.aquarium, "Sem dados do aquário.");
            renderStationData();
            return;
        }
        renderAquariumData(data);
        renderStationData();
    }, () => ClimateUI.renderEmptyState(IDS.tables.aquarium, "Falha ao carregar dados do aquário.", "error"));

    FirebaseService.listenToPath(FIREBASE_PATHS.livingRoom, data => {
        latestData.livingRoom = data;
        if (!data) {
            ClimateAqi.update(null);
            ClimateUI.renderEmptyState(IDS.tables.livingRoom, "Sem dados da sala.");
            renderStationData();
            return;
        }
        renderLivingRoomData(data);
        renderStationData();
    }, () => ClimateUI.renderEmptyState(IDS.tables.livingRoom, "Falha ao carregar dados da sala.", "error"));
}

document.addEventListener("DOMContentLoaded", () => {
    ClimateUI.setupTabs("Tab0");
    ClimateUI.setupTabSwipe({
        tabOrder: ["Tab0", "Tab1", "Tab2", "Tab3"]
    });
    ClimateUI.setupDateControls({
        getSelectedDate,
        setSelectedDate,
        getTodayDate: ClimateData.dataAtual,
        onDateChange: rerenderDashboardFromSelectedDate
    });
    ClimateUI.setupCollapsibleSections();
    ClimateZoom.setup({ chartInstances, getZoomOptions });
    ClimatePdfReport.setup({
        buttonId: "btnExportData",
        formatName: "exportFormat",
        getContext: () => ({
            activeTab: ClimateUI.getActiveTabName(),
            selectedDate,
            latestData,
            chartInstances,
        })
    });
    ClimateChat.setup({
        getContext: () => ({
            activeTab: ClimateUI.getActiveTabName(),
            selectedDate,
            latestData,
        })
    });
    ClimateAqi.setup();
    ClimateSeason.setup({ getSelectedDate });
    setupAstroIndicator();

    setupFirebaseListeners().catch(error => {
        FirebaseService.handleError("Firebase", error);
        FirebaseService.setLoading(false);
        ClimateUI.renderStartupError();
    });
});
