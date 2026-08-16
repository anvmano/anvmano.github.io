import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const raiz = process.cwd();
const contexto = { console, Date, Math, Map, Set };
contexto.window = contexto;
contexto.AppConfig = {
    dataQuality: {
        expectedReadingsPerDay: 24,
        minimumCoveragePercent: 90,
        metrics: {
            PH: { criticalMin: 4, criticalMax: 11, maxJump: 2, repeatedCount: 4, repeatTolerance: 0.001 },
            Turbidez: { repeatedCount: 6, repeatTolerance: 0.001, flagConstantZero: true },
        },
    },
};
contexto.ClimateData = {
    dataAtual: () => "16-08-2026",
    parseFirebaseDate(valor) {
        const [dia, mes, ano] = String(valor).split("-").map(Number);
        return new Date(ano, mes - 1, dia);
    },
    normalizeMeasurementValue(campo, valor) {
        if (valor === null || valor === undefined || valor === "") return null;
        const numero = Number(valor);
        if (!Number.isFinite(numero)) return null;
        if (campo === "Turbidez") return numero / 1000;
        return numero;
    },
};
contexto.document = {};
vm.createContext(contexto);

function carregar(caminho) {
    vm.runInContext(fs.readFileSync(path.join(raiz, caminho), "utf8"), contexto, { filename: caminho });
}

carregar("scripts/data/data-quality.js");
carregar("scripts/data/analytics.js");

const dados = { "10-08-2026": {} };
for (let hora = 0; hora < 24; hora += 1) {
    const horario = `${String(hora).padStart(2, "0")}-00`;
    const ph = hora <= 1 ? (hora === 0 ? 7 : 7.07) : hora <= 15 ? 2.38 : 7.44;
    dados["10-08-2026"][horario] = {
        registro: {
            ...(hora === 0 ? { temperaturaDS18B20: 28.06 } : {}),
            PH: ph,
            Turbidez: 0,
        },
    };
}

const temperatura = contexto.ClimateDataQuality.analisarSerie(dados, "temperaturaDS18B20");
assert.equal(temperatura.leiturasValidas, 1);
assert.equal(temperatura.leiturasEsperadas, 24);
assert.equal(temperatura.nivel, "incompleta");
assert.equal(temperatura.estado, "parcial");
assert.equal(temperatura.rotuloEstado, "Parcial");
assert.equal(temperatura.ultimaLeitura.horario, "00-00");
assert.match(temperatura.avisos.join(" "), /1\/24 leituras/);

const estatisticaUnica = contexto.ClimateAnalytics.calculateStats(temperatura.valores, temperatura);
assert.equal(estatisticaUnica.delta, null);
assert.equal(estatisticaUnica.trend.label, "Dados insuficientes");
assert.equal(contexto.ClimateAnalytics.calculateStats([20, 21]).trend.label, "Subindo");

const ph = contexto.ClimateDataQuality.analisarSerie(dados, "PH");
assert.equal(ph.nivel, "critica");
assert.equal(ph.estado, "suspeito");
assert.match(ph.avisos.join(" "), /faixa crítica/i);
assert.match(ph.avisos.join(" "), /repetido/i);
assert.match(ph.avisos.join(" "), /salto/i);

const turbidez = contexto.ClimateDataQuality.analisarSerie(dados, "Turbidez");
assert.equal(turbidez.nivel, "suspeita");
assert.equal(turbidez.estado, "suspeito");
assert.equal(turbidez.valores.length, 24);
assert.equal(turbidez.valores.every(valor => valor === 0), true);
assert.match(turbidez.avisos.join(" "), /constante em zero/i);

const offline = contexto.ClimateDataQuality.analisarSerie({ "10-08-2026": {} }, "PH");
assert.equal(offline.estado, "offline");
assert.equal(contexto.ClimateDataQuality.resumirParaExportacao(offline).estadoRotulo, "Offline");

const rotulos = fs.readFileSync(path.join(raiz, "scripts/data/data-utils.js"), "utf8");
assert.match(rotulos, /"Sensacao termica": "Sensação térmica"/);
assert.match(rotulos, /PH: "pH"/);

console.log("Testes de qualidade e completude dos dados concluídos com sucesso.");
