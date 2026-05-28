'use strict';

(function () {
    const temperatureChart = document.getElementById("plotsTempSala").getContext("2d");
    const feelsLikeChart = document.getElementById("plotsSTSala").getContext("2d");
    const humidityChart = document.getElementById("plotsUmidadeSala").getContext("2d");
    const pressureChart = document.getElementById("plotsPressaoSala").getContext("2d");

    function createTable(data) {
        return ClimateData.createTables(["Data", "Hora", "CO", "CO2", "Aceton", "Alcohol", "NH4"], data);
    }

    function render({ data, selectedDate, createChart, colors, ui }) {
        const filteredData = ClimateData.filterDataByDays(data, 2, selectedDate);
        ClimateAnalytics.renderStats("sala", filteredData, selectedDate);

        createChart(temperatureChart, filteredData, "temperatura", "Temperatura", colors.blue, "(°C)", "°", false);
        createChart(feelsLikeChart, filteredData, "sensacaoTermica", "Sensação Térmica", colors.green, "(°C)", "°", false);
        createChart(humidityChart, filteredData, "umidade", "Umidade", colors.purple, null, "%", false);
        createChart(pressureChart, filteredData, "pressao", "Pressão (hPa)", colors.amber, null, "", false);

        ui.renderTable("dataSala", createTable(filteredData), `Sem registros da sala em ${selectedDate.replace(/-/g, "/")}.`);
    }

    window.SalaView = { render };
})();
