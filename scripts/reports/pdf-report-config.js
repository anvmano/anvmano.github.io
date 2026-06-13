'use strict';

(function () {
    const modules = window.ClimatePdfReportModules = window.ClimatePdfReportModules || {};

    const TAB_CONFIG = {
        Tab1: {
            label: "Sala",
            dataKey: "livingRoom",
            tableType: "livingRoom",
            metrics: [
                { key: "temperature", label: "Temperatura", unit: "°C", chart: "livingRoomTemperature", comfortBand: AppConfig.comfortBand },
                { key: "feelsLike", label: "Sensação térmica", unit: "°C", chart: "livingRoomFeelsLike", comfortBand: AppConfig.comfortBand },
                { key: "humidity", label: "Umidade", unit: "%", chart: "livingRoomHumidity", comfortBand: AppConfig.humidityComfortBand },
                { key: "pressure", label: "Pressão", unit: "hPa", chart: "livingRoomPressure" },
            ],
            tableMetrics: [
                { key: "co", label: "CO", unit: "ppm" },
                { key: "co2", label: "CO2", unit: "ppm" },
                { key: "acetone", label: "Acetona", unit: "ppm" },
                { key: "alcohol", label: "Álcool", unit: "ppm" },
                { key: "nh4", label: "Amônia", unit: "ppm" },
                { key: "toluene", label: "Tolueno", unit: "ppm" },
            ],
            includeSolar: true,
        },
        Tab2: {
            label: "Quarto",
            dataKey: "room",
            tableType: "room",
            metrics: [
                { key: "temperature", label: "Temperatura", unit: "°C", chart: "roomTemperature", comfortBand: AppConfig.comfortBand },
                { key: "feelsLike", label: "Sensação térmica", unit: "°C", chart: "roomFeelsLike", comfortBand: AppConfig.comfortBand },
                { key: "humidity", label: "Umidade", unit: "%", chart: "roomHumidity", comfortBand: AppConfig.humidityComfortBand },
            ],
            solarCharts: [
                { label: "Ciclo solar", unit: "h", chart: "solarToday" },
            ],
            includeSolar: true,
        },
        Tab3: {
            label: "Aquário",
            dataKey: "aquarium",
            tableType: "aquarium",
            metrics: [
                { key: "temperature", label: "Temperatura", unit: "°C", chart: "aquariumTemperature", comfortBand: AppConfig.aquariumComfortBand },
                { key: "ph", label: "pH", unit: "", chart: "aquariumPh" },
                { key: "tds", label: "TDS", unit: "ppm", chart: "aquariumTds" },
                { key: "turbidity", label: "Turbidez", unit: "NTU", chart: "aquariumTurbidity" },
            ],
            includeSolar: false,
        },
    };

    modules.config = {
        TAB_CONFIG,
    };
})();
