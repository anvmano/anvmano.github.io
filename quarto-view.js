'use strict';

(function () {
    const temperatureChart = document.getElementById("plotsTemp").getContext("2d");
    const feelsLikeChart = document.getElementById("plotsST").getContext("2d");
    const humidityChart = document.getElementById("plotsUmidade").getContext("2d");

    function createTable(data) {
        return ClimateData.createTables(["Data", "Hora", "Temperatura", "Sensacao termica", "Umidade"], data);
    }

    function render({ data, selectedDate, createChart, colors, ui }) {
        const filteredData = ClimateData.filterDataByDays(data, 2, selectedDate);
        ClimateAnalytics.renderStats("quarto", filteredData, selectedDate);
        ClimateAnalytics.renderAdvancedClimateViews(data, selectedDate);

        createChart(temperatureChart, filteredData, "Temperatura", "Temperatura", colors.blue, "(°C)", "°", false);
        createChart(feelsLikeChart, filteredData, "Sensacao termica", "Sensação Térmica", colors.green, "(°C)", "°", false);
        createChart(humidityChart, filteredData, "Umidade", "Umidade", colors.purple, null, "%", false);

        ui.renderTable("data", createTable(filteredData), `Sem registros de temperatura em ${selectedDate.replace(/-/g, "/")}.`);
    }

    window.QuartoView = { render };
})();
