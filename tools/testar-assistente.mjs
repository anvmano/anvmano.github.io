import verificar from "node:assert/strict";
import arquivos from "node:fs";
import moduloCaminho from "node:path";
import maquinaVirtual from "node:vm";

const raiz = process.cwd();
const contexto = {
    console,
    Date,
    Math,
    JSON,
    Promise,
    Set,
    Map,
};

contexto.window = contexto;
contexto.ClimateDiagnostics = { depurar() {} };
contexto.ClimateAIService = {
    async generateText(instrucaoModelo) {
        if (String(instrucaoModelo).includes("Schema obrigatório")) return "{}";
        throw new Error("Resposta final desativada para validar o fallback local.");
    },
};
contexto.ClimateData = {
    dataAtual: () => "16-08-2026",
    parseFirebaseDate(valor) {
        const [dia, mes, ano] = String(valor).split("-").map(Number);
        return new Date(ano, mes - 1, dia);
    },
    normalizeMeasurementValue(_chave, valor) {
        const numero = Number(valor);
        return Number.isFinite(numero) ? numero : null;
    },
    formatTime(valor) {
        if (!valor) return null;
        const numero = Number(valor);
        if (!Number.isFinite(numero)) return null;
        const hora = Math.floor(numero);
        const minuto = Math.round((numero - hora) * 60);
        return `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
    },
};
contexto.ClimateSolar = {
    getSolarEventsForSelectedDate(origem, dados) {
        return origem?.[dados] || null;
    },
};

maquinaVirtual.createContext(contexto);

function carregarScript(caminhoRelativo) {
    const caminho = moduloCaminho.join(raiz, caminhoRelativo);
    maquinaVirtual.runInContext(arquivos.readFileSync(caminho, "utf8"), contexto, { filename: caminhoRelativo });
}

[
    "scripts/assistant/assistant-config.js",
    "scripts/assistant/assistant-format.js",
    "scripts/assistant/assistant-metrics.js",
    "scripts/assistant/assistant-intent.js",
    "scripts/assistant/assistant-planner.js",
    "scripts/assistant/assistant-solar.js",
    "scripts/assistant/assistant-query.js",
].forEach(carregarScript);

const contextoPergunta = {
    activeTab: "Tab1",
    selectedDate: "15-08-2026",
};

async function resolver(pergunta) {
    return contexto.ClimateAssistant.intent.resolveQuestionIntent(pergunta, contextoPergunta);
}

for (const [quantidade, dataInicial] of [[2, "14-08-2026"], [3, "13-08-2026"], [5, "11-08-2026"], [10, "06-08-2026"], [30, "17-07-2026"]]) {
    const intencao = await resolver(`Qual a média da temperatura da sala nos últimos ${quantidade} dias?`);
    const datas = contexto.ClimateAssistant.intent.resolvePeriodDates(intencao.period);
    verificar.equal(intencao.period.days, quantidade);
    verificar.equal(datas[0], dataInicial);
    verificar.equal(datas.at(-1), "15-08-2026");
}

const cincoDias = await resolver("Qual a média da temperatura da sala nos últimos cinco dias?");
verificar.equal(cincoDias.period.days, 5);

const quarentaCincoDias = await resolver("Qual a média da temperatura da sala nos últimos 45 dias?");
verificar.equal(quarentaCincoDias.period.days, 30);
verificar.equal(quarentaCincoDias.period.requestedDays, 45);
verificar.equal(quarentaCincoDias.period.limited, true);

const quarentaOitoHoras = await resolver("Qual a média da temperatura da sala nas últimas 48 horas?");
verificar.equal(quarentaOitoHoras.period.type, "rolling_hours");
verificar.equal(quarentaOitoHoras.period.hours, 48);
verificar.equal(quarentaOitoHoras.period.selectedDate, "15-08-2026");

const perguntaIntervaloSolar = "Qual o dia mais longo entre 16/08/2025 e 16/08/2026?";
const intencaoIntervaloSolar = await resolver(perguntaIntervaloSolar);
const planoIntervaloSolar = contexto.ClimateAssistant.planner.planQuestionIntent(
    intencaoIntervaloSolar,
    perguntaIntervaloSolar,
    contextoPergunta
);
const datasIntervaloSolar = contexto.ClimateAssistant.intent.resolvePeriodDates(planoIntervaloSolar.period);
verificar.equal(planoIntervaloSolar.operation, "solar_maior_duracao_luz");
verificar.equal(planoIntervaloSolar.period.type, "solar_range");
verificar.equal(datasIntervaloSolar[0], "16-08-2025");
verificar.equal(datasIntervaloSolar.at(-1), "16-08-2026");
verificar.equal(datasIntervaloSolar.length, 366);

const perguntaAnoSolar = "Qual o dia mais longo desse ano?";
const intencaoAnoSolar = await resolver(perguntaAnoSolar);
const planoAnoSolar = contexto.ClimateAssistant.planner.planQuestionIntent(
    intencaoAnoSolar,
    perguntaAnoSolar,
    contextoPergunta
);
verificar.equal(planoAnoSolar.period.type, "selected_year");
verificar.equal(planoAnoSolar.period.selectedDate.endsWith("-2026"), true);

const casosOperacao = [
    ["Qual a média da temperatura da sala nos últimos 7 dias?", "media"],
    ["Qual foi a temperatura mais alta da sala nos últimos 7 dias?", "maxima"],
    ["Qual foi a temperatura mais baixa da sala nos últimos 7 dias?", "minima"],
    ["Qual a tendência da temperatura da sala nos últimos 7 dias?", "tendencia"],
    ["Quanto a temperatura da sala variou nos últimos 7 dias?", "delta"],
    ["A temperatura da sala ficou dentro da faixa hoje?", "status_faixa"],
    ["Quantas horas a temperatura da sala ficou fora da faixa hoje?", "status_faixa"],
    ["Qual foi o horário mais quente da sala ontem?", "horario_maior_valor"],
    ["Qual foi o dia mais frio da sala nos últimos 3 dias?", "dia_mais_frio"],
];

for (const [pergunta, operacao] of casosOperacao) {
    const intencao = await resolver(pergunta);
    const plano = contexto.ClimateAssistant.planner.planQuestionIntent(intencao, pergunta, contextoPergunta);
    verificar.equal(plano.operation, operacao, pergunta);
}

const resumoGlobal = contexto.ClimateAssistant.planner.planQuestionIntent({
    environments: [contexto.ClimateAssistant.config.ENVIRONMENTS.estacao],
    metrics: [],
    operation: "resumo",
}, "Faça um resumo da data selecionada.", { ...contextoPergunta, activeTab: "Tab0" });
verificar.equal(resumoGlobal.environments.length, 4);
verificar.equal(resumoGlobal.operation, "resumo");

const alertaGlobal = contexto.ClimateAssistant.planner.planQuestionIntent({
    environments: [contexto.ClimateAssistant.config.ENVIRONMENTS.estacao],
    metrics: [],
    operation: "resumo",
}, "Quais indicadores ficaram fora da faixa ideal?", { ...contextoPergunta, activeTab: "Tab0" });
verificar.equal(alertaGlobal.environments.length, 3);
verificar.equal(alertaGlobal.operation, "status_faixa");

const maximaGlobal = contexto.ClimateAssistant.planner.planQuestionIntent({
    environments: [contexto.ClimateAssistant.config.ENVIRONMENTS.estacao],
    metrics: ["ciclo_solar"],
    operation: "resumo",
}, "Qual foi a temperatura máxima da data selecionada?", { ...contextoPergunta, activeTab: "Tab0" });
verificar.equal(maximaGlobal.environments.length, 3);
verificar.deepEqual([...maximaGlobal.metrics], ["temperatura"]);
verificar.equal(maximaGlobal.operation, "maxima");

const mediaGlobal = contexto.ClimateAssistant.planner.planQuestionIntent({
    environments: [contexto.ClimateAssistant.config.ENVIRONMENTS.estacao],
    metrics: ["ciclo_solar"],
    operation: "resumo",
}, "Qual foi a temperatura média da data selecionada?", { ...contextoPergunta, activeTab: "Tab0" });
verificar.equal(mediaGlobal.environments.length, 3);
verificar.equal(mediaGlobal.operation, "media");

const metrica = { label: "Temperatura", key: "temperatura", unit: "°C", aliases: ["temperatura"] };
const ambiente = contexto.ClimateAssistant.config.ENVIRONMENTS.sala;
const dadosDiarios = [
    contexto.ClimateAssistant.metrics.buildDailyStats({
        "08-00": { a: { temperatura: 20 } },
        "10-00": { b: { temperatura: 22 } },
    }, metrica, "14-08-2026"),
    contexto.ClimateAssistant.metrics.buildDailyStats({
        "08-00": { a: { temperatura: 23 } },
        "10-00": { b: { temperatura: 24 } },
    }, metrica, "15-08-2026"),
];

function montarResultado(operacao) {
    return contexto.ClimateAssistant.metrics.buildMetricResult(
        ambiente,
        metrica,
        dadosDiarios,
        ["14-08-2026", "15-08-2026"],
        { operation: operacao, periodLabel: "14/08/2026 a 15/08/2026" },
        {},
        {}
    );
}

verificar.deepEqual(
    [montarResultado("media").tipo_resultado, montarResultado("maxima").tipo_resultado, montarResultado("minima").tipo_resultado],
    ["estatistica_media", "estatistica_extremo", "estatistica_extremo"]
);
verificar.equal(montarResultado("maxima").valor, 24);
verificar.equal(montarResultado("minima").valor, 20);
verificar.equal(montarResultado("delta").diferenca, 4);
verificar.equal(montarResultado("tendencia").tendencia, "subindo");
verificar.equal("amostras" in montarResultado("media"), false);
const estatisticaUmaMedicao = contexto.ClimateAssistant.metrics.calculateStats([28.06]);
verificar.equal(estatisticaUmaMedicao.delta, null);
verificar.equal(contexto.ClimateAssistant.metrics.trendFromDelta(estatisticaUmaMedicao.delta), "dados insuficientes");

const resultadoTendenciaInsuficiente = contexto.ClimateAssistant.metrics.buildMetricResult(
    contexto.ClimateAssistant.config.ENVIRONMENTS.aquario,
    { label: "Temperatura", key: "temperaturaDS18B20", unit: "°C", aliases: ["temperatura"] },
    [{
        date: "10-08-2026",
        dateLabel: "10/08/2026",
        values: [28.06],
        records: [{ value: 28.06, time: "00:00" }],
        stats: estatisticaUmaMedicao,
        qualidade: { nivel: "incompleta", status: "Dados incompletos", leiturasValidas: 1, leiturasEsperadas: 24, avisos: [] },
    }],
    ["10-08-2026"],
    { operation: "tendencia", periodLabel: "10/08/2026" },
    {},
    {}
);
verificar.equal(resultadoTendenciaInsuficiente.tipo_resultado, "dados_insuficientes_tendencia");

const metricasIncompativeis = contexto.ClimateAssistant.metrics.resolveMetricsForEnvironments(
    [contexto.ClimateAssistant.config.ENVIRONMENTS.estacao],
    ["temperatura"],
    "temperatura"
);
verificar.equal(metricasIncompativeis.length, 0);

const contextoComDados = {
    ...contextoPergunta,
    latestData: {
        livingRoom: {
            "14-08-2026": {
                "08-00": { a: { temperatura: 20 } },
                "10-00": { b: { temperatura: 22 } },
            },
            "15-08-2026": {
                "08-00": { a: { temperatura: 23 } },
                "10-00": { b: { temperatura: 24 } },
            },
        },
    },
};

const respostaMedia = await contexto.ClimateAssistant.query.answerQuestionDetailed(
    "Qual a média da temperatura da sala nos últimos 2 dias?",
    contextoComDados
);
verificar.match(respostaMedia.answer, /média de Temperatura/i);
verificar.doesNotMatch(respostaMedia.answer, /Mínima:|Máxima:/i);

const respostaMaxima = await contexto.ClimateAssistant.query.answerQuestionDetailed(
    "Qual foi a temperatura mais alta da sala nos últimos 2 dias?",
    contextoComDados
);
verificar.match(respostaMaxima.answer, /máxima de Temperatura/i);
verificar.match(respostaMaxima.answer, /24\.00°C/);
verificar.doesNotMatch(respostaMaxima.answer, /Média:|Mínima:/i);

const respostaTendencia = await contexto.ClimateAssistant.query.answerQuestionDetailed(
    "Qual a tendência da temperatura da sala nos últimos 2 dias?",
    contextoComDados
);
verificar.match(respostaTendencia.answer, /tendência foi subindo/i);

const contextoSolar = {
    ...contextoPergunta,
    activeTab: "Tab0",
    latestData: {
        solar: {
            "16-08-2025": { dawn: 5, sunrise: 6, zenith: 12, sunset: 18, dusk: 19 },
            "01-01-2026": { dawn: 4.5, sunrise: 5.75, zenith: 12.25, sunset: 18.85, dusk: 20.25 },
            "16-08-2026": { dawn: 5, sunrise: 6.25, zenith: 12, sunset: 17.75, dusk: 19 },
        },
    },
};
const respostaIntervaloSolar = await contexto.ClimateAssistant.query.answerQuestionDetailed(
    perguntaIntervaloSolar,
    contextoSolar
);
const metricaSolar = respostaIntervaloSolar.result.results[0].metricas[0];
verificar.equal(metricaSolar.tipo_resultado, "solar_extremo_duracao_luz");
verificar.equal(metricaSolar.data, "01/01/2026");
verificar.equal(metricaSolar.periodo, "16/08/2025 a 16/08/2026");
verificar.equal("datas_consultadas" in metricaSolar, false);
verificar.match(respostaIntervaloSolar.answer, /01\/01\/2026/);
verificar.match(respostaIntervaloSolar.answer, /16\/08\/2025 a 16\/08\/2026/);

console.log("Testes de regressão da assistente concluídos com sucesso.");
