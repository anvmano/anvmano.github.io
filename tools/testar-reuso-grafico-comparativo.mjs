import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const instanciasCriadas = [];
const sincronizacao = [];
class ChartMock {
    constructor(contexto, configuracao) {
        this.canvas = contexto.canvas;
        this.data = configuracao.data;
        this.options = configuracao.options;
        this.config = configuracao;
        this.atualizacoes = [];
        this.destruicoes = 0;
        instanciasCriadas.push(this);
    }

    update(modo) { this.atualizacoes.push(modo); }
    destroy() { this.destruicoes++; }
}

const canvasTemperatura = { id: "comparativoTemperatura", width: 400, height: 200 };
const canvasUmidade = { id: "comparativoUmidade" };
let mensagensVazias = 0;
const contexto = {
    Chart: ChartMock,
    AppConfig: {
        ids: { charts: { globalTemperature: "temperatura", globalHumidity: "umidade", rain: "chuva" } },
        fields: {},
        colors: { text: "#fff" },
    },
    document: {
        getElementById: id => ({
            getContext: () => ({ canvas: id === "temperatura" ? canvasTemperatura : canvasUmidade, clearRect: () => {} }),
        }),
    },
    ClimateUI: { renderRollingPeriod: () => {} },
    ClimateChartSync: {
        registrar: (grafico, grupo) => sincronizacao.push(["registrar", grafico, grupo]),
        desregistrar: grafico => sincronizacao.push(["desregistrar", grafico]),
    },
    ClimateCharts: { mergeDeep: (_padroes, opcoes) => opcoes },
    ClimateData: {
        filterDataByRollingHours: dados => dados,
        parseFirebaseDate: data => {
            const [dia, mes, ano] = data.split("-").map(Number);
            return new Date(ano, mes - 1, dia);
        },
        normalizeMeasurementValue: (_campo, valor) => Number.isFinite(valor) ? valor : null,
    },
};
contexto.window = contexto;
const codigo = fs.readFileSync("scripts/views/estacao-view.js", "utf8")
    .replace("    window.EstacaoView = {", "    window.__renderizarGraficoComparativo = renderizarGraficoComparativo;\n    window.EstacaoView = {");
vm.runInNewContext(codigo, contexto);

const chartInstances = {};
const opcoes = {
    canvasCtx: contexto.document.getElementById("temperatura").getContext("2d"),
    containerId: "recipiente",
    chartInstances,
    defaults: {},
    ui: {
        clearChartMessage: () => {},
        renderChartMessage: () => { mensagensVazias++; },
    },
    titulo: "Temperatura",
    unidade: "°",
    eixoY: "(°C)",
    selectedDate: "22-10-2026",
    mensagemVazia: "Sem dados",
};
const serie = (nome, cor, valores) => ({
    nome, cor, campo: "temperatura",
    data: { "22-10-2026": Object.fromEntries(valores.map(([hora, valor]) => [hora, { a: { temperatura: valor } }])) },
});

contexto.__renderizarGraficoComparativo({
    ...opcoes,
    series: [serie("Sala", "#f00", [["10-00", 21]]), serie("Quarto", "#0f0", [["10-00", 23]])],
});
const primeiro = chartInstances.comparativoTemperatura;
assert.equal(instanciasCriadas.length, 1);
assert.equal(primeiro.config.type, "line");
assert.equal(primeiro.options.plugins.legend.display, true);

contexto.__renderizarGraficoComparativo({
    ...opcoes,
    series: [serie("Sala", "#f00", [["10-00", 21], ["10-05", 22]]), serie("Quarto", "#0f0", [["10-05", 24]])],
});
assert.equal(chartInstances.comparativoTemperatura, primeiro);
assert.equal(instanciasCriadas.length, 1, "Atualização não deve criar outro Chart.");
assert.equal(primeiro.destruicoes, 0, "Atualização não deve destruir Chart existente.");
assert.equal(JSON.stringify(primeiro.data.labels), JSON.stringify(["10:00", "10:05"]));
assert.equal(JSON.stringify(primeiro.data.datasets.map(serie => serie.data)), JSON.stringify([[21, 22], [null, 24]]));
assert.equal(JSON.stringify(primeiro.$chavesSincronizacao), JSON.stringify(["2026-10-22T10:00", "2026-10-22T10:05"]));
assert.equal(primeiro.$comparisonTitle, "Temperatura");
assert.equal(primeiro.options.plugins.tooltip.callbacks.label({ parsed: { y: 24 }, dataset: { label: "Quarto" } }), "Quarto: 24.00°");
assert.equal(primeiro.atualizacoes.at(-1), "none");
assert.equal(sincronizacao.at(-2)[0], "desregistrar");
assert.equal(sincronizacao.at(-1)[0], "registrar");

contexto.__renderizarGraficoComparativo({ ...opcoes, series: [serie("Sala", "#f00", [])] });
assert.equal(primeiro.destruicoes, 1);
assert.equal(chartInstances.comparativoTemperatura, undefined);
assert.equal(mensagensVazias, 1);

console.log("Reuso e estado vazio do gráfico comparativo verificados.");
