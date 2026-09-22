import verificar from "node:assert/strict";
import arquivos from "node:fs";
import moduloCaminho from "node:path";
import maquinaVirtual from "node:vm";

const raiz = process.cwd();
const contexto = { console, Date, Math, Number, Object, Array, Set, Map };
contexto.window = contexto;
contexto.AppConfig = {
    comfortBand: { min: 20, max: 26 },
    humidityComfortBand: { min: 40, max: 60 },
    aquariumComfortBand: { min: 25, max: 27 },
    dataQuality: {
        expectedReadingsPerDay: 24,
        minimumCoveragePercent: 90,
        metrics: {
            PH: { criticalMin: 4, criticalMax: 11, maxJump: 2, repeatedCount: 4 },
            Turbidez: { repeatedCount: 6, flagConstantZero: true },
        },
    },
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

maquinaVirtual.createContext(contexto);

function carregar(caminhoRelativo) {
    const caminho = moduloCaminho.join(raiz, caminhoRelativo);
    maquinaVirtual.runInContext(arquivos.readFileSync(caminho, "utf8"), contexto, { filename: caminhoRelativo });
}

carregar("scripts/data/data-utils.js");
carregar("scripts/data/data-quality.js");
carregar("scripts/data/environmental-insights.js");
carregar("scripts/charts/rain.js");
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

verificar.deepEqual(Object.keys(fonte.dadosSelecionados), ["10-08-2026"]);
verificar.equal(fonte.linhasNormalizadas.length, 3);
verificar.deepEqual(
    fonte.linhasNormalizadas.map(linha => linha.numericValues.temperature),
    [28.06, null, null]
);

const valoresTemperatura = fonte.linhasNormalizadas.map(linha => linha.numericValues.temperature);
const estatisticasTemperatura = contexto.ClimatePdfReportModules.charts.calculateSeriesStats(valoresTemperatura);
verificar.equal(estatisticasTemperatura.min, 28.06);
verificar.equal(estatisticasTemperatura.max, 28.06);
verificar.equal(estatisticasTemperatura.avg, 28.06);

const valoresPh = fonte.linhasNormalizadas.map(linha => linha.numericValues.ph);
const estatisticasPh = contexto.ClimatePdfReportModules.charts.calculateSeriesStats(valoresPh);
verificar.equal(estatisticasPh.min, 4.2);
verificar.equal(estatisticasPh.max, 4.4);
verificar.equal(Number(estatisticasPh.avg.toFixed(2)), 4.33);

const cards = contexto.ClimatePdfReportModules.data.buildSummaryCards(
    configuracaoAquario,
    fonte.linhasNormalizadas,
    { aquarium: dadosAquario },
    "10-08-2026",
    fonte.qualidades
);
const cardTemperatura = cards.find(card => card.label === "Temperatura");
verificar.equal(cardTemperatura.min, "28.06°C");
verificar.equal(cardTemperatura.max, "28.06°C");
verificar.equal(cardTemperatura.delta, "--");
verificar.equal(cardTemperatura.status, "Dados incompletos");
verificar.equal(cardTemperatura.qualidade.leiturasValidas, 1);
verificar.equal(cardTemperatura.qualidade.leiturasEsperadas, 24);

const tabela = contexto.ClimatePdfReportModules.data.buildCompactTableRows(
    fonte.linhasNormalizadas,
    contexto.ClimatePdfReportModules.data.getPdfTableMetrics(configuracaoAquario)
);
verificar.equal(tabela[0].values.temperature, "28.06°C");
verificar.equal(tabela[1].values.temperature, "--");
verificar.equal(tabela[2].values.temperature, "--");

verificar.equal(contexto.ClimateData.normalizeMeasurementValue("temperaturaDS18B20", null), null);
verificar.equal(contexto.ClimateData.normalizeMeasurementValue("temperaturaDS18B20", ""), null);
verificar.equal(contexto.ClimateData.normalizeMeasurementValue("temperaturaDS18B20", "   "), null);

const serieSelecionada = contexto.ClimatePdfReportModules.charts.extrairSeriePorHorario(
    dadosAquario,
    "10-08-2026",
    "temperaturaDS18B20"
);
verificar.deepEqual([...serieSelecionada.labels], ["00:00"]);
verificar.deepEqual([...serieSelecionada.values], [28.06]);

const horariosChuva = [];
const inicioChuva = new Date("2026-08-09T12:00:00");
for (let indice = 0; indice < 38; indice += 1) {
    const horario = new Date(inicioChuva.getTime() + indice * 60 * 60 * 1000);
    horariosChuva.push({
        horario: horario.toISOString().slice(0, 16),
        precipitacao: indice >= 25 ? 0.4 : indice === 20 ? 1.2 : 0,
        probabilidadeChuva: indice >= 25 ? 65 : 10,
    });
}
const dadosClimaExterno = {
    atualizadoEm: new Date("2026-08-10T12:00:00"),
    origem: { rotulo: "Campinas - São Paulo" },
    climaAtual: { precipitacao: 0.2, chuva: 0.2, codigoTempo: 61 },
    previsaoCurtoPrazo: horariosChuva,
};
const cardChuva = contexto.ClimatePdfReportModules.data.buildStationRainCard(dadosClimaExterno);
verificar.equal(cardChuva.label, "Chuva externa");
verificar.equal(cardChuva.current, "Chovendo agora");
verificar.equal(cardChuva.details[0].label, "Maior chance");
verificar.equal(cardChuva.details[0].value, "65%");
verificar.equal(cardChuva.details[3].value, "Campinas - São Paulo");

const graficoChuva = contexto.ClimatePdfReportModules.charts.createRainChartCard(dadosClimaExterno);
verificar.equal(graficoChuva.label, "Chuva · 24h + previsão 12h");
verificar.equal(graficoChuva.wide, true);
verificar.match(graficoChuva.stats[0], /Registrado 24h:/);
verificar.match(graficoChuva.stats[1], /Previsto 12h:/);
verificar.match(graficoChuva.stats[2], /65%/);

console.log("Testes de regressão do relatório concluídos com sucesso.");
