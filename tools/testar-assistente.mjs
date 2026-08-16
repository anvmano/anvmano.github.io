import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

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
    async generateText(prompt) {
        if (String(prompt).includes("Schema obrigatório")) return "{}";
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
};

vm.createContext(contexto);

function carregarScript(caminhoRelativo) {
    const caminho = path.join(raiz, caminhoRelativo);
    vm.runInContext(fs.readFileSync(caminho, "utf8"), contexto, { filename: caminhoRelativo });
}

[
    "scripts/assistant/assistant-config.js",
    "scripts/assistant/assistant-format.js",
    "scripts/assistant/assistant-metrics.js",
    "scripts/assistant/assistant-intent.js",
    "scripts/assistant/assistant-planner.js",
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
    assert.equal(intencao.period.days, quantidade);
    assert.equal(datas[0], dataInicial);
    assert.equal(datas.at(-1), "15-08-2026");
}

const cincoDias = await resolver("Qual a média da temperatura da sala nos últimos cinco dias?");
assert.equal(cincoDias.period.days, 5);

const quarentaCincoDias = await resolver("Qual a média da temperatura da sala nos últimos 45 dias?");
assert.equal(quarentaCincoDias.period.days, 30);
assert.equal(quarentaCincoDias.period.requestedDays, 45);
assert.equal(quarentaCincoDias.period.limited, true);

const quarentaOitoHoras = await resolver("Qual a média da temperatura da sala nas últimas 48 horas?");
assert.equal(quarentaOitoHoras.period.type, "rolling_hours");
assert.equal(quarentaOitoHoras.period.hours, 48);
assert.equal(quarentaOitoHoras.period.selectedDate, "15-08-2026");

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
    assert.equal(plano.operation, operacao, pergunta);
}

const resumoGlobal = contexto.ClimateAssistant.planner.planQuestionIntent({
    environments: [contexto.ClimateAssistant.config.ENVIRONMENTS.estacao],
    metrics: [],
    operation: "resumo",
}, "Faça um resumo da data selecionada.", { ...contextoPergunta, activeTab: "Tab0" });
assert.equal(resumoGlobal.environments.length, 4);
assert.equal(resumoGlobal.operation, "resumo");

const alertaGlobal = contexto.ClimateAssistant.planner.planQuestionIntent({
    environments: [contexto.ClimateAssistant.config.ENVIRONMENTS.estacao],
    metrics: [],
    operation: "resumo",
}, "Quais indicadores ficaram fora da faixa ideal?", { ...contextoPergunta, activeTab: "Tab0" });
assert.equal(alertaGlobal.environments.length, 3);
assert.equal(alertaGlobal.operation, "status_faixa");

const maximaGlobal = contexto.ClimateAssistant.planner.planQuestionIntent({
    environments: [contexto.ClimateAssistant.config.ENVIRONMENTS.estacao],
    metrics: ["ciclo_solar"],
    operation: "resumo",
}, "Qual foi a temperatura máxima da data selecionada?", { ...contextoPergunta, activeTab: "Tab0" });
assert.equal(maximaGlobal.environments.length, 3);
assert.deepEqual([...maximaGlobal.metrics], ["temperatura"]);
assert.equal(maximaGlobal.operation, "maxima");

const mediaGlobal = contexto.ClimateAssistant.planner.planQuestionIntent({
    environments: [contexto.ClimateAssistant.config.ENVIRONMENTS.estacao],
    metrics: ["ciclo_solar"],
    operation: "resumo",
}, "Qual foi a temperatura média da data selecionada?", { ...contextoPergunta, activeTab: "Tab0" });
assert.equal(mediaGlobal.environments.length, 3);
assert.equal(mediaGlobal.operation, "media");

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

assert.deepEqual(
    [montarResultado("media").tipo_resultado, montarResultado("maxima").tipo_resultado, montarResultado("minima").tipo_resultado],
    ["estatistica_media", "estatistica_extremo", "estatistica_extremo"]
);
assert.equal(montarResultado("maxima").valor, 24);
assert.equal(montarResultado("minima").valor, 20);
assert.equal(montarResultado("delta").diferenca, 4);
assert.equal(montarResultado("tendencia").tendencia, "subindo");
assert.equal("amostras" in montarResultado("media"), false);

const metricasIncompativeis = contexto.ClimateAssistant.metrics.resolveMetricsForEnvironments(
    [contexto.ClimateAssistant.config.ENVIRONMENTS.estacao],
    ["temperatura"],
    "temperatura"
);
assert.equal(metricasIncompativeis.length, 0);

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
assert.match(respostaMedia.answer, /média de Temperatura/i);
assert.doesNotMatch(respostaMedia.answer, /Mínima:|Máxima:/i);

const respostaMaxima = await contexto.ClimateAssistant.query.answerQuestionDetailed(
    "Qual foi a temperatura mais alta da sala nos últimos 2 dias?",
    contextoComDados
);
assert.match(respostaMaxima.answer, /máxima de Temperatura/i);
assert.match(respostaMaxima.answer, /24\.00°C/);
assert.doesNotMatch(respostaMaxima.answer, /Média:|Mínima:/i);

const respostaTendencia = await contexto.ClimateAssistant.query.answerQuestionDetailed(
    "Qual a tendência da temperatura da sala nos últimos 2 dias?",
    contextoComDados
);
assert.match(respostaTendencia.answer, /tendência foi subindo/i);

console.log("Testes de regressão da assistente concluídos com sucesso.");
