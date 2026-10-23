import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { performance } from "node:perf_hooks";

const contexto = {
    Date,
    document: { getElementById: () => ({ getContext: () => ({}) }) },
};
contexto.window = contexto;
contexto.AppConfig = {
    ids: { charts: { globalTemperature: "temp", globalHumidity: "hum", rain: "rain" } },
    fields: {},
    colors: {},
    sensorSchemas: { temperatura: { sentinels: [-999] } },
};
vm.createContext(contexto);
vm.runInContext(fs.readFileSync("scripts/data/data-utils.js", "utf8"), contexto);
const fonteEstacao = fs.readFileSync("scripts/views/estacao-view.js", "utf8")
    .replace(/\}\)\(\);\s*$/, "window.__obterUltimoRegistro = obterUltimoRegistro;})();");
vm.runInContext(fonteEstacao, contexto);
const atual = contexto.__obterUltimoRegistro;
assert.equal(typeof atual, "function");
contexto.ClimatePdfReportModules = { format: { formatValue: valor => String(valor), formatDelta() {}, getMetricStatus() {} } };
const fontePdf = fs.readFileSync("scripts/reports/pdf-report-data.js", "utf8")
    .replace(/\}\)\(\);\s*$/, "window.__obterUltimoRegistroPdf = obterUltimoRegistroEstacao;})();");
vm.runInContext(fontePdf, contexto);
const atualPdf = contexto.__obterUltimoRegistroPdf;
assert.equal(typeof atualPdf, "function");

function formatarData(data) {
    const [dia, mes, ano] = String(data || "").split("-");
    return `${ano}-${mes}-${dia}`;
}

