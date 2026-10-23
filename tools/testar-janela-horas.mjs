import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { performance } from "node:perf_hooks";

const contexto = { Date, window: {} };
vm.createContext(contexto);
vm.runInContext(fs.readFileSync("scripts/data/data-utils.js", "utf8"), contexto);
const { filterDataByRollingHours: filtrar, parseFirebaseDate: interpretarData, parseFirebaseDateTime: interpretarDataHora, getRollingWindow: obterJanela } = contexto.window.ClimateData;

function original(dados, dataSelecionada, horas, agora) {
    const janela = obterJanela(dataSelecionada, horas, agora);
    if (!janela) return {};
    const filtrado = {};
    for (const data of Object.keys(dados || {}).sort((a, b) => interpretarData(a) - interpretarData(b))) {
        const dadosData = dados[data];
        if (!dadosData || typeof dadosData !== "object") continue;
        for (const horario of Object.keys(dadosData).sort()) {
            const instante = interpretarDataHora(data, horario);
            if (!instante || instante < janela.inicio || instante > janela.fim) continue;
            filtrado[data] ||= {};
            filtrado[data][horario] = dadosData[horario];
        }
    }
    return filtrado;
}

function dataFirebase(data) {
    return `${String(data.getDate()).padStart(2, "0")}-${String(data.getMonth() + 1).padStart(2, "0")}-${data.getFullYear()}`;
}

const agora = new Date(2026, 7, 15, 12, 30);
const fixture = {};
for (let atraso = 179; atraso >= 0; atraso--) {
    const data = new Date(2026, 7, 15 - atraso);
    const dia = fixture[dataFirebase(data)] = {};
    for (let minutos = 0; minutos < 1440; minutos += 5) {
        dia[`${String(Math.floor(minutos / 60)).padStart(2, "0")}-${String(minutos % 60).padStart(2, "0")}`] = { sensor: { temperatura: atraso + minutos / 1440 } };
    }
}
fixture["14-08-2026"]["12-29"] = { antes: true };
fixture["14-08-2026"]["12-30"] = { inicio: true };
fixture["15-08-2026"]["12-30"] = { fim: true };
fixture["15-08-2026"]["12-31"] = { depois: true };
fixture["31-07-2026"] = { "00-00": { dataNormalizada: true } };
fixture["invalida"] = { "12-30": { ignorar: true } };
fixture["15-08-2026"]["25-00"] = { ignorar: true };

for (const [dados, selecionada, horas, referencia] of [
    [fixture, "15-08-2026", 24, agora],
    [fixture, "15-08-2026", 48, agora],
    [fixture, "15-08-2026", 720, agora],
    [fixture, "01-08-2026", 24, agora],
    [fixture, "invalida", 24, agora],
    [null, "15-08-2026", 24, agora],
    [{ "31-04-2026": { "00-00": { normalizada: true } }, "01-05-2026": { "00-00": { canonica: true } } }, "01-05-2026", 24, new Date(2026, 4, 1)],
]) {
    assert.equal(JSON.stringify(filtrar(dados, selecionada, horas, referencia)), JSON.stringify(original(dados, selecionada, horas, referencia)));
}
assert.equal(filtrar(fixture, "15-08-2026", 24, agora)["14-08-2026"]["12-30"].inicio, true);
assert.equal(filtrar(fixture, "15-08-2026", 24, agora)["15-08-2026"]["12-30"].fim, true);
contexto.window.ClimateDiagnostics = { depurar() {} };
contexto.window.ClimateAIService = {
    async generateText(instrucoes) {
        if (String(instrucoes).includes("Schema obrigatório")) return "{}";
        throw new Error("Usar resposta local no teste.");
    },
};
for (const arquivo of ["assistant-config", "assistant-format", "assistant-metrics", "assistant-intent", "assistant-planner", "assistant-solar", "assistant-query"]) {
    vm.runInContext(fs.readFileSync(`scripts/assistant/${arquivo}.js`, "utf8"), contexto);
}
const consulta = { activeTab: "Tab1", selectedDate: "15-08-2026", latestData: { livingRoom: fixture } };
const pergunta = "Qual a média da temperatura da sala nas últimas 48 horas?";
const respostaAtual = await contexto.window.ClimateAssistant.query.answerQuestionDetailed(pergunta, consulta);
contexto.window.ClimateData.filterDataByRollingHours = original;
const respostaOriginal = await contexto.window.ClimateAssistant.query.answerQuestionDetailed(pergunta, consulta);
contexto.window.ClimateData.filterDataByRollingHours = filtrar;
assert.equal(JSON.stringify(respostaAtual.result.results), JSON.stringify(respostaOriginal.result.results));
console.log("Janela móvel: equivalência, limites, meia-noite, datas inválidas e consulta do assistente OK.");

if (process.argv.includes("--benchmark")) {
    const medir = (nome, funcao) => {
        for (let i = 0; i < 3; i++) funcao(fixture, "15-08-2026", 24, agora);
        const tempos = [];
        for (let i = 0; i < 15; i++) {
            const inicio = performance.now();
            funcao(fixture, "15-08-2026", 24, agora);
            tempos.push(performance.now() - inicio);
        }
        tempos.sort((a, b) => a - b);
        console.log(`${nome}: p50 ${tempos[7].toFixed(1)} ms; p95 ${tempos[14].toFixed(1)} ms (15 execuções, após 3 aquecimentos)`);
    };
    medir("Original", original);
    medir("Atual", filtrar);
}
