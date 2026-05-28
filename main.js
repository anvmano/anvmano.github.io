'use strict';

const AppConfig = window.AppConfig;
const ClimateData = window.ClimateData;
const ClimateAnalytics = window.ClimateAnalytics;
const ClimateSolar = window.ClimateSolar;
const ClimateCharts = window.ClimateCharts;
const FirebaseService = window.FirebaseService;
const ClimateUI = window.ClimateUI;
const ClimateZoom = window.ClimateZoom;
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
    includeAllDates = false,
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
        includeAllDates,
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
            return;
        }
        renderSolarData(data);
    }, () => {
        ClimateUI.renderChartMessage(IDS.chartContainers.sunHistory, "Falha ao carregar dados solares.", "error");
        ClimateUI.renderChartMessage(IDS.chartContainers.solarToday, "Falha ao carregar ciclo solar.", "error");
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
    ClimateUI.setupDateControls({
        getSelectedDate,
        setSelectedDate,
        getTodayDate: ClimateData.dataAtual,
        onDateChange: rerenderDashboardFromSelectedDate
    });
    ClimateUI.setupCollapsibleSections();
    ClimateZoom.setup({ chartInstances, getZoomOptions });

    setupFirebaseListeners().catch(error => {
        FirebaseService.handleError("Firebase", error);
        FirebaseService.setLoading(false);
        ClimateUI.renderStartupError();
    });
});
