'use strict';

(function () {
    const { ids, fields: campos, humidityComfortBand: faixaConfortoUmidade } = window.AppConfig;
    const camposQuarto = campos.room;
    const graficoTemperatura = document.getElementById(ids.charts.roomTemperature).getContext("2d");
    const graficoSensacaoTermica = document.getElementById(ids.charts.roomFeelsLike).getContext("2d");
    const graficoUmidade = document.getElementById(ids.charts.roomHumidity).getContext("2d");

    function criarTabela(dados) {
        return ClimateData.createTables([
            camposQuarto.date,
            camposQuarto.time,
            camposQuarto.temperature,
            camposQuarto.feelsLike,
            camposQuarto.humidity,
        ], dados);
    }

    function renderizar({ data: dados, selectedDate: dataSelecionada, createChart: criarGrafico, colors: cores, ui: interfaceUsuario }) {
        const dadosFiltrados = ClimateData.filterDataByDays(dados, 2, dataSelecionada);
        const dadosGrafico = ClimateData.filterDataByRollingHours(dados, dataSelecionada, 24);
        ClimateAnalytics.renderStats("quarto", dadosFiltrados, dataSelecionada);
        ClimateAnalytics.renderAdvancedClimateViews(dados, dataSelecionada, {
            metricKey: camposQuarto.temperature,
            containers: ids.advancedViews.room,
        });

        criarGrafico({
            canvasCtx: graficoTemperatura,
            containerId: ids.chartContainers.roomTemperature,
            data: dadosGrafico,
            key: camposQuarto.temperature,
            label: "Temperatura",
            color: cores.blue,
            yAxisTitle: "(°C)",
            yAxisSuffix: "°",
            grupoSincronizacao: "quarto",
            emptyMessage: `Sem dados de temperatura em ${dataSelecionada.replace(/-/g, "/")}.`
        });
        criarGrafico({
            canvasCtx: graficoSensacaoTermica,
            containerId: ids.chartContainers.roomFeelsLike,
            data: dadosGrafico,
            key: camposQuarto.feelsLike,
            label: "Sensação Térmica",
            color: cores.green,
            yAxisTitle: "(°C)",
            yAxisSuffix: "°",
            grupoSincronizacao: "quarto",
            emptyMessage: `Sem dados de sensação térmica em ${dataSelecionada.replace(/-/g, "/")}.`
        });
        criarGrafico({
            canvasCtx: graficoUmidade,
            containerId: ids.chartContainers.roomHumidity,
            data: dadosGrafico,
            key: camposQuarto.humidity,
            label: "Umidade",
            color: cores.purple,
            yAxisTitle: "%",
            yAxisSuffix: "%",
            comfortBand: faixaConfortoUmidade,
            grupoSincronizacao: "quarto",
            emptyMessage: `Sem dados de umidade em ${dataSelecionada.replace(/-/g, "/")}.`
        });

        interfaceUsuario.renderTable(ids.tables.room, criarTabela(dadosFiltrados), `Sem registros de temperatura em ${dataSelecionada.replace(/-/g, "/")}.`);
    }

    window.QuartoView = { render: renderizar };
})();
