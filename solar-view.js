'use strict';

(function () {
    const sunHistoryChart = document.getElementById("plotSunriseSunset").getContext("2d");
    const solarTodayChart = document.getElementById("plotSolarToday").getContext("2d");

    function render({ data, selectedDate, chartInstances, defaults, colors, ui }) {
        ui.clearChartMessage("chart-container-sun");
        ui.clearChartMessage("chart-container-sun-today");

        const historyData = ClimateData.filterDataByDays(data, 365, selectedDate, false);
        createSunriseSunsetChart({ data: historyData, chartInstances, defaults, colors, ui });
        createSolarTodayChart({ data, selectedDate, chartInstances, defaults, colors, ui });
    }

    function createSunriseSunsetChart({ data, chartInstances, defaults, colors, ui }) {
        const id = sunHistoryChart.canvas.id;
        const chart = ClimateSolar.createSunriseSunsetChart({
            data,
            ctx: sunHistoryChart,
            existingChart: chartInstances[id],
            defaults,
            colors,
            onEmpty: () => ui.renderChartMessage("chart-container-sun", "Sem histórico solar recente.")
        });
        if (chart) chartInstances[id] = chart;
    }

    function createSolarTodayChart({ data, selectedDate, chartInstances, defaults, colors, ui }) {
        const id = solarTodayChart.canvas.id;
        const chart = ClimateSolar.createSolarTodayChart({
            data,
            selectedDate,
            ctx: solarTodayChart,
            existingChart: chartInstances[id],
            defaults,
            colors,
            onEmpty: () => ui.renderChartMessage("chart-container-sun-today", `Sem dados suficientes para o ciclo solar em ${selectedDate.replace(/-/g, "/")}.`)
        });
        if (chart) chartInstances[id] = chart;
    }

    window.SolarView = { render };
})();
