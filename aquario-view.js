'use strict';

(function () {
    const temperatureChart = document.getElementById("plotsTempAquario").getContext("2d");
    const phChart = document.getElementById("plotsPH").getContext("2d");
    const tdsChart = document.getElementById("plotsTDS").getContext("2d");
    const turbidityChart = document.getElementById("plotsTurbidez").getContext("2d");

    function createTable(data) {
        return ClimateData.createTables(["Data", "Hora", "temperaturaDS18B20", "PH", "TDS", "Turbidez"], data);
    }

    function render({ data, selectedDate, createChart, colors, ui }) {
        const filteredData = ClimateData.filterDataByDays(data, 2, selectedDate);
        ClimateAnalytics.renderStats("aquario", filteredData, selectedDate);

        createChart(temperatureChart, filteredData, "temperaturaDS18B20", "Temperatura", colors.blue, "(°C)", "°", false);
        createChart(phChart, filteredData, "PH", "PH", colors.teal, null, "", false);
        createChart(tdsChart, filteredData, "TDS", "TDS", colors.amber, null, "", false);
        createChart(turbidityChart, filteredData, "Turbidez", "Turbidez", colors.rose, null, "", false);

        ui.renderTable("dataAquario", createTable(filteredData), `Sem registros do aquário em ${selectedDate.replace(/-/g, "/")}.`);
    }

    window.AquarioView = { render };
})();
