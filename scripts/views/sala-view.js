'use strict';

(function () {
    const { ids, fields: campos, humidityComfortBand: faixaConfortoUmidade } = window.AppConfig;
    const camposSala = campos.livingRoom;
    const graficoTemperatura = document.getElementById(ids.charts.livingRoomTemperature).getContext("2d");
    const graficoSensacaoTermica = document.getElementById(ids.charts.livingRoomFeelsLike).getContext("2d");
    const graficoUmidade = document.getElementById(ids.charts.livingRoomHumidity).getContext("2d");
    const graficoPressao = document.getElementById(ids.charts.livingRoomPressure).getContext("2d");

    function criarTabela(dados) {
        return ClimateData.createTables([
            camposSala.date,
            camposSala.time,
            camposSala.co,
            camposSala.co2,
            camposSala.acetone,
            camposSala.alcohol,
            camposSala.nh4,
            camposSala.toluene,
        ], dados);
    }

    function renderizar({ data: dados, selectedDate: dataSelecionada, createChart: criarGrafico, colors: cores, ui: interfaceUsuario }) {
        const dadosFiltrados = ClimateData.filterDataByDays(dados, 2, dataSelecionada);
        const dadosGrafico = ClimateData.filterDataByRollingHours(dados, dataSelecionada, 24);
        ClimateAnalytics.renderStats("sala", dadosFiltrados, dataSelecionada);
        ClimateAnalytics.renderAdvancedClimateViews(dados, dataSelecionada, {
            metricKey: camposSala.temperature,
            containers: ids.advancedViews.livingRoom,
        });

        criarGrafico({
            canvasCtx: graficoTemperatura,
            containerId: ids.chartContainers.livingRoomTemperature,
            data: dadosGrafico,
            key: camposSala.temperature,
            label: "Temperatura",
            color: cores.blue,
            yAxisTitle: "(°C)",
            yAxisSuffix: "°",
            grupoSincronizacao: "sala",
            emptyMessage: `Sem dados de temperatura da sala em ${dataSelecionada.replace(/-/g, "/")}.`
        });
        criarGrafico({
            canvasCtx: graficoSensacaoTermica,
            containerId: ids.chartContainers.livingRoomFeelsLike,
            data: dadosGrafico,
            key: camposSala.feelsLike,
            label: "Sensação Térmica",
            color: cores.green,
            yAxisTitle: "(°C)",
            yAxisSuffix: "°",
            grupoSincronizacao: "sala",
            emptyMessage: `Sem dados de sensação térmica da sala em ${dataSelecionada.replace(/-/g, "/")}.`
        });
        criarGrafico({
            canvasCtx: graficoUmidade,
            containerId: ids.chartContainers.livingRoomHumidity,
            data: dadosGrafico,
            key: camposSala.humidity,
            label: "Umidade",
            color: cores.purple,
            yAxisTitle: "%",
            yAxisSuffix: "%",
            comfortBand: faixaConfortoUmidade,
            grupoSincronizacao: "sala",
            emptyMessage: `Sem dados de umidade da sala em ${dataSelecionada.replace(/-/g, "/")}.`
        });
        criarGrafico({
            canvasCtx: graficoPressao,
            containerId: ids.chartContainers.livingRoomPressure,
            data: dadosGrafico,
            key: camposSala.pressure,
            label: "Pressão (hPa)",
            color: cores.amber,
            yAxisTitle: "hPa",
            yAxisSuffix: "hPa",
            grupoSincronizacao: "sala",
            emptyMessage: `Sem dados de pressão em ${dataSelecionada.replace(/-/g, "/")}.`
        });

        interfaceUsuario.renderTable(ids.tables.livingRoom, criarTabela(dadosFiltrados), `Sem registros da sala em ${dataSelecionada.replace(/-/g, "/")}.`);
    }

    window.SalaView = { render: renderizar };
})();
