'use strict';

const AppConfig = window.AppConfig;
const ClimateData = window.ClimateData;
const ClimateAnalytics = window.ClimateAnalytics;
const ClimateSolar = window.ClimateSolar;
const ClimateCharts = window.ClimateCharts;
const FirebaseService = window.FirebaseService;
const ClimateUI = window.ClimateUI;
const ClimateZoom = window.ClimateZoom;
const ClimatePdfReport = window.ClimatePdfReport;
const QuartoView = window.QuartoView;
const AquarioView = window.AquarioView;
const SalaView = window.SalaView;
const SolarView = window.SolarView;

if (
    !AppConfig ||
    !ClimateData ||
    !ClimateAnalytics ||
    !ClimateSolar ||
    !ClimateCharts ||
    !FirebaseService ||
    !ClimateUI ||
    !ClimateZoom ||
    !ClimatePdfReport ||
    !QuartoView ||
    !AquarioView ||
    !SalaView ||
    !SolarView
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

ClimateCharts.registerComfortBand();

function getSelectedDate() {
    return selectedDate;
}

function setSelectedDate(date) {
    selectedDate = date;
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
        comfortBand: COMFORT_BAND,
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

function renderSolarData(data) {
    SolarView.render({
        data,
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
    SalaView.render({
        data,
        selectedDate,
        createChart,
        colors: COLORS,
        ui: ClimateUI
    });
}

function rerenderDashboardFromSelectedDate() {
    if (latestData.room) renderRoomData(latestData.room);
    if (latestData.solar) renderSolarData(latestData.solar);
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

function getAstroState(now = new Date()) {
    const events = getTodaySolarEvents() || getFallbackSolarEvents();
    const hour = getCurrentHourValue(now);
    const isTwilight = (hour >= events.dawn && hour < events.sunrise) || (hour > events.sunset && hour <= events.dusk);
    const isDay = hour >= events.sunrise && hour <= events.sunset;
    const isSolarPath = hour >= events.dawn && hour <= events.dusk;
    const mode = isTwilight ? "twilight" : isDay ? "day" : "night";
    const rangeStart = isSolarPath ? events.dawn : events.dusk;
    const rangeEnd = isSolarPath ? events.dusk : events.sunrise + 24;
    const adjustedHour = !isSolarPath && hour < events.sunrise ? hour + 24 : hour;
    const progress = Math.min(1, Math.max(0, (adjustedHour - rangeStart) / (rangeEnd - rangeStart || 1)));
    const y = 5 + Math.sin(progress * Math.PI) * 11;

    return {
        mode,
        progress,
        x: `${(progress * 100).toFixed(1)}%`,
        y: `${y.toFixed(1)}px`,
    };
}

function updateAstroIndicator() {
    const indicator = document.getElementById("astroIndicator");
    if (!indicator) return;

    const state = getAstroState();
    const label = state.mode === "night" ? "Noite" : state.mode === "twilight" ? "Solar" : "Dia";
    const description = state.mode === "night" ? "Noite" : state.mode === "twilight" ? "Transição solar" : "Dia";
    const labelElement = indicator.querySelector(".astro-indicator__label");

    indicator.classList.remove("astro-indicator--day", "astro-indicator--twilight", "astro-indicator--night");
    indicator.classList.add(`astro-indicator--${state.mode}`);
    indicator.style.setProperty("--astro-progress", state.progress.toFixed(3));
    const track = indicator.querySelector(".astro-indicator__track");
    if (track) track.style.setProperty("--astro-x", state.x);
    indicator.style.setProperty("--astro-y", state.y);
    if (labelElement) labelElement.textContent = label;
    indicator.title = description;
    indicator.setAttribute("aria-label", indicator.title);
}

function setupAstroIndicator() {
    updateAstroIndicator();
    if (astroIndicatorTimer) clearInterval(astroIndicatorTimer);
    astroIndicatorTimer = setInterval(updateAstroIndicator, 60000);
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
            return;
        }
        renderRoomData(data);
    }, () => ClimateUI.renderEmptyState(IDS.tables.room, "Falha ao carregar dados de temperatura.", "error"));

    FirebaseService.listenToPath(FIREBASE_PATHS.solar, data => {
        latestData.solar = data;
        if (!data) {
            ClimateUI.renderChartMessage(IDS.chartContainers.sunHistory, "Sem dados solares.");
            ClimateUI.renderChartMessage(IDS.chartContainers.solarToday, "Sem dados solares de hoje.");
            updateAstroIndicator();
            return;
        }
        renderSolarData(data);
        updateAstroIndicator();
    }, () => {
        ClimateUI.renderChartMessage(IDS.chartContainers.sunHistory, "Falha ao carregar dados solares.", "error");
        ClimateUI.renderChartMessage(IDS.chartContainers.solarToday, "Falha ao carregar ciclo solar.", "error");
        updateAstroIndicator();
    });

    FirebaseService.listenToPath(FIREBASE_PATHS.aquarium, data => {
        latestData.aquarium = data;
        if (!data) {
            ClimateUI.renderEmptyState(IDS.tables.aquarium, "Sem dados do aquário.");
            return;
        }
        renderAquariumData(data);
    }, () => ClimateUI.renderEmptyState(IDS.tables.aquarium, "Falha ao carregar dados do aquário.", "error"));

    FirebaseService.listenToPath(FIREBASE_PATHS.livingRoom, data => {
        latestData.livingRoom = data;
        if (!data) {
            ClimateUI.renderEmptyState(IDS.tables.livingRoom, "Sem dados da sala.");
            return;
        }
        renderLivingRoomData(data);
    }, () => ClimateUI.renderEmptyState(IDS.tables.livingRoom, "Falha ao carregar dados da sala.", "error"));
}

document.addEventListener("DOMContentLoaded", () => {
    ClimateUI.setupTabs("Tab1");
    ClimateUI.setupTabSwipe({
        tabOrder: ["Tab1", "Tab2", "Tab3"]
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
    setupAstroIndicator();

    setupFirebaseListeners().catch(error => {
        FirebaseService.handleError("Firebase", error);
        FirebaseService.setLoading(false);
        ClimateUI.renderStartupError();
    });
});
