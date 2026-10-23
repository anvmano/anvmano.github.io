import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const instancias = [];
const chamadasSync = [];
class ChartMock {
    constructor(contexto, configuracao) {
        this.canvas = contexto.canvas;
        this.data = configuracao.data;
        this.options = configuracao.options;
        this.atualizacoes = [];
        this.destruicoes = 0;
        instancias.push(this);
    }

    update(modo) { this.atualizacoes.push(modo); }
    destroy() { this.destruicoes++; }
}

const contexto = {
    Chart: ChartMock,
    ClimateData: {
        extractData: (dados, chaves) => ({ hours: dados.horas, [chaves[0]]: dados.valores }),
        formatHoursArray: horas => horas.map(hora => `${hora}h`),
    },
    ClimateChartSync: {
        registrar: (grafico, grupo) => chamadasSync.push(["registrar", grafico, grupo]),
        desregistrar: grafico => chamadasSync.push(["desregistrar", grafico]),
    },
};
contexto.window = contexto;
vm.runInNewContext(fs.readFileSync("scripts/charts/chart-utils.js", "utf8"), contexto);

const canvas = { width: 400, height: 200 };
const canvasCtx = {
    canvas,
    clearRect: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
};
const opcoes = {
    canvasCtx,
    key: "temperatura",
    label: "Temperatura",
    color: "#f00",
    yAxisTitle: "Temperatura",
    yAxisSuffix: "°",
    defaults: { plugins: {}, scales: { y: {} } },
    colors: { text: "#fff" },
    grupoSincronizacao: "estacao",
};

const primeiro = contexto.ClimateCharts.createLineChart({
    ...opcoes,
    data: { horas: ["10:00"], valores: [21] },
});
assert.equal(instancias.length, 1);
assert.equal(primeiro.$comfortBand.min, 20);
assert.equal(chamadasSync.at(-1)[0], "registrar");

const atualizado = contexto.ClimateCharts.createLineChart({
    ...opcoes,
    existingChart: primeiro,
    data: { horas: ["10:00", "10:05"], valores: [21, 27] },
});
assert.equal(atualizado, primeiro);
assert.equal(instancias.length, 1, "A atualização não deve criar outro Chart.");
assert.equal(primeiro.destruicoes, 0, "A atualização não deve destruir o Chart existente.");
assert.equal(JSON.stringify(primeiro.data.labels), JSON.stringify(["10:00h", "10:05h"]));
assert.equal(JSON.stringify(primeiro.data.datasets[0].data), JSON.stringify([21, 27]));
assert.ok(primeiro.options.scales.y.max > 27);
assert.equal(primeiro.options.plugins.tooltip.callbacks.label({ parsed: { y: 27 }, dataset: {} }), "Temperatura: 27.00°");
assert.equal(primeiro.atualizacoes.at(-1), "none");
assert.equal(chamadasSync.at(-2)[0], "desregistrar");
assert.equal(chamadasSync.at(-1)[0], "registrar");

const vazio = contexto.ClimateCharts.createLineChart({
    ...opcoes,
    existingChart: primeiro,
    data: { horas: ["10:00"], valores: [null] },
});
assert.equal(vazio, null);
assert.equal(primeiro.destruicoes, 1);
assert.equal(chamadasSync.at(-1)[0], "desregistrar");

console.log("Reuso e estado vazio do gráfico de linha verificados.");
