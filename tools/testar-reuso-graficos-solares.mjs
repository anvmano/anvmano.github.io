import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const instancias = [];
class ChartMock {
    constructor(ctx, configuracao) {
        this.canvas = ctx.canvas;
        this.data = configuracao.data;
        this.options = configuracao.options;
        this.config = configuracao;
        this.atualizacoes = [];
        this.destruicoes = 0;
        instancias.push(this);
    }

    update(modo) { this.atualizacoes.push(modo); }
    destroy() { this.destruicoes++; this.canvas = null; }
}
ChartMock.Tooltip = { positioners: {} };

const contexto = {
    Chart: ChartMock,
    ClimateData: {
        parseFirebaseDate: texto => {
            const [dia, mes, ano] = texto.split("-").map(Number);
            return new Date(ano, mes - 1, dia);
        },
        secondsToHours: segundos => segundos / 3600,
        mapRange: (valor, inicio, fim, saidaInicio, saidaFim) => saidaInicio + (valor - inicio) * (saidaFim - saidaInicio) / (fim - inicio),
        formatTime: valor => `${Math.floor(valor)}:${String(Math.round((valor % 1) * 60)).padStart(2, "0")}`,
    },
    matchMedia: () => ({ matches: false }),
};
contexto.window = contexto;
vm.runInNewContext(fs.readFileSync("scripts/charts/solar.js", "utf8"), contexto);

const dados = Object.fromEntries(Array.from({ length: 30 }, (_, indice) => {
    const dia = String(indice + 1).padStart(2, "0");
    return [`${dia}-09-2026`, { "12-00": { a: {
        HoraAmanhecer: 5, MinutoAmanhecer: 30,
        HourNascerDoSol: 6, MinuteNascerDoSol: 10,
        HoraPorDoSol: 18, MinutePorDoSol: 20,
        HourAnoitecer: 19, MinuteAnoitecer: 0,
        HoraZenite: 12, MinuteZenite: 15,
    } } }];
}));
const historicoCtx = { canvas: { id: "historico" } };
const diaCtx = { canvas: { id: "dia" } };
const defaults = { plugins: { tooltip: {} } };
const colors = { text: "#fff", grid: "#333" };
const historico = opcoes => contexto.ClimateSolar.createSunriseSunsetChart({ data: dados, ctx: historicoCtx, defaults, colors, ...opcoes });
const dia = opcoes => contexto.ClimateSolar.createSolarTodayChart({ data: dados, selectedDate: "30-09-2026", ctx: diaCtx, defaults, colors, ...opcoes });

const historicoInicial = historico();
const diaInicial = dia();
const dadosAtualizados = structuredClone(dados);
dadosAtualizados["30-09-2026"]["12-00"].a.HourNascerDoSol = 7;
const historicoAtualizado = historico({ data: dadosAtualizados, existingChart: historicoInicial });
const diaAtualizado = dia({ data: dadosAtualizados, existingChart: diaInicial });
console.log(JSON.stringify({
    criacoes: instancias.length,
    destruicoes: instancias.reduce((total, instancia) => total + instancia.destruicoes, 0),
}));

assert.equal(historicoAtualizado.data.labels.length, 30);
assert.equal(historicoAtualizado.data.datasets.length, 4);
assert.equal(diaAtualizado.data.datasets.length, 2);
assert.equal(diaAtualizado.config.plugins[0], contexto.ClimateSolar.solarDayBackgroundPlugin);
assert.ok(Math.abs(diaAtualizado.$solarDayTimes.sunrise - (7 + 10 / 60)) < 1e-9);
assert.equal(diaAtualizado.options.plugins.tooltip.position, "solarEvent");
assert.equal(historicoAtualizado, historicoInicial);
assert.equal(diaAtualizado, diaInicial);
assert.equal(instancias.length, 2, "Duas atualizações solares não devem criar outros gráficos.");
assert.equal(instancias.reduce((total, instancia) => total + instancia.destruicoes, 0), 0);
assert.equal(historicoAtualizado.atualizacoes.at(-1), "none");
assert.equal(diaAtualizado.atualizacoes.at(-1), "none");
assert.ok(Math.abs(historicoAtualizado.data.datasets[1].data.at(-1) - (7 + 10 / 60)) < 1e-9);

let vazios = 0;
assert.equal(historico({ data: {}, existingChart: historicoInicial, onEmpty: () => vazios++ }), null);
assert.equal(dia({ data: {}, existingChart: diaInicial, onEmpty: () => vazios++ }), null);
assert.equal(vazios, 2);
assert.equal(historicoInicial.destruicoes, 1);
assert.equal(diaInicial.destruicoes, 1);
assert.equal(historico({ existingChart: historicoInicial }).data.labels.length, 30);
assert.ok(Math.abs(dia({ existingChart: diaInicial }).$solarDayTimes.sunrise - (6 + 10 / 60)) < 1e-9);
assert.equal(instancias.length, 4, "Após estado vazio, novos gráficos devem ser criados.");
