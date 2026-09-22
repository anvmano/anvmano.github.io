'use strict';

(function () {
    const modulos = window.ClimatePdfReportModules = window.ClimatePdfReportModules || {};

    const { format: formatacao } = modulos;
    const { buildNoDataMessage: montarMensagemSemDados, clamp: limitar, formatValue: formatarValorRelatorio } = formatacao;

    async function coletarCardsGraficos(configuracaoAba, { normalizedRows: linhasNormalizadas = [], latestData: dadosMaisRecentes = {}, selectedDate: dataSelecionada, qualities: qualidades = {}, dadosClimaExterno = null } = {}) {
        const cards = [];
        if (configuracaoAba.tableType === "station") {
            cards.push(criarCardGraficoEstacao(
                "Temperatura por Ambiente",
                "°C",
                [
                    { label: "Sala", dataKey: "livingRoom", field: AppConfig.fields.livingRoom.temperature },
                    { label: "Quarto", dataKey: "room", field: AppConfig.fields.room.temperature },
                    { label: "Aquário", dataKey: "aquarium", field: AppConfig.fields.aquarium.temperature },
                ],
                dadosMaisRecentes,
                dataSelecionada
            ));
            cards.push(criarCardGraficoEstacao(
                "Umidade por Ambiente",
                "%",
                [
                    { label: "Sala", dataKey: "livingRoom", field: AppConfig.fields.livingRoom.humidity },
                    { label: "Quarto", dataKey: "room", field: AppConfig.fields.room.humidity },
                ],
                dadosMaisRecentes,
                dataSelecionada
            ));
            if (dadosClimaExterno) cards.push(criarCardGraficoChuva(dadosClimaExterno));
        }

        const metricaTemperatura = configuracaoAba.metrics.find(metrica => metrica.key === "temperature");
        const metricaSensacaoTermica = configuracaoAba.metrics.find(metrica => metrica.key === "feelsLike");
        const metricaUmidade = configuracaoAba.metrics.find(metrica => metrica.key === "humidity");

        if (metricaTemperatura && metricaSensacaoTermica) {
            cards.push(await criarCardGraficoMetrica(
                "Temperatura x Sensação Térmica",
                "°C",
                [metricaTemperatura, metricaSensacaoTermica],
                linhasNormalizadas,
                dataSelecionada,
                qualidades
            ));
        } else if (metricaTemperatura) {
            cards.push(await criarCardGraficoMetrica(metricaTemperatura.label, metricaTemperatura.unit, [metricaTemperatura], linhasNormalizadas, dataSelecionada, qualidades));
        }

        if (metricaUmidade) {
            cards.push(await criarCardGraficoMetrica(metricaUmidade.label, metricaUmidade.unit, [metricaUmidade], linhasNormalizadas, dataSelecionada, qualidades));
        }

        const metricasIndividuais = configuracaoAba.metrics.filter(metrica => (
            metrica.key !== "temperature" &&
            metrica.key !== "feelsLike" &&
            metrica.key !== "humidity"
        ));

        for (const metrica of metricasIndividuais) {
            cards.push(await criarCardGraficoMetrica(metrica.label, metrica.unit, [metrica], linhasNormalizadas, dataSelecionada, qualidades));
        }

        if (configuracaoAba.includeSolar) {
            const temposSolares = window.ClimateSolar?.getSolarEventsForSelectedDate?.(dadosMaisRecentes.solar || {}, dataSelecionada);
            cards.push({
                label: "Ciclo solar compacto",
                unit: "h",
                image: criarImagemSolarCompacta(temposSolares),
                compact: true,
                emptyMessage: dataSelecionada === ClimateData.dataAtual()
                    ? "Ciclo solar ainda não processado para hoje."
                    : montarMensagemSemDados("ciclo solar", dataSelecionada),
                stats: montarEstatisticasGraficoSolar(temposSolares),
            });
        }

        return cards;
    }

    function criarCardGraficoExistente(rotulo, unidade, idGrafico, instanciasGraficos, dataSelecionada) {
        const grafico = instanciasGraficos[idGrafico];
        return {
            label: rotulo,
            unit: unidade,
            image: capturarImagemGrafico(idGrafico, instanciasGraficos),
            emptyMessage: montarMensagemSemDados(rotulo, dataSelecionada),
            stats: montarEstatisticasGraficoExistente(grafico, unidade),
        };
    }

    async function criarCardGraficoMetrica(rotulo, unidade, metricas, linhasNormalizadas, dataSelecionada, qualidades = {}) {
        const seriesDados = metricas.map((metrica, indice) => ({
            metric: metrica,
            labels: linhasNormalizadas.map(linha => linha.time),
            values: linhasNormalizadas.map(linha => Number.isFinite(linha.numericValues?.[metrica.key]) ? linha.numericValues[metrica.key] : null),
            color: obterCorGraficoPdf(indice),
        }));
        const imagem = criarImagemGraficoMetrica(rotulo, unidade, seriesDados);
        return {
            label: rotulo,
            unit: unidade,
            image: imagem,
            emptyMessage: montarMensagemSemDados(rotulo, dataSelecionada),
            stats: seriesDados.flatMap(item => {
                const estatisticas = montarEstatisticasGrafico(item.metric.label, item.values, item.metric.unit);
                const qualidade = qualidades[item.metric.key];
                if (qualidade && qualidade.nivel !== "adequada") {
                    estatisticas.push(`${item.metric.label}: ${qualidade.rotulo} (${qualidade.leiturasValidas}/${qualidade.leiturasEsperadas})`);
                }
                return estatisticas;
            }),
        };
    }

    function criarImagemGraficoMetrica(titulo, unidade, seriesDados) {
        if (typeof Chart !== "function") return null;

        const seriesNormalizadas = normalizarSeries(seriesDados);
        if (!seriesNormalizadas.length) return null;

        const rotulos = seriesNormalizadas[0].labels;
        const canvas = document.createElement("canvas");
        canvas.width = 1200;
        canvas.height = 520;

        const seriesGraficos = seriesNormalizadas.flatMap(item => {
            const estatisticas = calcularEstatisticasSerie(item.values);
            const valoresNormalizados = rotulos.map((_, indice) => item.values[indice] ?? null);
            return [
                {
                    label: item.metric.label,
                    data: valoresNormalizados,
                    borderColor: item.color,
                    backgroundColor: item.color,
                    borderWidth: 4,
                    tension: 0.32,
                    pointRadius: valoresNormalizados.map((_, indice) => indice === estatisticas.minIndex || indice === estatisticas.maxIndex ? 6 : 0),
                    pointHoverRadius: 0,
                    fill: false,
                },
                {
                    label: `${item.metric.label} média`,
                    data: rotulos.map(() => estatisticas.avg),
                    borderColor: aplicarOpacidade(item.color, 0.45),
                    borderDash: [10, 8],
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                },
            ];
        });

        const faixaConforto = obterFaixaConfortoPdf(seriesNormalizadas.map(item => item.metric));
        const limitesY = calcularLimitesYPdf(seriesNormalizadas);
        const grafico = new Chart(canvas.getContext("2d"), {
            type: "line",
            data: { labels: rotulos, datasets: seriesGraficos },
            options: criarOpcoesGraficoPdf(titulo, unidade, seriesGraficos.length > 2, limitesY),
            plugins: [pluginFundoGraficoPdf(), pluginFaixaConfortoPdf()],
        });

        grafico.$pdfComfortBand = faixaConforto;
        grafico.update("none");
        const imagem = canvas.toDataURL("image/png", 1);
        grafico.destroy();
        return imagem;
    }

    function normalizarSeries(seriesDados) {
        const rotulos = [...new Set(seriesDados.flatMap(item => item.labels || []))].sort();
        if (!rotulos.length) return [];

        return seriesDados
            .map(item => {
                const valoresPorRotulo = new Map((item.labels || []).map((rotulo, indice) => [rotulo, item.values?.[indice] ?? null]));
                return {
                    ...item,
                    labels: rotulos,
                    values: rotulos.map(rotulo => {
                        const valor = valoresPorRotulo.get(rotulo);
                        return Number.isFinite(valor) ? valor : null;
                    }),
                };
            })
            .filter(item => item.values.some(Number.isFinite));
    }

    function criarCardGraficoEstacao(rotulo, unidade, definicoes, dadosMaisRecentes, dataSelecionada) {
        const seriesDados = definicoes.map((definicao, indice) => ({
            metric: { label: definicao.label, unit: unidade },
            ...extrairSeriePorHorario(dadosMaisRecentes?.[definicao.dataKey] || {}, dataSelecionada, definicao.field),
            color: obterCorGraficoPdf(indice),
        }));

        return {
            label: rotulo,
            unit: unidade,
            image: criarImagemGraficoMetrica(rotulo, unidade, seriesDados),
            emptyMessage: montarMensagemSemDados(rotulo, dataSelecionada),
            stats: seriesDados.flatMap(item => montarEstatisticasGrafico(item.metric.label, item.values, unidade)),
        };
    }

    function criarCardGraficoChuva(dadosClimaExterno) {
        const janela = window.ClimateChuva?.montarJanela?.(
            dadosClimaExterno?.previsaoCurtoPrazo || [],
            dadosClimaExterno?.atualizadoEm
        );
        const precipitacaoObservada = somarPorTipo(janela, "observado");
        const precipitacaoPrevista = somarPorTipo(janela, "previsao");
        const probabilidadesPrevistas = (janela?.probabilidade || []).filter((valor, indice) => (
            janela.tipos[indice] === "previsao" && Number.isFinite(valor)
        ));
        const maiorProbabilidade = probabilidadesPrevistas.length ? Math.max(...probabilidadesPrevistas) : null;

        return {
            label: "Chuva · 24h + previsão 12h",
            unit: "mm / %",
            image: criarImagemGraficoChuva(janela),
            wide: true,
            emptyMessage: "Sem dados horários de chuva para a localização consultada.",
            stats: [
                `Registrado 24h: ${precipitacaoObservada.toFixed(1)} mm`,
                `Previsto 12h: ${precipitacaoPrevista.toFixed(1)} mm`,
                `Maior chance futura: ${Number.isFinite(maiorProbabilidade) ? `${Math.round(maiorProbabilidade)}%` : "--"}`,
            ],
        };
    }

    function criarImagemGraficoChuva(janela) {
        if (!janela?.horarios?.length || typeof Chart !== "function" || !window.ClimateChuva) return null;

        const observada = janela.precipitacao.map((valor, indice) => janela.tipos[indice] === "observado" ? valor : null);
        const prevista = janela.precipitacao.map((valor, indice) => janela.tipos[indice] === "previsao" ? valor : null);
        const probabilidade = janela.probabilidade.map((valor, indice) => janela.tipos[indice] === "previsao" ? valor : null);
        const temDados = [...observada, ...prevista, ...probabilidade].some(Number.isFinite);
        if (!temDados) return null;

        const canvas = document.createElement("canvas");
        canvas.width = 1200;
        canvas.height = 520;
        const opcoes = window.ClimateChuva.obterOpcoes({ janela, cores: AppConfig.colors });
        opcoes.responsive = false;
        opcoes.animation = false;
        opcoes.maintainAspectRatio = false;
        opcoes.layout = { padding: { top: 24, right: 28, bottom: 12, left: 16 } };
        opcoes.plugins.title = {
            display: true,
            text: "Chuva · 24h + previsão 12h",
            color: "#f8fafc",
            font: { size: 26, weight: "700" },
            padding: { bottom: 18 },
        };
        opcoes.plugins.legend.labels.font = { size: 17, weight: "600" };
        opcoes.plugins.tooltip.enabled = false;
        opcoes.scales.x.ticks.font = { size: 17 };
        opcoes.scales.yMilimetros.ticks.font = { size: 17 };
        opcoes.scales.yProbabilidade.ticks.font = { size: 17 };

        const grafico = new Chart(canvas.getContext("2d"), {
            type: "bar",
            data: {
                labels: janela.horarios.map(formatarHoraChuvaPdf),
                datasets: [
                    {
                        label: "Precipitação registrada",
                        data: observada,
                        yAxisID: "yMilimetros",
                        backgroundColor: "rgba(56, 189, 248, 0.72)",
                        borderColor: "#38bdf8",
                        borderWidth: 1,
                        borderRadius: 3,
                        order: 2,
                    },
                    {
                        label: "Precipitação prevista",
                        data: prevista,
                        yAxisID: "yMilimetros",
                        backgroundColor: "rgba(125, 211, 252, 0.42)",
                        borderColor: "rgba(125, 211, 252, 0.68)",
                        borderWidth: 1,
                        borderRadius: 3,
                        order: 2,
                    },
                    {
                        type: "line",
                        label: "Chance de chuva",
                        data: probabilidade,
                        yAxisID: "yProbabilidade",
                        borderColor: "#a78bfa",
                        borderDash: [10, 7],
                        borderWidth: 3,
                        tension: 0.3,
                        pointRadius: 0,
                        spanGaps: false,
                        order: 1,
                    },
                ],
            },
            options: opcoes,
            plugins: [pluginFundoGraficoPdf(), pluginMarcadorAgoraChuvaPdf()],
        });
        grafico.$marcadorAgora = { indice: janela.indiceAgora };
        grafico.update("none");
        const imagem = canvas.toDataURL("image/png", 1);
        grafico.destroy();
        return imagem;
    }

    function pluginMarcadorAgoraChuvaPdf() {
        return {
            id: "pdfRainNowMarker",
            afterDraw(grafico) {
                const indice = grafico.$marcadorAgora?.indice;
                const escalaX = grafico.scales?.x;
                const area = grafico.chartArea;
                if (!Number.isInteger(indice) || indice < 0 || !escalaX || !area) return;
                const x = escalaX.getPixelForValue(indice);
                if (!Number.isFinite(x)) return;

                const contextoDesenho = grafico.ctx;
                contextoDesenho.save();
                contextoDesenho.strokeStyle = "rgba(226, 232, 240, 0.72)";
                contextoDesenho.lineWidth = 2;
                contextoDesenho.setLineDash([7, 6]);
                contextoDesenho.beginPath();
                contextoDesenho.moveTo(x, area.top);
                contextoDesenho.lineTo(x, area.bottom);
                contextoDesenho.stroke();
                contextoDesenho.restore();
            },
        };
    }

    function somarPorTipo(janela, tipo) {
        return (janela?.precipitacao || []).reduce((total, valor, indice) => (
            janela.tipos[indice] === tipo && Number.isFinite(valor) ? total + valor : total
        ), 0);
    }

    function formatarHoraChuvaPdf(valor) {
        const dados = new Date(valor);
        if (Number.isNaN(dados.getTime())) return "--";
        return `${String(dados.getHours()).padStart(2, "0")}:${String(dados.getMinutes()).padStart(2, "0")}`;
    }

    function extrairSeriePorHorario(dados, dataSelecionada, campo) {
        const dadosSelecionados = ClimateData.filterDataByDays(dados, 2, dataSelecionada);
        const valoresPorHorario = new Map();

        for (const dadosData of Object.values(dadosSelecionados)) {
            for (const [horarioFirebase, dadosHorario] of Object.entries(dadosData || {})) {
                const valores = Object.values(dadosHorario || {})
                    .map(item => ClimateData.normalizeMeasurementValue(campo, item?.[campo]))
                    .filter(Number.isFinite);
                if (!valores.length) continue;

                const [hora, minuto = "0"] = horarioFirebase.split("-");
                const horario = `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
                valoresPorHorario.set(horario, valores.reduce((soma, valor) => soma + valor, 0) / valores.length);
            }
        }

        const rotulos = [...valoresPorHorario.keys()].sort();
        return {
            labels: rotulos,
            values: rotulos.map(horario => valoresPorHorario.get(horario)),
        };
    }

    function capturarImagemPrimeiraMetrica(metricas, instanciasGraficos) {
        const metrica = metricas.find(item => item?.chart);
        return metrica ? capturarImagemGrafico(AppConfig.ids.charts[metrica.chart], instanciasGraficos) : null;
    }

    function criarOpcoesGraficoPdf(titulo, unidade, mostrarLegenda, limitesY = {}) {
        return {
            responsive: false,
            animation: false,
            maintainAspectRatio: false,
            layout: {
                padding: { top: 24, right: 28, bottom: 12, left: 16 },
            },
            plugins: {
                title: {
                    display: true,
                    text: titulo,
                    color: "#f8fafc",
                    font: { size: 26, weight: "700" },
                    padding: { bottom: 18 },
                },
                legend: {
                    display: mostrarLegenda,
                    labels: {
                        color: "#cbd5e1",
                        boxWidth: 22,
                        boxHeight: 10,
                        font: { size: 18, weight: "600" },
                        filter: item => !item.text.includes("média"),
                    },
                },
                tooltip: { enabled: false },
            },
            scales: {
                x: {
                    ticks: {
                        color: "#94a3b8",
                        maxRotation: 0,
                        minRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 8,
                        font: { size: 17 },
                    },
                    grid: { color: "rgba(99, 132, 200, 0.16)" },
                },
                y: {
                    suggestedMin: limitesY.suggestedMin,
                    suggestedMax: limitesY.suggestedMax,
                    title: {
                        display: Boolean(unidade),
                        text: unidade,
                        color: "#94a3b8",
                        font: { size: 17, weight: "700" },
                    },
                    ticks: {
                        color: "#94a3b8",
                        font: { size: 17 },
                    },
                    grid: { color: "rgba(99, 132, 200, 0.18)" },
                },
            },
        };
    }

    function pluginFundoGraficoPdf() {
        return {
            id: "pdfChartBackground",
            beforeDraw(grafico) {
                const { ctx: contextoDesenho, width: largura, height: altura } = grafico;
                contextoDesenho.save();
                contextoDesenho.fillStyle = "#111827";
                contextoDesenho.fillRect(0, 0, largura, altura);
                contextoDesenho.restore();
            },
        };
    }

    function pluginFaixaConfortoPdf() {
        return {
            id: "pdfComfortBand",
            beforeDatasetsDraw(grafico) {
                const faixa = grafico.$pdfComfortBand;
                const escalaY = grafico.scales.y;
                const areaDesenho = grafico.chartArea;
                if (!faixa || !escalaY || !areaDesenho) return;

                const minimoY = limitar(escalaY.getPixelForValue(faixa.min), areaDesenho.top, areaDesenho.bottom);
                const maximoY = limitar(escalaY.getPixelForValue(faixa.max), areaDesenho.top, areaDesenho.bottom);
                const topo = Math.min(minimoY, maximoY);
                const altura = Math.abs(maximoY - minimoY);
                const contextoDesenho = grafico.ctx;

                contextoDesenho.save();
                contextoDesenho.fillStyle = "rgba(52, 211, 153, 0.10)";
                contextoDesenho.fillRect(areaDesenho.left, topo, areaDesenho.right - areaDesenho.left, altura);
                contextoDesenho.strokeStyle = "rgba(52, 211, 153, 0.35)";
                contextoDesenho.setLineDash([8, 6]);
                contextoDesenho.beginPath();
                contextoDesenho.moveTo(areaDesenho.left, minimoY);
                contextoDesenho.lineTo(areaDesenho.right, minimoY);
                contextoDesenho.moveTo(areaDesenho.left, maximoY);
                contextoDesenho.lineTo(areaDesenho.right, maximoY);
                contextoDesenho.stroke();
                contextoDesenho.restore();
            },
        };
    }

    function obterFaixaConfortoPdf(metricas) {
        const metricaComFaixa = metricas.find(metrica => metrica.comfortBand);
        return metricaComFaixa?.comfortBand || null;
    }

    function calcularLimitesYPdf(seriesDados) {
        const valores = seriesDados
            .flatMap(item => item.values)
            .filter(Number.isFinite);

        if (!valores.length) return {};

        const minimo = Math.min(...valores);
        const maximo = Math.max(...valores);
        const intervalo = maximo - minimo;
        const espacamento = intervalo > 0 ? Math.max(intervalo * 0.12, 0.1) : 1;

        return {
            suggestedMin: minimo - espacamento,
            suggestedMax: maximo + espacamento,
        };
    }

    function criarImagemSolarCompacta(origem) {
        const horarios = origem?.$solarDayTimes || origem;
        if (!horarios || typeof Chart !== "function" || !window.ClimateSolar || !window.ClimateCharts) return null;

        const canvas = document.createElement("canvas");
        canvas.width = 1200;
        canvas.height = 520;

        const pontosLuzDiurna = [
            { x: 0, y: 0 },
            { x: horarios.dawn, y: 0.08, label: "Amanhecer", timeLabel: ClimateData.formatTime(horarios.dawn) },
            { x: horarios.sunrise, y: 0.52, label: "Nascer do sol", timeLabel: ClimateData.formatTime(horarios.sunrise) },
            { x: horarios.zenith, y: 1, label: "Zenite", timeLabel: ClimateData.formatTime(horarios.zenith) },
            { x: horarios.sunset, y: 0.52, label: "Pôr do sol", timeLabel: ClimateData.formatTime(horarios.sunset) },
            { x: horarios.dusk, y: 0.08, label: "Anoitecer", timeLabel: ClimateData.formatTime(horarios.dusk) },
            { x: 24, y: 0 },
        ];

        const pontosEventos = pontosLuzDiurna.slice(1, 6);
        const padroes = window.ClimateCharts.createDefaults(AppConfig.colors);
        const opcoes = window.ClimateSolar.getSolarTodayOptions({
            defaults: padroes,
            colors: AppConfig.colors,
            tickSize: 17,
            labelSize: 17,
        });
        opcoes.responsive = false;
        opcoes.animation = false;
        opcoes.layout = { padding: { top: 20, right: 24, bottom: 8, left: 10 } };
        opcoes.plugins.tooltip.enabled = false;

        const graficoSolarPdf = new Chart(canvas.getContext("2d"), {
            type: "line",
            data: {
                datasets: [
                    {
                        label: "Luz do dia",
                        data: pontosLuzDiurna,
                        borderColor: "#facc15",
                        backgroundColor: "rgba(250, 204, 21, 0.22)",
                        fill: true,
                        tension: 0.42,
                        pointRadius: 0,
                        pointHitRadius: 18,
                        pointHoverRadius: 0,
                        order: 2,
                    },
                    {
                        type: "scatter",
                        label: "Eventos solares",
                        data: pontosEventos,
                        borderColor: "#f8fafc",
                        backgroundColor: ["#fde68a", "#fb923c", "#facc15", "#f87171", "#818cf8"],
                        pointBorderColor: "#0b1120",
                        pointBorderWidth: 3,
                        pointRadius: 7,
                        pointHitRadius: 18,
                        pointHoverRadius: 7,
                        order: 1,
                    },
                ],
            },
            options: opcoes,
            plugins: [pluginFundoGraficoPdf(), window.ClimateSolar.solarDayBackgroundPlugin],
        });

        graficoSolarPdf.$solarDayTimes = horarios;
        graficoSolarPdf.update("none");
        const imagem = canvas.toDataURL("image/png", 1);
        graficoSolarPdf.destroy();
        return imagem;
    }

    function obterCorGraficoPdf(indice) {
        return ["#38bdf8", "#34d399", "#a78bfa", "#fb7185"][indice] || "#facc15";
    }

    function aplicarOpacidade(corHexadecimal, opacidade) {
        const valor = corHexadecimal.replace("#", "");
        const r = parseInt(valor.slice(0, 2), 16);
        const g = parseInt(valor.slice(2, 4), 16);
        const b = parseInt(valor.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacidade})`;
    }

    function obterRotulosGrafico(grafico) {
        return (grafico?.data?.labels || []).map(rotulo => String(rotulo));
    }

    function obterValoresGrafico(grafico) {
        const dados = grafico?.data?.datasets?.[0]?.data || [];
        return dados.map(pontoGrafico => {
            const valor = typeof pontoGrafico === "object" && pontoGrafico !== null ? pontoGrafico.y : pontoGrafico;
            if (valor === null || valor === undefined || (typeof valor === "string" && valor.trim() === "")) return null;
            const numero = Number(valor);
            return Number.isFinite(numero) ? numero : null;
        });
    }

    function calcularEstatisticasSerie(valores) {
        const numerico = valores
            .map((valor, indice) => ({ value: valor, index: indice }))
            .filter(item => Number.isFinite(item.value));

        if (!numerico.length) {
            return { min: null, max: null, avg: null, minIndex: -1, maxIndex: -1 };
        }

        const itemMinimo = numerico.reduce((menor, item) => item.value < menor.value ? item : menor, numerico[0]);
        const itemMaximo = numerico.reduce((maior, item) => item.value > maior.value ? item : maior, numerico[0]);
        const mediaCalculada = numerico.reduce((soma, item) => soma + item.value, 0) / numerico.length;
        return {
            min: itemMinimo.value,
            max: itemMaximo.value,
            avg: mediaCalculada,
            minIndex: itemMinimo.index,
            maxIndex: itemMaximo.index,
        };
    }

    function montarEstatisticasGrafico(rotulo, valores, unidade) {
        const estatisticas = calcularEstatisticasSerie(valores);
        if (!Number.isFinite(estatisticas.avg)) return [];

        return [
            `${rotulo}: mín ${formatarValorRelatorio(estatisticas.min, unidade)} · máx ${formatarValorRelatorio(estatisticas.max, unidade)} · média ${formatarValorRelatorio(estatisticas.avg, unidade)}`,
        ];
    }

    function montarEstatisticasGraficoSolar(origem) {
        const horarios = origem?.$solarDayTimes || origem;
        if (!horarios) return [];

        return [
            `Amanhecer ${ClimateData.formatTime(horarios.dawn)}`,
            `Nascer ${ClimateData.formatTime(horarios.sunrise)}`,
            `Zênite ${ClimateData.formatTime(horarios.zenith)}`,
            `Pôr ${ClimateData.formatTime(horarios.sunset)}`,
            `Anoitecer ${ClimateData.formatTime(horarios.dusk)}`,
        ];
    }

    function montarEstatisticasGraficoExistente(grafico, unidade) {
        const seriesGraficos = grafico?.data?.datasets || [];
        return seriesGraficos
            .filter(serieGrafico => serieGrafico?.label)
            .flatMap(serieGrafico => montarEstatisticasGrafico(serieGrafico.label, extrairValoresSerie(serieGrafico), unidade));
    }

    function extrairValoresSerie(serieGrafico) {
        return (serieGrafico?.data || []).map(pontoGrafico => {
            const valor = typeof pontoGrafico === "object" && pontoGrafico !== null ? pontoGrafico.y : pontoGrafico;
            if (valor === null || valor === undefined || (typeof valor === "string" && valor.trim() === "")) return null;
            const numero = Number(valor);
            return Number.isFinite(numero) ? numero : null;
        });
    }

    function capturarImagemGrafico(idGrafico, instanciasGraficos) {
        const grafico = instanciasGraficos[idGrafico];
        const canvas = grafico?.canvas;
        if (!canvas || typeof canvas.toDataURL !== "function") return null;

        try {
            return canvas.toDataURL("image/png", 1);
        } catch {
            return null;
        }
    }

    modulos.charts = {
        collectChartCards: coletarCardsGraficos,
        createMetricChartCard: criarCardGraficoMetrica,
        createMetricChartImage: criarImagemGraficoMetrica,
        normalizarSeries,
        createStationChartCard: criarCardGraficoEstacao,
        createRainChartCard: criarCardGraficoChuva,
        createRainChartImage: criarImagemGraficoChuva,
        extrairSeriePorHorario,
        captureFirstMetricImage: capturarImagemPrimeiraMetrica,
        createPdfChartOptions: criarOpcoesGraficoPdf,
        pdfChartBackgroundPlugin: pluginFundoGraficoPdf,
        pdfComfortBandPlugin: pluginFaixaConfortoPdf,
        getPdfComfortBand: obterFaixaConfortoPdf,
        calculatePdfYBounds: calcularLimitesYPdf,
        createSolarCompactImage: criarImagemSolarCompacta,
        getPdfChartColor: obterCorGraficoPdf,
        withAlpha: aplicarOpacidade,
        getChartLabels: obterRotulosGrafico,
        getChartValues: obterValoresGrafico,
        calculateSeriesStats: calcularEstatisticasSerie,
        buildChartStats: montarEstatisticasGrafico,
        buildSolarChartStats: montarEstatisticasGraficoSolar,
        createExistingChartCard: criarCardGraficoExistente,
        buildExistingChartStats: montarEstatisticasGraficoExistente,
        extractDatasetValues: extrairValoresSerie,
        captureChartImage: capturarImagemGrafico,
    };
})();
