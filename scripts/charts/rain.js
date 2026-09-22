'use strict';

(function () {
    const HORAS_OBSERVADAS = 24;
    const HORAS_PREVISTAS = 12;

    const pluginMarcadorAgora = {
        id: "marcadorAgoraChuva",
        afterDraw(grafico) {
            const indice = grafico.$indiceAgora ?? grafico.$marcadorAgora?.indice;
            const escalaX = grafico.scales?.x;
            const area = grafico.chartArea;
            if (!Number.isInteger(indice) || indice < 0 || !escalaX || !area) return;

            const x = escalaX.getPixelForValue(indice);
            if (!Number.isFinite(x) || x < area.left || x > area.right) return;

            const contexto = grafico.ctx;
            contexto.save();
            contexto.strokeStyle = "rgba(148, 163, 184, 0.65)";
            contexto.lineWidth = 1;
            contexto.setLineDash([4, 4]);
            contexto.beginPath();
            contexto.moveTo(x, area.top);
            contexto.lineTo(x, area.bottom);
            contexto.stroke();
            contexto.restore();
        },
    };

    function montarJanela(previsao = [], atualizadoEm = new Date(), horasObservadas = HORAS_OBSERVADAS, horasPrevistas = HORAS_PREVISTAS) {
        const agora = dataValida(atualizadoEm) || new Date();
        const inicio = new Date(agora.getTime() - horasObservadas * 60 * 60 * 1000);
        const inicioPrevisao = new Date(agora);
        inicioPrevisao.setMinutes(0, 0, 0);
        inicioPrevisao.setHours(inicioPrevisao.getHours() + 1);
        const fimPrevisao = new Date(inicioPrevisao.getTime() + horasPrevistas * 60 * 60 * 1000);
        const resultado = {
            horarios: [],
            tipos: [],
            precipitacao: [],
            probabilidade: [],
            indiceAgora: -1,
        };

        previsao.forEach(item => {
            const horario = dataValida(item?.horario);
            if (!horario) return;
            const observado = horario >= inicio && horario <= agora;
            const previsto = horario >= inicioPrevisao && horario < fimPrevisao;
            if (!observado && !previsto) return;

            resultado.horarios.push(item.horario);
            resultado.tipos.push(observado ? "observado" : "previsao");
            resultado.precipitacao.push(numeroOuNulo(item.precipitacao));
            resultado.probabilidade.push(numeroOuNulo(item.probabilidadeChuva));
            if (observado) resultado.indiceAgora = resultado.horarios.length - 1;
        });

        return resultado;
    }

    function analisarAgora(climaAtual = {}) {
        const precipitacao = numeroOuNulo(climaAtual.precipitacao);
        const chuva = numeroOuNulo(climaAtual.chuva);
        const codigoTempo = numeroOuNulo(climaAtual.codigoTempo);
        const codigoChuva = codigoTempo !== null && (
            (codigoTempo >= 51 && codigoTempo <= 67) ||
            (codigoTempo >= 80 && codigoTempo <= 82) ||
            (codigoTempo >= 95 && codigoTempo <= 99)
        );
        const temDados = precipitacao !== null || chuva !== null || codigoTempo !== null;
        const chovendo = (precipitacao ?? 0) > 0 || (chuva ?? 0) > 0 || codigoChuva;

        return {
            disponivel: temDados,
            chovendo,
            rotulo: !temDados ? "Condição atual indisponível" : chovendo ? "Chovendo agora" : "Sem chuva agora",
            precipitacao,
        };
    }

    function criarGrafico({ canvas, janela, graficoExistente, cores, grupoSincronizacao = null }) {
        if (graficoExistente) {
            window.ClimateChartSync?.desregistrar(graficoExistente);
            graficoExistente.destroy();
        }
        if (!canvas || !window.Chart || !janela?.horarios?.length) return null;

        const observada = janela.precipitacao.map((valor, indice) => janela.tipos[indice] === "observado" ? valor : null);
        const prevista = janela.precipitacao.map((valor, indice) => janela.tipos[indice] === "previsao" ? valor : null);
        const probabilidade = janela.probabilidade.map((valor, indice) => janela.tipos[indice] === "previsao" ? valor : null);
        const temDados = [...observada, ...prevista, ...probabilidade].some(valor => numeroOuNulo(valor) !== null);
        if (!temDados) return null;

        const corChuva = cores?.blue || "#38bdf8";
        const corPrevisao = "rgba(125, 211, 252, 0.48)";
        const corProbabilidade = cores?.purple || "#a78bfa";
        const grafico = new Chart(canvas.getContext("2d"), {
            type: "bar",
            data: {
                labels: janela.horarios.map(formatarHora),
                datasets: [
                    {
                        label: "Precipitação observada",
                        data: observada,
                        yAxisID: "yMilimetros",
                        backgroundColor: `${corChuva}aa`,
                        borderColor: corChuva,
                        borderWidth: 1,
                        borderRadius: 3,
                        tipoDado: "observado",
                        order: 2,
                    },
                    {
                        label: "Precipitação prevista",
                        data: prevista,
                        yAxisID: "yMilimetros",
                        backgroundColor: corPrevisao,
                        borderColor: corPrevisao,
                        borderWidth: 1,
                        borderRadius: 3,
                        tipoDado: "previsao",
                        order: 2,
                    },
                    {
                        type: "line",
                        label: "Chance de chuva",
                        data: probabilidade,
                        yAxisID: "yProbabilidade",
                        borderColor: corProbabilidade,
                        backgroundColor: "transparent",
                        borderDash: [6, 4],
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius: 0,
                        pointHitRadius: 18,
                        spanGaps: false,
                        tipoDado: "previsao",
                        order: 1,
                    },
                ],
            },
            options: obterOpcoes({ janela, cores }),
            plugins: [pluginMarcadorAgora],
        });

        grafico.$indiceAgora = janela.indiceAgora;
        grafico.$marcadorAgora = { indice: janela.indiceAgora };
        grafico.$zoomPlugins = [pluginMarcadorAgora];
        if (grupoSincronizacao) window.ClimateChartSync?.registrar(grafico, grupoSincronizacao);
        grafico.update("none");
        return grafico;
    }

    function obterOpcoes({ janela = null, cores = window.AppConfig?.colors || {} } = {}) {
        const limiteTicks = window.matchMedia?.("(max-width: 600px)")?.matches ? 7 : 13;
        const padroes = window.ClimateCharts.createDefaults(cores);
        const opcoes = window.ClimateCharts.mergeDeep(padroes, {
            interaction: { mode: "index", intersect: false, axis: "x" },
            plugins: {
                legend: {
                    display: true,
                    labels: { color: cores.text, boxWidth: 12, padding: 12 },
                },
                tooltip: {
                    mode: "index",
                    intersect: false,
                    filter: contexto => numeroOuNulo(contexto.raw) !== null,
                    callbacks: {
                        title: itens => {
                            const indice = itens[0]?.dataIndex;
                            const horario = janela?.horarios?.[indice];
                            return horario ? formatarDataHora(horario) : itens[0]?.label || "--";
                        },
                        label: contexto => contexto.dataset.yAxisID === "yProbabilidade"
                            ? `${contexto.dataset.label}: ${Number(contexto.parsed.y).toFixed(0)}%`
                            : `${contexto.dataset.label}: ${Number(contexto.parsed.y).toFixed(1)} mm`,
                    },
                },
            },
            scales: {
                x: { stacked: true, ticks: { maxTicksLimit: limiteTicks } },
                yMilimetros: {
                    type: "linear",
                    position: "left",
                    beginAtZero: true,
                    title: { display: true, text: "mm", color: cores.text },
                    ticks: { color: cores.text, callback: valor => `${valor} mm` },
                    grid: { color: cores.grid },
                },
                yProbabilidade: {
                    type: "linear",
                    position: "right",
                    min: 0,
                    max: 100,
                    title: { display: true, text: "%", color: cores.text },
                    ticks: { color: cores.text, callback: valor => `${valor}%` },
                    grid: { drawOnChartArea: false },
                },
            },
        });
        delete opcoes.scales.y;
        return opcoes;
    }

    function dataValida(valor) {
        const dados = valor instanceof Date ? valor : new Date(valor);
        return Number.isNaN(dados.getTime()) ? null : dados;
    }

    function numeroOuNulo(valor) {
        if (valor === null || valor === undefined || valor === "") return null;
        const numero = Number(valor);
        return Number.isFinite(numero) ? numero : null;
    }

    function formatarHora(valor) {
        const dados = dataValida(valor);
        if (!dados) return "--";
        return `${String(dados.getHours()).padStart(2, "0")}:${String(dados.getMinutes()).padStart(2, "0")}`;
    }

    function formatarDataHora(valor) {
        const dados = dataValida(valor);
        if (!dados) return "--";
        return `${String(dados.getDate()).padStart(2, "0")}/${String(dados.getMonth() + 1).padStart(2, "0")} ${formatarHora(dados)}`;
    }

    window.ClimateChuva = {
        montarJanela,
        analisarAgora,
        criarGrafico,
        obterOpcoes,
    };
})();