function formatarHora(horario) {
    const [hora, minuto = "0"] = String(horario || "").split("-");
    return `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
}

function original(dados, campo) {
    let ultimo = null;
    for (const data of Object.keys(dados || {})) {
        const dadosData = dados[data];
        if (!dadosData || typeof dadosData !== "object") continue;
        for (const horario of Object.keys(dadosData)) {
            const valores = [];
            const dadosHorario = dadosData[horario];
            if (dadosHorario && typeof dadosHorario === "object") {
                for (const item of Object.values(dadosHorario)) {
                    if (!item || typeof item !== "object") continue;
                    const valor = contexto.ClimateData.normalizeMeasurementValue(campo, item[campo]);
                    if (valor !== null) valores.push(valor);
                }
            }
            if (!valores.length) continue;
            const chave = `${formatarData(data)} ${formatarHora(horario)}`;
            if (!ultimo || chave > ultimo.chave) {
                ultimo = { chave, valor: valores[valores.length - 1], data, horario: formatarHora(horario) };
            }
        }
    }
    return ultimo;
}

function comparar(dados, campo) {
    const agora = new Date();
    const dadosValidos = Object.fromEntries(Object.entries(dados || {}).map(([data, horarios]) => [
        data,
        Object.fromEntries(Object.entries(horarios || {}).filter(([horario]) => contexto.ClimateData.isValidPastReading(data, horario, agora))),
    ]));
    const esperado = original(dadosValidos, campo);
    assert.equal(JSON.stringify(atual(dados, campo)), JSON.stringify(esperado));
    assert.equal(JSON.stringify(atualPdf(dados, campo)), JSON.stringify(esperado));
}

const referencia = new Date(2026, 9, 23, 12, 30);
for (const [data, horario, esperado] of [
    ["22-10-2026", "23-59", true],
    ["23-10-2026", "12-30", true],
    ["23-10-2026", "12-31", false],
    ["24-10-2026", "00-00", false],
    ["53-82-2045", "12-00", false],
    ["07-02-2106", "12-00", false],
    ["31-04-2026", "12-00", false],
    ["29-02-2024", "12-00", true],
    ["29-02-2025", "12-00", false],
]) {
    assert.equal(contexto.ClimateData.isValidPastReading(data, horario, referencia), esperado, `${data} ${horario}`);
}
const meiaNoite = new Date(2026, 9, 23, 0, 0);
assert.equal(contexto.ClimateData.isValidPastReading("22-10-2026", "23-59", meiaNoite), true);
assert.equal(contexto.ClimateData.isValidPastReading("23-10-2026", "00-00", meiaNoite), true);
assert.equal(contexto.ClimateData.isValidPastReading("23-10-2026", "00-01", meiaNoite), false);

const dataOriginal = contexto.Date;
class RelogioFixo extends Date {
    constructor(...args) {
        if (args.length) super(...args);
        else super(2026, 9, 23, 12, 30);
    }
}
contexto.Date = RelogioFixo;
const dadosRelogio = {
    "22-10-2026": { "23-59": { anterior: { temperatura: 20 } } },
    "23-10-2026": {
        "12-30": { valido: { temperatura: 22 } },
        "12-31": { futuro: { temperatura: 99 } },
    },
    "24-10-2026": { "00-00": { amanha: { temperatura: 98 } } },
};
assert.equal(atual(dadosRelogio, "temperatura")?.valor, 22);
assert.equal(atualPdf(dadosRelogio, "temperatura")?.valor, 22);
assert.equal(contexto.ClimatePdfReportModules.data.buildStationLatestCard("Temperatura", dadosRelogio, "temperatura", "°C").current, "22");
contexto.Date = dataOriginal;

comparar(null, "temperatura");
comparar({ "15-08-2026": { "23-55": { a: { umidade: 50 } }, "23-50": { a: { temperatura: 22 }, b: { temperatura: 23 } } } }, "temperatura");
comparar({ "14-08-2026": { "23-55": { a: { temperatura: 20 } } }, "15-08-2026": { "00-00": { a: { temperatura: -999 } } } }, "temperatura");
comparar({ "01-01-2026": { "01-05": { a: { temperatura: 21 } } }, "01-01-2026-extra": { "02-00": { a: { temperatura: 22 } } } }, "temperatura");
comparar({ "01-08-2026": { "1-5": { a: { temperatura: 20 } }, "01-05": { b: { temperatura: 21 } } } }, "temperatura");
comparar({ "invalida": { "12-00": { a: { temperatura: 25 } } }, "01-08-2026": { "12-00": { b: { temperatura: 20 } } } }, "temperatura");
comparar({ "53-82-2045": { "12-00": { a: { temperatura: 99 } } }, "07-02-2106": { "12-00": { b: { temperatura: 98 } } }, "15-08-2026": { "12-00": { c: { temperatura: 22 } } } }, "temperatura");

function dataFirebase(data) {
    return `${String(data.getDate()).padStart(2, "0")}-${String(data.getMonth() + 1).padStart(2, "0")}-${data.getFullYear()}`;
}

function fixture(dias) {
    const dados = {};
    for (let atraso = dias - 1; atraso >= 0; atraso--) {
        const data = new Date(2026, 7, 15 - atraso);
        const horarios = dados[dataFirebase(data)] = {};
        for (let minutos = 0; minutos < 1440; minutos += 5) {
            const horario = `${String(Math.floor(minutos / 60)).padStart(2, "0")}-${String(minutos % 60).padStart(2, "0")}`;
            horarios[horario] = { registro: { temperatura: 20 + minutos / 100, umidade: 50 + minutos / 100 } };
        }
    }
    return dados;
}

for (const dias of [30, 180, 365]) comparar(fixture(dias), "temperatura");
comparar(fixture(30), "campoAusente");
console.log("Último registro: equivalência em campos ausentes, sentinelas, múltiplos itens, chaves não canônicas e históricos de 30/180/365 dias OK.");

const indiceExport = process.argv.indexOf("--export");
let historicoExport = null;
if (indiceExport >= 0) {
    const caminhoExport = process.argv[indiceExport + 1];
    if (!caminhoExport) throw new Error("Informe o caminho do export após --export.");
    historicoExport = JSON.parse(fs.readFileSync(caminhoExport, "utf8")).historico;
    assert.ok("53-82-2045" in historicoExport.Temperatura);
    assert.ok("07-02-2106" in historicoExport.Aquario);
    for (const [caminho, campos] of [
        ["Temperatura", ["Temperatura", "Umidade"]],
        ["Aquario", ["temperaturaDS18B20", "PH"]],
        ["AirQuality", ["temperatura", "umidade"]],
    ]) {
        for (const campo of campos) {
            comparar(historicoExport[caminho], campo);
            const registro = atual(historicoExport[caminho], campo);
            if (registro) assert.equal(contexto.ClimateData.isValidPastReading(registro.data, registro.horario.replace(":", "-")), true);
        }
    }
    console.log("Último registro: equivalência em seis métricas do export RTDB confirmada.");
}

if (process.argv.includes("--benchmark")) {
    const dados = historicoExport?.Temperatura || fixture(365);
    const campoPresente = historicoExport ? "Temperatura" : "temperatura";
    contexto.contexto = contexto;
    const originalMesmoContexto = vm.runInContext(`${formatarData}\n${formatarHora}\n(${original})`, contexto);
    function medir(nome, funcao, campo = "temperatura") {
        for (let i = 0; i < 3; i++) funcao(dados, campo);
        const tempos = [];
        for (let i = 0; i < 15; i++) {
            const inicio = performance.now();
            funcao(dados, campo);
            tempos.push(performance.now() - inicio);
        }
        tempos.sort((a, b) => a - b);
        console.log(`${nome}: p50 ${tempos[7].toFixed(2)} ms; p95 ${tempos[14].toFixed(2)} ms (15 execuções após 3 aquecimentos)`);
    }
    medir("Original", originalMesmoContexto, campoPresente);
    medir("Atual", atual, campoPresente);
    medir("Original sem campo", originalMesmoContexto, "campoAusente");
    medir("Atual sem campo", atual, "campoAusente");
}
