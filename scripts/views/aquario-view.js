'use strict';

(function () {
    const { ids, fields } = window.AppConfig;
    const aquariumFields = fields.aquarium;
    const temperatureChart = document.getElementById(ids.charts.aquariumTemperature).getContext("2d");
    const phChart = document.getElementById(ids.charts.aquariumPh).getContext("2d");
    const tdsChart = document.getElementById(ids.charts.aquariumTds).getContext("2d");
    const turbidityChart = document.getElementById(ids.charts.aquariumTurbidity).getContext("2d");

    function createTable(data) {
        return ClimateData.createTables([
            aquariumFields.date,
            aquariumFields.time,
            aquariumFields.temperature,
            aquariumFields.ph,
            aquariumFields.tds,
            aquariumFields.turbidity,
        ], data);
    }

    function render({ data, selectedDate, createChart, colors, ui }) {
        const filteredData = ClimateData.filterDataByDays(data, 2, selectedDate);
        ClimateAnalytics.renderStats("aquario", filteredData, selectedDate);

        createChart({
            canvasCtx: temperatureChart,
            containerId: ids.chartContainers.aquariumTemperature,
            data: filteredData,
            key: aquariumFields.temperature,
            label: "Temperatura",
            color: colors.blue,
            yAxisTitle: "(°C)",
            yAxisSuffix: "°",
            comfortBand: AppConfig.aquariumComfortBand,
            emptyMessage: `Sem dados de temperatura do aquário em ${selectedDate.replace(/-/g, "/")}.`
        });
        createChart({
            canvasCtx: phChart,
            containerId: ids.chartContainers.aquariumPh,
            data: filteredData,
            key: aquariumFields.ph,
            label: "PH",
            color: colors.teal,
            emptyMessage: `Sem dados de PH em ${selectedDate.replace(/-/g, "/")}.`
        });
        createChart({
            canvasCtx: tdsChart,
            containerId: ids.chartContainers.aquariumTds,
            data: filteredData,
            key: aquariumFields.tds,
            label: "TDS",
            color: colors.amber,
            yAxisTitle: "ppm",
            yAxisSuffix: "ppm",
            emptyMessage: `Sem dados de TDS em ${selectedDate.replace(/-/g, "/")}.`
        });
        createChart({
            canvasCtx: turbidityChart,
            containerId: ids.chartContainers.aquariumTurbidity,
            data: filteredData,
            key: aquariumFields.turbidity,
            label: "Turbidez",
            color: colors.rose,
            yAxisTitle: "NTU",
            yAxisSuffix: "NTU",
            emptyMessage: `Sem dados de turbidez em ${selectedDate.replace(/-/g, "/")}.`
        });

        ui.renderTable(ids.tables.aquarium, createTable(filteredData), `Sem registros do aquário em ${selectedDate.replace(/-/g, "/")}.`);
    }

    window.AquarioView = { render };
})();
