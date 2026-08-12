'use strict';

(function () {
    const { ids } = window.AppConfig;
    const sunHistoryChart = document.getElementById(ids.charts.sunHistory).getContext("2d");
    const solarTodayChart = document.getElementById(ids.charts.solarToday).getContext("2d");

    function render({ data, selectedDate, chartInstances, defaults, colors, ui, ensureChart }) {
        ui.clearChartMessage(ids.chartContainers.sunHistory);
        ui.clearChartMessage(ids.chartContainers.solarToday);
        atualizarChipDuracaoDia(null);

        if (!window.Chart) {
            ui.renderChartMessage(ids.chartContainers.sunHistory, "Carregando gráfico...", "loading");
            ui.renderChartMessage(ids.chartContainers.solarToday, "Carregando gráfico...", "loading");
            if (typeof ensureChart === "function") ensureChart();
            return;
        }

        const historyData = ClimateData.filterDataByDays(data, 365, selectedDate, false);
        createSunriseSunsetChart({ data: historyData, selectedDate, chartInstances, defaults, colors, ui });
        createSolarTodayChart({ data, selectedDate, chartInstances, defaults, colors, ui });
    }

    function createSunriseSunsetChart({ data, selectedDate, chartInstances, defaults, colors, ui }) {
        const id = sunHistoryChart.canvas.id;
        const chart = ClimateSolar.createSunriseSunsetChart({
            data,
            ctx: sunHistoryChart,
            existingChart: chartInstances[id],
            defaults,
            colors,
            onEmpty: () => ui.renderChartMessage(ids.chartContainers.sunHistory, `Sem dados de nascer e pôr do sol em ${selectedDate.replace(/-/g, "/")}.`)
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
            onEmpty: () => ui.renderChartMessage(ids.chartContainers.solarToday, `Sem dados de ciclo solar em ${selectedDate.replace(/-/g, "/")}.`)
        });
        if (chart) {
            chartInstances[id] = chart;
            atualizarChipDuracaoDia(chart.$solarDayTimes);
        }
    }

    function atualizarChipDuracaoDia(eventos) {
        const chip = document.getElementById("solarTodayDuration");
        if (!chip) return;

        const duracao = ClimateSolar.formatarDuracaoDia(eventos);
        chip.hidden = !duracao;
        chip.textContent = duracao ? `Duração do dia: ${duracao}` : "";
    }

    window.SolarView = { render };
})();
