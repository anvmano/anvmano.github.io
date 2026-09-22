'use strict';

(function () {
    const { ids } = window.AppConfig;
    const graficoHistoricoSolar = document.getElementById(ids.charts.sunHistory).getContext("2d");
    const graficoSolarDia = document.getElementById(ids.charts.solarToday).getContext("2d");

    function renderizar({ data: dados, selectedDate: dataSelecionada, chartInstances: instanciasGraficos, defaults: padroes, colors: cores, ui: interfaceUsuario, ensureChart: garantirGrafico }) {
        interfaceUsuario.clearChartMessage(ids.chartContainers.sunHistory);
        interfaceUsuario.clearChartMessage(ids.chartContainers.solarToday);
        atualizarChipDuracaoDia(null);

        if (!window.Chart) {
            interfaceUsuario.renderChartMessage(ids.chartContainers.sunHistory, "Carregando gráfico...", "loading");
            interfaceUsuario.renderChartMessage(ids.chartContainers.solarToday, "Carregando gráfico...", "loading");
            if (typeof garantirGrafico === "function") garantirGrafico();
            return;
        }

        const dadosHistoricos = ClimateData.filterDataByDays(dados, 365, dataSelecionada, false);
        criarGraficoNascerPorSol({ data: dadosHistoricos, selectedDate: dataSelecionada, chartInstances: instanciasGraficos, defaults: padroes, colors: cores, ui: interfaceUsuario });
        criarGraficoSolarDia({ data: dados, selectedDate: dataSelecionada, chartInstances: instanciasGraficos, defaults: padroes, colors: cores, ui: interfaceUsuario });
    }

    function criarGraficoNascerPorSol({ data: dados, selectedDate: dataSelecionada, chartInstances: instanciasGraficos, defaults: padroes, colors: cores, ui: interfaceUsuario }) {
        const id = graficoHistoricoSolar.canvas.id;
        const grafico = ClimateSolar.createSunriseSunsetChart({
            data: dados,
            ctx: graficoHistoricoSolar,
            existingChart: instanciasGraficos[id],
            defaults: padroes,
            colors: cores,
            onEmpty: () => interfaceUsuario.renderChartMessage(ids.chartContainers.sunHistory, `Sem dados de nascer e pôr do sol em ${dataSelecionada.replace(/-/g, "/")}.`)
        });
        if (grafico) instanciasGraficos[id] = grafico;
    }

    function criarGraficoSolarDia({ data: dados, selectedDate: dataSelecionada, chartInstances: instanciasGraficos, defaults: padroes, colors: cores, ui: interfaceUsuario }) {
        const id = graficoSolarDia.canvas.id;
        const grafico = ClimateSolar.createSolarTodayChart({
            data: dados,
            selectedDate: dataSelecionada,
            ctx: graficoSolarDia,
            existingChart: instanciasGraficos[id],
            defaults: padroes,
            colors: cores,
            onEmpty: () => interfaceUsuario.renderChartMessage(ids.chartContainers.solarToday, `Sem dados de ciclo solar em ${dataSelecionada.replace(/-/g, "/")}.`)
        });
        if (grafico) {
            instanciasGraficos[id] = grafico;
            atualizarChipDuracaoDia(grafico.$solarDayTimes);
        }
    }

    function atualizarChipDuracaoDia(eventos) {
        const chip = document.getElementById("solarTodayDuration");
        if (!chip) return;

        const duracao = ClimateSolar.formatarDuracaoDia(eventos);
        chip.hidden = !duracao;
        chip.textContent = duracao ? `Duração do dia: ${duracao}` : "";
    }

    window.SolarView = { render: renderizar };
})();
