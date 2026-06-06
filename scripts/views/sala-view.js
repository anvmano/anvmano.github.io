'use strict';

(function () {
    const { ids, fields, humidityComfortBand } = window.AppConfig;
    const livingRoomFields = fields.livingRoom;
    const temperatureChart = document.getElementById(ids.charts.livingRoomTemperature).getContext("2d");
    const feelsLikeChart = document.getElementById(ids.charts.livingRoomFeelsLike).getContext("2d");
    const humidityChart = document.getElementById(ids.charts.livingRoomHumidity).getContext("2d");
    const pressureChart = document.getElementById(ids.charts.livingRoomPressure).getContext("2d");

    function createTable(data) {
        return ClimateData.createTables([
            livingRoomFields.date,
            livingRoomFields.time,
            livingRoomFields.co,
            livingRoomFields.co2,
            livingRoomFields.acetone,
            livingRoomFields.alcohol,
            livingRoomFields.nh4,
            livingRoomFields.toluene,
        ], data);
    }

    function render({ data, selectedDate, createChart, colors, ui }) {
        const filteredData = ClimateData.filterDataByDays(data, 2, selectedDate);
        ClimateAnalytics.renderStats("sala", filteredData, selectedDate);
        ClimateAnalytics.renderAdvancedClimateViews(data, selectedDate, {
            metricKey: livingRoomFields.temperature,
            containers: ids.advancedViews.livingRoom,
        });

        createChart({
            canvasCtx: temperatureChart,
            containerId: ids.chartContainers.livingRoomTemperature,
            data: filteredData,
            key: livingRoomFields.temperature,
            label: "Temperatura",
            color: colors.blue,
            yAxisTitle: "(°C)",
            yAxisSuffix: "°",
            emptyMessage: `Sem dados de temperatura da sala em ${selectedDate.replace(/-/g, "/")}.`
        });
        createChart({
            canvasCtx: feelsLikeChart,
            containerId: ids.chartContainers.livingRoomFeelsLike,
            data: filteredData,
            key: livingRoomFields.feelsLike,
            label: "Sensação Térmica",
            color: colors.green,
            yAxisTitle: "(°C)",
            yAxisSuffix: "°",
            emptyMessage: `Sem dados de sensação térmica da sala em ${selectedDate.replace(/-/g, "/")}.`
        });
        createChart({
            canvasCtx: humidityChart,
            containerId: ids.chartContainers.livingRoomHumidity,
            data: filteredData,
            key: livingRoomFields.humidity,
            label: "Umidade",
            color: colors.purple,
            yAxisTitle: "%",
            yAxisSuffix: "%",
            comfortBand: humidityComfortBand,
            emptyMessage: `Sem dados de umidade da sala em ${selectedDate.replace(/-/g, "/")}.`
        });
        createChart({
            canvasCtx: pressureChart,
            containerId: ids.chartContainers.livingRoomPressure,
            data: filteredData,
            key: livingRoomFields.pressure,
            label: "Pressão (hPa)",
            color: colors.amber,
            yAxisTitle: "hPa",
            yAxisSuffix: "hPa",
            emptyMessage: `Sem dados de pressão em ${selectedDate.replace(/-/g, "/")}.`
        });

        ui.renderTable(ids.tables.livingRoom, createTable(filteredData), `Sem registros da sala em ${selectedDate.replace(/-/g, "/")}.`);
    }

    window.SalaView = { render };
})();
