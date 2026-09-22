'use strict';

(function () {
    const { ids, fields: campos } = window.AppConfig;
    const camposAquario = campos.aquarium;
    const graficoTemperatura = document.getElementById(ids.charts.aquariumTemperature).getContext("2d");
    const graficoPh = document.getElementById(ids.charts.aquariumPh).getContext("2d");
    const graficoTds = document.getElementById(ids.charts.aquariumTds).getContext("2d");
    const graficoTurbidez = document.getElementById(ids.charts.aquariumTurbidity).getContext("2d");

    function criarTabela(dados) {
        return ClimateData.createTables([
            camposAquario.date,
            camposAquario.time,
            camposAquario.temperature,
            camposAquario.ph,
            camposAquario.tds,
            camposAquario.turbidity,
        ], dados);
    }

    function renderizar({ data: dados, selectedDate: dataSelecionada, createChart: criarGrafico, colors: cores, ui: interfaceUsuario }) {
        const dadosFiltrados = ClimateData.filterDataByDays(dados, 2, dataSelecionada);
        const dadosGrafico = ClimateData.filterDataByRollingHours(dados, dataSelecionada, 24);
        ClimateAnalytics.renderStats("aquario", dadosFiltrados, dataSelecionada);

        criarGrafico({
            canvasCtx: graficoTemperatura,
            containerId: ids.chartContainers.aquariumTemperature,
            data: dadosGrafico,
            key: camposAquario.temperature,
            label: "Temperatura",
            color: cores.blue,
            yAxisTitle: "(°C)",
            yAxisSuffix: "°",
            comfortBand: AppConfig.aquariumComfortBand,
            grupoSincronizacao: "aquario",
            emptyMessage: `Sem dados de temperatura do aquário em ${dataSelecionada.replace(/-/g, "/")}.`
        });
        criarGrafico({
            canvasCtx: graficoPh,
            containerId: ids.chartContainers.aquariumPh,
            data: dadosGrafico,
            key: camposAquario.ph,
            label: "pH",
            color: cores.teal,
            grupoSincronizacao: "aquario",
            emptyMessage: `Sem dados de pH em ${dataSelecionada.replace(/-/g, "/")}.`
        });
        criarGrafico({
            canvasCtx: graficoTds,
            containerId: ids.chartContainers.aquariumTds,
            data: dadosGrafico,
            key: camposAquario.tds,
            label: "TDS",
            color: cores.amber,
            yAxisTitle: "ppm",
            yAxisSuffix: "ppm",
            grupoSincronizacao: "aquario",
            emptyMessage: `Sem dados de TDS em ${dataSelecionada.replace(/-/g, "/")}.`
        });
        criarGrafico({
            canvasCtx: graficoTurbidez,
            containerId: ids.chartContainers.aquariumTurbidity,
            data: dadosGrafico,
            key: camposAquario.turbidity,
            label: "Turbidez",
            color: cores.rose,
            yAxisTitle: "NTU",
            yAxisSuffix: "NTU",
            grupoSincronizacao: "aquario",
            emptyMessage: `Sem dados de turbidez em ${dataSelecionada.replace(/-/g, "/")}.`
        });

        interfaceUsuario.renderTable(ids.tables.aquarium, criarTabela(dadosFiltrados), `Sem registros do aquário em ${dataSelecionada.replace(/-/g, "/")}.`);
    }

    window.AquarioView = { render: renderizar };
})();
