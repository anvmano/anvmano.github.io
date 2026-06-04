'use strict';

(function () {
    const { ids, fields, humidityComfortBand } = window.AppConfig;
    const roomFields = fields.room;
    const temperatureChart = document.getElementById(ids.charts.roomTemperature).getContext("2d");
    const feelsLikeChart = document.getElementById(ids.charts.roomFeelsLike).getContext("2d");
    const humidityChart = document.getElementById(ids.charts.roomHumidity).getContext("2d");

    function createTable(data) {
        return ClimateData.createTables([
            roomFields.date,
            roomFields.time,
            roomFields.temperature,
            roomFields.feelsLike,
            roomFields.humidity,
        ], data);
    }

    function render({ data, selectedDate, createChart, colors, ui }) {
        const filteredData = ClimateData.filterDataByDays(data, 2, selectedDate);
        ClimateAnalytics.renderStats("quarto", filteredData, selectedDate);
        ClimateAnalytics.renderAdvancedClimateViews(data, selectedDate, {
            metricKey: roomFields.temperature,
            containers: ids.advancedViews.room,
        });

        createChart({
            canvasCtx: temperatureChart,
            containerId: ids.chartContainers.roomTemperature,
            data: filteredData,
            key: roomFields.temperature,
            label: "Temperatura",
            color: colors.blue,
            yAxisTitle: "(°C)",
            yAxisSuffix: "°",
            emptyMessage: `Sem dados de temperatura em ${selectedDate.replace(/-/g, "/")}.`
        });
        createChart({
            canvasCtx: feelsLikeChart,
            containerId: ids.chartContainers.roomFeelsLike,
            data: filteredData,
            key: roomFields.feelsLike,
            label: "Sensação Térmica",
            color: colors.green,
            yAxisTitle: "(°C)",
            yAxisSuffix: "°",
            emptyMessage: `Sem dados de sensação térmica em ${selectedDate.replace(/-/g, "/")}.`
        });
        createChart({
            canvasCtx: humidityChart,
            containerId: ids.chartContainers.roomHumidity,
            data: filteredData,
            key: roomFields.humidity,
            label: "Umidade",
            color: colors.purple,
            yAxisTitle: "%",
            yAxisSuffix: "%",
            comfortBand: humidityComfortBand,
            emptyMessage: `Sem dados de umidade em ${selectedDate.replace(/-/g, "/")}.`
        });

        ui.renderTable(ids.tables.room, createTable(filteredData), `Sem registros de temperatura em ${selectedDate.replace(/-/g, "/")}.`);
    }

    window.QuartoView = { render };
})();
