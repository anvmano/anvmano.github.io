import verificar from "node:assert/strict";
import arquivos from "node:fs";
import moduloCaminho from "node:path";
import maquinaVirtual from "node:vm";

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
maquinaVirtual.createContext(contexto);

function carregar(caminho) {
    maquinaVirtual.runInContext(arquivos.readFileSync(moduloCaminho.join(raiz, caminho), "utf8"), contexto, { filename: caminho });
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
verificar.equal(temperatura.leiturasValidas, 1);
verificar.equal(temperatura.leiturasEsperadas, 24);
verificar.equal(temperatura.nivel, "incompleta");
verificar.equal(temperatura.estado, "parcial");
verificar.equal(temperatura.rotuloEstado, "Parcial");
verificar.equal(temperatura.ultimaLeitura.horario, "00-00");
verificar.match(temperatura.avisos.join(" "), /1\/24 leituras/);

const estatisticaUnica = contexto.ClimateAnalytics.calculateStats(temperatura.valores, temperatura);
verificar.equal(estatisticaUnica.delta, null);
verificar.equal(estatisticaUnica.trend.label, "Dados insuficientes");
verificar.equal(contexto.ClimateAnalytics.calculateStats([20, 21]).trend.label, "Subindo");

const ph = contexto.ClimateDataQuality.analisarSerie(dados, "PH");
verificar.equal(ph.nivel, "critica");
verificar.equal(ph.estado, "suspeito");
verificar.match(ph.avisos.join(" "), /faixa crítica/i);
verificar.match(ph.avisos.join(" "), /repetido/i);
verificar.match(ph.avisos.join(" "), /salto/i);

const turbidez = contexto.ClimateDataQuality.analisarSerie(dados, "Turbidez");
verificar.equal(turbidez.nivel, "suspeita");
verificar.equal(turbidez.estado, "suspeito");
verificar.equal(turbidez.valores.length, 24);
verificar.equal(turbidez.valores.every(valor => valor === 0), true);
verificar.match(turbidez.avisos.join(" "), /constante em zero/i);

const offline = contexto.ClimateDataQuality.analisarSerie({ "10-08-2026": {} }, "PH");
verificar.equal(offline.estado, "offline");
verificar.equal(contexto.ClimateDataQuality.resumirParaExportacao(offline).estadoRotulo, "Offline");

const rotulos = arquivos.readFileSync(moduloCaminho.join(raiz, "scripts/data/data-utils.js"), "utf8");
verificar.match(rotulos, /"Sensacao termica": "Sensação térmica"/);
verificar.match(rotulos, /PH: "pH"/);

console.log("Testes de qualidade e completude dos dados concluídos com sucesso.");
