import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const raiz = process.cwd();
const contexto = { console, Date, Math, Number, Object, Array, Set, Map };
contexto.window = contexto;
contexto.AppConfig = {
    comfortBand: { min: 20, max: 26 },
    humidityComfortBand: { min: 40, max: 60 },
    aquariumComfortBand: { min: 25, max: 27 },
    measurementUnits: {
        temperaturaDS18B20: "°C",
        PH: "",
        TDS: "ppm",
        Turbidez: "NTU",
    },
    fields: {
        room: { temperature: "Temperatura", feelsLike: "Sensacao termica", humidity: "Umidade" },
        livingRoom: { temperature: "temperatura", feelsLike: "sensacaoTermica", humidity: "umidade", pressure: "pressao" },
        aquarium: { temperature: "temperaturaDS18B20", ph: "PH", tds: "TDS", turbidity: "Turbidez" },
    },
    ids: { charts: {} },
    colors: {},
};

vm.createContext(contexto);

function carregar(caminhoRelativo) {
    const caminho = path.join(raiz, caminhoRelativo);
    vm.runInContext(fs.readFileSync(caminho, "utf8"), contexto, { filename: caminhoRelativo });
}

carregar("scripts/data/data-utils.js");
carregar("scripts/reports/pdf-report-format.js");
carregar("scripts/reports/pdf-report-config.js");
carregar("scripts/reports/pdf-report-data.js");
carregar("scripts/reports/pdf-report-charts.js");

const dadosAquario = {
    "09-08-2026": {
        "23-00": { anterior: { temperaturaDS18B20: 99, PH: 9 } },
    },
    "10-08-2026": {
        "00-00": { primeiro: { temperaturaDS18B20: 28.06, PH: 4.2, TDS: 120, Turbidez: 350 } },
        "01-00": { segundo: { temperaturaDS18B20: null, PH: 4.4, TDS: 130, Turbidez: 360 } },
        "02-00": { terceiro: { temperaturaDS18B20: "", PH: 4.39, TDS: 140, Turbidez: 370 } },
    },
    "11-08-2026": {
        "00-00": { posterior: { temperaturaDS18B20: 1, PH: 8 } },
    },
};

const configuracaoAquario = contexto.ClimatePdfReportModules.config.TAB_CONFIG.Tab3;
const fonte = contexto.ClimatePdfReportModules.data.construirFonteDadosRelatorio(
    configuracaoAquario,
    { aquarium: dadosAquario },
    "10-08-2026"
);

assert.deepEqual(Object.keys(fonte.dadosSelecionados), ["10-08-2026"]);
assert.equal(fonte.linhasNormalizadas.length, 3);
assert.deepEqual(
    fonte.linhasNormalizadas.map(row => row.numericValues.temperature),
    [28.06, null, null]
);

const valoresTemperatura = fonte.linhasNormalizadas.map(row => row.numericValues.temperature);
const estatisticasTemperatura = contexto.ClimatePdfReportModules.charts.calculateSeriesStats(valoresTemperatura);
assert.equal(estatisticasTemperatura.min, 28.06);
assert.equal(estatisticasTemperatura.max, 28.06);
assert.equal(estatisticasTemperatura.avg, 28.06);

const valoresPh = fonte.linhasNormalizadas.map(row => row.numericValues.ph);
const estatisticasPh = contexto.ClimatePdfReportModules.charts.calculateSeriesStats(valoresPh);
assert.equal(estatisticasPh.min, 4.2);
assert.equal(estatisticasPh.max, 4.4);
assert.equal(Number(estatisticasPh.avg.toFixed(2)), 4.33);

const cards = contexto.ClimatePdfReportModules.data.buildSummaryCards(
    configuracaoAquario,
    fonte.linhasNormalizadas,
    { aquarium: dadosAquario },
    "10-08-2026"
);
const cardTemperatura = cards.find(card => card.label === "Temperatura");
assert.equal(cardTemperatura.min, "28.06°C");
assert.equal(cardTemperatura.max, "28.06°C");

const tabela = contexto.ClimatePdfReportModules.data.buildCompactTableRows(
    fonte.linhasNormalizadas,
    contexto.ClimatePdfReportModules.data.getPdfTableMetrics(configuracaoAquario)
);
assert.equal(tabela[0].values.temperature, "28.06°C");
assert.equal(tabela[1].values.temperature, "--");
assert.equal(tabela[2].values.temperature, "--");

assert.equal(contexto.ClimateData.normalizeMeasurementValue("temperaturaDS18B20", null), null);
assert.equal(contexto.ClimateData.normalizeMeasurementValue("temperaturaDS18B20", ""), null);
assert.equal(contexto.ClimateData.normalizeMeasurementValue("temperaturaDS18B20", "   "), null);

const serieSelecionada = contexto.ClimatePdfReportModules.charts.extrairSeriePorHorario(
    dadosAquario,
    "10-08-2026",
    "temperaturaDS18B20"
);
assert.deepEqual([...serieSelecionada.labels], ["00:00"]);
assert.deepEqual([...serieSelecionada.values], [28.06]);

console.log("Testes de regressão do relatório concluídos com sucesso.");
