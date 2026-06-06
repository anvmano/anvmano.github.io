'use strict';

(function () {
    const MAX_PROMPT_CHARS = 9000;
    const DEFAULT_RECENT_DAYS = 7;
    const MAX_PERIOD_DAYS = 30;
    const CHAT_EXAMPLES = [
        "Qual foi a temperatura média hoje?",
        "Qual a máxima do aquário na data selecionada?",
        "A umidade ficou dentro da faixa?",
    ];
    const METRIC_ALIASES = {
        temperatura: ["temperatura", "temp", "frio", "quente", "calor"],
        temperaturaDS18B20: ["temperatura", "temp", "frio", "quente", "calor"],
        "Sensacao termica": ["sensacao", "sensacao termica", "sensação térmica"],
        sensacaoTermica: ["sensacao", "sensacao termica", "sensação térmica"],
        Umidade: ["umidade", "humidade", "humidad"],
        umidade: ["umidade", "humidade", "humidad"],
        pressao: ["pressao", "pressão", "hpa"],
        Toluen: ["tolueno", "toluen"],
        PH: ["ph"],
        TDS: ["tds", "solidos", "sólidos"],
        Turbidez: ["turbidez", "ntu"],
    };
    const ENVIRONMENTS = {
        sala: {
            label: "Sala",
            dataKey: "livingRoom",
            aliases: ["sala"],
            activeTab: "Tab1",
            metrics: [
                ["Temperatura", "temperatura", "°C"],
                ["Sensação térmica", "sensacaoTermica", "°C"],
                ["Umidade", "umidade", "%"],
                ["Pressão", "pressao", "hPa"],
                ["CO", "CO", "ppm"],
                ["CO2", "CO2", "ppm"],
                ["Acetona", "Aceton", "ppm"],
                ["Álcool", "Alcohol", "ppm"],
                ["Amônia", "NH4", "ppm"],
                ["Tolueno", "Toluen", "ppm"],
            ],
        },
        quarto: {
            label: "Quarto",
            dataKey: "room",
            aliases: ["quarto"],
            activeTab: "Tab2",
            metrics: [
                ["Temperatura", "Temperatura", "°C"],
                ["Sensação térmica", "Sensacao termica", "°C"],
                ["Umidade", "Umidade", "%"],
            ],
        },
        aquario: {
            label: "Aquário",
            dataKey: "aquarium",
            aliases: ["aquario", "aquário"],
            activeTab: "Tab3",
            metrics: [
                ["Temperatura", "temperaturaDS18B20", "°C"],
                ["pH", "PH", ""],
                ["TDS", "TDS", "ppm"],
                ["Turbidez", "Turbidez", "NTU"],
            ],
        },
    };

    let contextProvider = null;
    let elements = {};
    let isOpen = false;
    let isBusy = false;
    let closeTimer = null;

    function setup(options = {}) {
        contextProvider = options.getContext;
        elements = collectElements();
        if (!elements.toggle || !elements.panel || !elements.form || !elements.input || !elements.messages) return;

        elements.toggle.addEventListener("click", toggleChat);
        elements.close?.addEventListener("click", closeChat);
        elements.form.addEventListener("submit", handleSubmit);
        elements.quickActions.forEach(button => {
            button.addEventListener("click", () => submitQuestion(button.dataset.chatQuestion));
        });
        renderWelcomeMessage();
    }

    function collectElements() {
        return {
            root: document.getElementById("aiChat"),
            toggle: document.getElementById("aiChatToggle"),
            panel: document.getElementById("aiChatPanel"),
            close: document.getElementById("aiChatClose"),
            quickActions: document.querySelectorAll("[data-chat-question]"),
            form: document.getElementById("aiChatForm"),
            input: document.getElementById("aiChatInput"),
            submit: document.getElementById("aiChatSubmit"),
            messages: document.getElementById("aiChatMessages"),
        };
    }

    function toggleChat() {
        isOpen ? closeChat() : openChat();
    }

    function openChat() {
        isOpen = true;
        clearTimeout(closeTimer);
        elements.toggle?.setAttribute("aria-expanded", "true");
        elements.panel?.removeAttribute("hidden");
        requestAnimationFrame(() => {
            elements.root?.classList.add("is-open");
        });
        setTimeout(() => elements.input?.focus(), 50);
    }

    function closeChat() {
        isOpen = false;
        elements.root?.classList.remove("is-open");
        elements.toggle?.setAttribute("aria-expanded", "false");
        clearTimeout(closeTimer);
        closeTimer = setTimeout(() => {
            if (!isOpen) elements.panel?.setAttribute("hidden", "");
        }, 220);
    }

    function renderWelcomeMessage() {
        appendMessage("assistant", `Tenho acesso aos dados carregados da estação climática. Escolha um atalho acima ou pergunte algo como:\n${CHAT_EXAMPLES.map(item => `• ${item}`).join("\n")}`);
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (isBusy) return;

        const question = elements.input.value.trim();
        if (!question) return;

        await submitQuestion(question);
    }

    async function submitQuestion(question) {
        if (isBusy || !question) return;

        if (!isOpen) openChat();
        appendMessage("user", question);
        elements.input.value = "";
        setBusy(true);

        const thinking = appendMessage("assistant", "Analisando os dados carregados...");

        try {
            const answer = await answerQuestion(question);
            thinking.textContent = answer;
        } catch (error) {
            console.error("Falha no chat com IA:", error);
            thinking.textContent = "Não consegui consultar a IA agora. Verifique se o Firebase AI Logic e o App Check estão configurados para este domínio.";
        } finally {
            setBusy(false);
        }
    }

    async function answerQuestion(question) {
        const context = contextProvider ? contextProvider() : {};
        const intent = await resolveQuestionIntent(question, context);
        const result = executeQuery(context, intent, question);

        if (result.needsClarification) {
            return result.message;
        }

        const prompt = buildAnswerPrompt(question, result);

        try {
            const answer = await window.ClimateAIService.generateText(prompt);
            return answer;
        } catch (error) {
            console.warn("Falha ao redigir resposta com IA. Usando resposta local.", error);
            return formatResultFallback(result);
        }
    }

    function setBusy(value) {
        isBusy = value;
        elements.submit.disabled = value;
        elements.input.disabled = value;
        elements.quickActions.forEach(button => {
            button.disabled = value;
        });
    }

    function appendMessage(role, text) {
        const message = document.createElement("div");
        message.className = `ai-chat__message ai-chat__message--${role}`;
        message.textContent = text;
        elements.messages.appendChild(message);
        elements.messages.scrollTop = elements.messages.scrollHeight;
        return message;
    }

    async function resolveQuestionIntent(question, context) {
        const normalizedQuestion = normalizeText(question);
        const mentionedEnvironments = findMentionedEnvironments(normalizedQuestion);
        const fallbackEnvironment = getEnvironmentByActiveTab(context.activeTab);
        const classifiedIntent = await classifyQuestionIntent(question, context);
        const classifiedEnvironments = getEnvironmentsFromIntent(classifiedIntent);
        const period = normalizePeriod(classifiedIntent?.periodo, normalizedQuestion, context.selectedDate);
        const metrics = normalizeMetrics(classifiedIntent?.metricas || classifiedIntent?.metrica);
        const operation = normalizeOperation(classifiedIntent?.operacao, normalizedQuestion);
        const solarIntent = hasSolarIntent(normalizedQuestion) || Boolean(classifiedIntent?.solar);

        return {
            environments: mentionedEnvironments.length ? mentionedEnvironments : (classifiedEnvironments.length ? classifiedEnvironments : [fallbackEnvironment]),
            metrics,
            operation,
            period,
            criterion: normalizeText(classifiedIntent?.criterio),
            confidence: Number(classifiedIntent?.confianca) || null,
            needsClarification: Boolean(classifiedIntent?.precisa_esclarecimento),
            clarificationQuestion: classifiedIntent?.pergunta_esclarecimento || null,
            includeSolar: solarIntent,
        };
    }

    async function classifyQuestionIntent(question, context) {
        const prompt = `
Interprete a pergunta abaixo para um dashboard de estação climática. Ela pode conter erros de digitação, gírias, fala informal e português não padrão.
Responda somente JSON válido, sem markdown.

Schema obrigatório:
{
  "ambientes": ["sala" | "quarto" | "aquario"] ou [],
  "metricas": ["temperatura" | "sensacao_termica" | "umidade" | "pressao" | "ph" | "tds" | "turbidez" | "co" | "co2" | "acetona" | "alcool" | "amonia" | "tolueno"] ou [],
  "operacao": "media" | "maxima" | "minima" | "delta" | "tendencia" | "resumo" | "valor" | "comparar_dias" | "dia_mais_frio" | "dia_mais_quente" ou null,
  "periodo": {
    "tipo": "data_especifica" | "datas_relativas" | "ultimos_dias" | "intervalo" | "calendario" ou null,
    "data": "DD-MM-AAAA" | "hoje" | "ontem" | "anteontem" ou null,
    "datas": ["DD-MM-AAAA" | "hoje" | "ontem" | "anteontem"] ou [],
    "quantidade": número ou null,
    "inicio": "DD-MM-AAAA" ou null,
    "fim": "DD-MM-AAAA" ou null
  },
  "criterio": "media_diaria" | "maxima_registrada" | "minima_registrada" | "mais_quente" | "mais_frio" ou null,
  "confianca": número de 0 a 1,
  "precisa_esclarecimento": true ou false,
  "pergunta_esclarecimento": string ou null,
  "solar": true ou false
}

Regras:
- "últimos dias", "esses últimos dias" ou frase parecida significa últimos ${DEFAULT_RECENT_DAYS} dias.
- "dia mais frio" usa menor média diária, exceto se pedir explicitamente menor registro.
- "dia mais quente" usa maior média diária, exceto se pedir explicitamente maior registro.
- "ontem ou anteontem foi mais quente que hoje" deve usar operação "comparar_dias" e datas ["ontem", "anteontem", "hoje"].
- Se ambiente não aparecer, deixe "ambientes" vazio. O código usará a aba ativa.
- Se métrica não aparecer mas a pergunta falar frio/quente, use "temperatura".
- Não responda a pergunta do usuário, apenas classifique.

Data selecionada na página: ${formatDate(context.selectedDate)}
Aba ativa: ${getTabLabel(context.activeTab)}
Pergunta: ${question}
        `.trim();

        try {
            const answer = await window.ClimateAIService.generateText(prompt);
            return parseIntentJson(answer);
        } catch (error) {
            console.warn("Falha ao classificar intenção do chat. Usando fallback local.", error);
            return null;
        }
    }

    function executeQuery(context, intent, question) {
        if (intent.needsClarification) {
            return {
                needsClarification: true,
                message: intent.clarificationQuestion || "Preciso de mais detalhes para responder com segurança.",
            };
        }

        const environments = intent.environments;
        const metrics = resolveMetricsForEnvironments(environments, intent.metrics, question);
        const periodDates = resolvePeriodDates(intent.period);

        if (!environments.length) {
            return {
                needsClarification: true,
                message: "Não consegui identificar o ambiente. Você quer consultar Sala, Quarto ou Aquário?",
            };
        }

        if (!periodDates.length) {
            return {
                needsClarification: true,
                message: "Não consegui identificar o período da consulta. Tente informar uma data ou período.",
            };
        }

        const environmentResults = environments.map(environment => executeEnvironmentQuery(context, environment, metrics, periodDates, intent));
        return {
            question,
            intent: {
                environments: environments.map(environment => environment.label),
                metrics: metrics.map(metric => metric.label),
                operation: intent.operation,
                criterion: intent.criterion,
                period: {
                    label: formatPeriodLabel(periodDates),
                    dates: periodDates,
                },
                confidence: intent.confidence,
            },
            results: environmentResults,
            generatedAt: new Date().toLocaleString("pt-BR"),
        };
    }

    function executeEnvironmentQuery(context, environment, requestedMetrics, periodDates, intent) {
        const data = context.latestData?.[environment.dataKey] || {};
        const metrics = requestedMetrics.length ? requestedMetrics : [getDefaultMetric(environment)];
        const metricResults = metrics.map(metric => {
            const dailyStats = periodDates.map(date => buildDailyStats(data?.[date], metric, date)).filter(Boolean);
            return buildMetricResult(environment, metric, dailyStats, periodDates, intent);
        });

        return {
            ambiente: environment.label,
            metricas: metricResults,
        };
    }

    function buildMetricResult(environment, metric, dailyStats, periodDates, intent) {
        const allValues = dailyStats.flatMap(day => day.values);
        const base = {
            ambiente: environment.label,
            metrica: metric.label,
            unidade: metric.unit,
            operacao: intent.operation,
            criterio: intent.criterion || defaultCriterionForOperation(intent.operation),
            periodo: formatPeriodLabel(periodDates),
            datas_consultadas: periodDates.map(formatDate),
            dias_com_dados: dailyStats.map(day => day.dateLabel),
            amostras: allValues.length,
        };

        if (!allValues.length) {
            return {
                ...base,
                sem_dados: true,
                mensagem: `Sem dados de ${metric.label} em ${environment.label} para ${formatPeriodLabel(periodDates)}.`,
            };
        }

        const overallStats = calculateStats(allValues);
        const dailySummaries = dailyStats.map(day => ({
            data: day.dateLabel,
            media: round(day.stats.avg),
            minima: round(day.stats.min),
            maxima: round(day.stats.max),
            delta: round(day.stats.delta),
            amostras: day.values.length,
        }));

        return {
            ...base,
            media: round(overallStats.avg),
            minima: round(overallStats.min),
            maxima: round(overallStats.max),
            delta: round(overallStats.delta),
            tendencia: trendFromDelta(overallStats.delta),
            dia_mais_frio: pickDay(dailySummaries, "media", "min"),
            dia_mais_quente: pickDay(dailySummaries, "media", "max"),
            menor_registro: pickDay(dailySummaries, "minima", "min"),
            maior_registro: pickDay(dailySummaries, "maxima", "max"),
            comparacao: buildComparison(dailySummaries),
            por_dia: dailySummaries,
        };
    }

    function buildDailyStats(dayData, metric, date) {
        const values = extractMetricValues(dayData, metric.key);
        if (!values.length) return null;

        return {
            date,
            dateLabel: formatDate(date),
            values,
            stats: calculateStats(values),
        };
    }

    function buildAnswerPrompt(question, result) {
        const payload = JSON.stringify(result, null, 2);
        const prompt = `
Você é o assistente da página "Estação Climática".
Responda em português do Brasil, de forma curta, natural e objetiva.
Use somente o resultado calculado pelo JavaScript abaixo.
Não recalcule, não invente medições e não use conhecimento externo.
Quando relevante, cite o período usado, o critério usado e a quantidade de amostras.
Se houver comparação, explique quem venceu e por quê.

Pergunta do usuário:
${question}

Resultado calculado:
${payload}
        `.trim();

        return prompt.length > MAX_PROMPT_CHARS ? prompt.slice(0, MAX_PROMPT_CHARS) : prompt;
    }

    function formatResultFallback(result) {
        const firstMetric = result.results?.[0]?.metricas?.[0];
        if (!firstMetric) return "Não encontrei dados suficientes para responder.";
        if (firstMetric.sem_dados) return firstMetric.mensagem;

        if (firstMetric.operacao === "dia_mais_frio") {
            return `No período ${firstMetric.periodo}, o dia mais frio em ${firstMetric.ambiente} foi ${firstMetric.dia_mais_frio.data}, com média de ${formatNumber(firstMetric.dia_mais_frio.valor)}${firstMetric.unidade}.`;
        }

        if (firstMetric.operacao === "dia_mais_quente") {
            return `No período ${firstMetric.periodo}, o dia mais quente em ${firstMetric.ambiente} foi ${firstMetric.dia_mais_quente.data}, com média de ${formatNumber(firstMetric.dia_mais_quente.valor)}${firstMetric.unidade}.`;
        }

        return `${firstMetric.metrica} em ${firstMetric.ambiente}: média ${formatNumber(firstMetric.media)}${firstMetric.unidade}, mínima ${formatNumber(firstMetric.minima)}${firstMetric.unidade}, máxima ${formatNumber(firstMetric.maxima)}${firstMetric.unidade}, com ${firstMetric.amostras} amostra(s).`;
    }

    function parseIntentJson(answer) {
        const text = String(answer || "").trim();
        const jsonText = text.match(/\{[\s\S]*\}/)?.[0] || text;

        try {
            const parsed = JSON.parse(jsonText);
            return parsed && typeof parsed === "object" ? parsed : null;
        } catch (error) {
            console.warn("Intenção do chat não veio em JSON válido.", answer);
            return null;
        }
    }

    function getEnvironmentsFromIntent(intent) {
        const rawEnvironments = Array.isArray(intent?.ambientes)
            ? intent.ambientes
            : [intent?.ambiente].filter(Boolean);

        return rawEnvironments
            .map(getEnvironmentByKey)
            .filter(Boolean);
    }

    function normalizeMetrics(value) {
        const values = Array.isArray(value) ? value : [value].filter(Boolean);
        return values.map(normalizeText).filter(Boolean);
    }

    function normalizeOperation(value, normalizedQuestion) {
        const operation = normalizeText(value);
        if (operation) return operation;
        if (normalizedQuestion.includes("mais fri")) return "dia_mais_frio";
        if (normalizedQuestion.includes("mais quent")) return "dia_mais_quente";
        if (normalizedQuestion.includes("maxim")) return "maxima";
        if (normalizedQuestion.includes("minim")) return "minima";
        if (normalizedQuestion.includes("media")) return "media";
        if (normalizedQuestion.includes("diferenca") || normalizedQuestion.includes("diferença")) return "comparar_dias";
        return "resumo";
    }

    function normalizePeriod(period, normalizedQuestion, selectedDate) {
        const explicitDates = extractQuestionDates(normalizedQuestion);
        if (explicitDates.length > 1) {
            return { type: "datas", dates: explicitDates };
        }

        if (explicitDates.length === 1) {
            return { type: "datas", dates: explicitDates };
        }

        const normalizedType = normalizeText(period?.tipo);
        if (normalizedType === "ultimos_dias" || normalizedQuestion.includes("ultim") || normalizedQuestion.includes("urtim")) {
            return { type: "last_days", days: clampDays(Number(period?.quantidade) || DEFAULT_RECENT_DAYS) };
        }

        const rawDates = Array.isArray(period?.datas) ? period.datas : [];
        const classifiedDates = rawDates.map(normalizeRelativeOrExplicitDate).filter(Boolean);
        if (classifiedDates.length) {
            return { type: "datas", dates: classifiedDates };
        }

        const singleDate = normalizeRelativeOrExplicitDate(period?.data);
        if (singleDate) {
            return { type: "datas", dates: [singleDate] };
        }

        if (normalizedType === "intervalo" && period?.inicio && period?.fim) {
            return {
                type: "range",
                start: normalizeRelativeOrExplicitDate(period.inicio),
                end: normalizeRelativeOrExplicitDate(period.fim),
            };
        }

        if (hasWord(normalizedQuestion, "hoje") || hasWord(normalizedQuestion, "hj")) return { type: "datas", dates: [window.ClimateData.dataAtual()] };
        if (hasWord(normalizedQuestion, "ontem")) return { type: "datas", dates: [offsetFromToday(-1)] };
        if (hasWord(normalizedQuestion, "anteontem") || hasWord(normalizedQuestion, "antiontem")) return { type: "datas", dates: [offsetFromToday(-2)] };

        return { type: "datas", dates: [selectedDate || window.ClimateData.dataAtual()] };
    }

    function resolvePeriodDates(period) {
        if (period.type === "datas") {
            return uniqueDates(period.dates).slice(0, MAX_PERIOD_DAYS);
        }

        if (period.type === "last_days") {
            return buildLastDays(period.days);
        }

        if (period.type === "range" && period.start && period.end) {
            return buildDateRange(period.start, period.end);
        }

        return [window.ClimateData.dataAtual()];
    }

    function buildLastDays(days) {
        return Array.from({ length: clampDays(days) }, (_, index) => offsetFromToday(-(clampDays(days) - 1 - index)));
    }

    function buildDateRange(start, end) {
        const startDate = window.ClimateData.parseFirebaseDate(start);
        const endDate = window.ClimateData.parseFirebaseDate(end);
        const dates = [];
        const direction = startDate <= endDate ? 1 : -1;
        const cursor = new Date(startDate);

        while (dates.length < MAX_PERIOD_DAYS) {
            dates.push(formatFirebaseDate(cursor));
            if (formatFirebaseDate(cursor) === formatFirebaseDate(endDate)) break;
            cursor.setDate(cursor.getDate() + direction);
        }

        return dates;
    }

    function extractQuestionDates(normalizedQuestion) {
        const dates = [];
        const matches = normalizedQuestion.matchAll(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/g);
        for (const match of matches) {
            const [, day, month, year] = match;
            dates.push(`${day.padStart(2, "0")}-${month.padStart(2, "0")}-${year}`);
        }

        if (hasWord(normalizedQuestion, "anteontem") || hasWord(normalizedQuestion, "antiontem")) dates.push(offsetFromToday(-2));
        if (hasWord(normalizedQuestion, "ontem")) dates.push(offsetFromToday(-1));
        if (hasWord(normalizedQuestion, "hoje") || hasWord(normalizedQuestion, "hj")) dates.push(window.ClimateData.dataAtual());

        return uniqueDates(dates);
    }

    function normalizeRelativeOrExplicitDate(value) {
        const normalizedValue = normalizeText(value).trim();
        if (!normalizedValue) return null;

        const explicitDate = normalizedValue.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
        if (explicitDate) {
            const [, day, month, year] = explicitDate;
            return `${day.padStart(2, "0")}-${month.padStart(2, "0")}-${year}`;
        }

        if (normalizedValue === "hoje") return window.ClimateData.dataAtual();
        if (normalizedValue === "ontem") return offsetFromToday(-1);
        if (normalizedValue === "anteontem" || normalizedValue === "antiontem") return offsetFromToday(-2);

        return null;
    }

    function resolveMetricsForEnvironments(environments, requestedMetrics, question) {
        const normalizedQuestion = normalizeText(question);
        const requested = requestedMetrics.length ? requestedMetrics : inferMetricsFromQuestion(normalizedQuestion);
        const metrics = [];

        for (const environment of environments) {
            for (const metric of environment.metrics.map(toMetricObject)) {
                if (!requested.length || requested.some(value => metricMatches(metric, value))) {
                    metrics.push(metric);
                }
            }
        }

        return uniqueMetrics(metrics.length ? metrics : environments.map(getDefaultMetric));
    }

    function inferMetricsFromQuestion(normalizedQuestion) {
        if (normalizedQuestion.includes("fri") || normalizedQuestion.includes("quent") || normalizedQuestion.includes("calor")) {
            return ["temperatura"];
        }

        if (normalizedQuestion.includes("umid") || normalizedQuestion.includes("humid")) return ["umidade"];
        if (normalizedQuestion.includes("press")) return ["pressao"];
        if (normalizedQuestion.includes("toluen")) return ["tolueno"];
        if (normalizedQuestion.includes("ph")) return ["ph"];
        if (normalizedQuestion.includes("tds")) return ["tds"];
        if (normalizedQuestion.includes("turb")) return ["turbidez"];
        return [];
    }

    function metricMatches(metric, requestedMetric) {
        const requested = normalizeText(requestedMetric).replace(/_/g, " ");
        const aliases = [
            metric.label,
            metric.key,
            ...(METRIC_ALIASES[metric.key] || []),
        ].map(value => normalizeText(value).replace(/_/g, " "));

        return aliases.some(alias => alias === requested || alias.includes(requested) || requested.includes(alias));
    }

    function toMetricObject(metric) {
        return {
            label: metric[0],
            key: metric[1],
            unit: metric[2],
        };
    }

    function getDefaultMetric(environment) {
        return toMetricObject(environment.metrics[0]);
    }

    function uniqueMetrics(metrics) {
        const seen = new Set();
        return metrics.filter(metric => {
            const key = metric.key;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function defaultCriterionForOperation(operation) {
        if (operation === "dia_mais_frio" || operation === "dia_mais_quente" || operation === "comparar_dias") return "media_diaria";
        if (operation === "maxima") return "maxima_registrada";
        if (operation === "minima") return "minima_registrada";
        return "valores_registrados";
    }

    function pickDay(dailySummaries, field, mode) {
        if (!dailySummaries.length) return null;
        const sorted = [...dailySummaries].sort((a, b) => mode === "min" ? a[field] - b[field] : b[field] - a[field]);
        return {
            data: sorted[0].data,
            valor: sorted[0][field],
            amostras: sorted[0].amostras,
        };
    }

    function buildComparison(dailySummaries) {
        if (dailySummaries.length < 2) return null;
        const byAverage = [...dailySummaries].sort((a, b) => b.media - a.media);
        const todayLabel = formatDate(window.ClimateData.dataAtual());
        const today = dailySummaries.find(day => day.data === todayLabel);

        return {
            mais_quente_por_media: {
                data: byAverage[0].data,
                media: byAverage[0].media,
            },
            mais_frio_por_media: {
                data: byAverage[byAverage.length - 1].data,
                media: byAverage[byAverage.length - 1].media,
            },
            hoje: today || null,
            dias_mais_quentes_que_hoje: today ? dailySummaries.filter(day => day.media > today.media).map(day => ({
                data: day.data,
                media: day.media,
                diferenca: round(day.media - today.media),
            })) : [],
        };
    }

    function trendFromDelta(delta) {
        if (Math.abs(delta) < 0.05) return "estável";
        return delta > 0 ? "subindo" : "caindo";
    }

    function round(value) {
        return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
    }

    function clampDays(days) {
        if (!Number.isFinite(days) || days <= 0) return DEFAULT_RECENT_DAYS;
        return Math.min(Math.max(Math.round(days), 1), MAX_PERIOD_DAYS);
    }

    function uniqueDates(dates) {
        return [...new Set(dates.filter(Boolean))];
    }

    function formatFirebaseDate(date) {
        return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
    }

    function formatPeriodLabel(dates) {
        if (!dates.length) return "--";
        if (dates.length === 1) return formatDate(dates[0]);
        return `${formatDate(dates[0])} a ${formatDate(dates[dates.length - 1])}`;
    }

    function findMentionedEnvironments(normalizedQuestion) {
        return Object.values(ENVIRONMENTS).filter(environment => (
            environment.aliases.some(alias => hasWord(normalizedQuestion, normalizeText(alias)))
        ));
    }

    function getEnvironmentByKey(key) {
        const normalizedKey = normalizeText(key);
        if (!normalizedKey) return null;
        return ENVIRONMENTS[normalizedKey] || null;
    }

    function getEnvironmentByActiveTab(activeTab) {
        return Object.values(ENVIRONMENTS).find(environment => environment.activeTab === activeTab) || ENVIRONMENTS.sala;
    }

    function offsetFromToday(dayOffset) {
        const date = window.ClimateData.parseFirebaseDate(window.ClimateData.dataAtual());
        date.setDate(date.getDate() + dayOffset);
        return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
    }

    function hasSolarIntent(normalizedQuestion) {
        return ["solar", "sol", "nascer", "por do sol", "pôr do sol", "zenite", "zênite", "amanhecer", "anoitecer"]
            .some(term => normalizedQuestion.includes(normalizeText(term)));
    }

    function hasWord(text, word) {
        return new RegExp(`(^|\\W)${escapeRegExp(word)}(\\W|$)`, "i").test(text);
    }

    function normalizeText(text) {
        return String(text || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
    }

    function escapeRegExp(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function extractMetricValues(dayData, key) {
        const values = [];
        for (const time of Object.keys(dayData || {}).sort()) {
            const timeData = dayData[time];
            if (!timeData || typeof timeData !== "object") continue;
            for (const itemKey of Object.keys(timeData).sort()) {
                const item = timeData[itemKey];
                if (!item || typeof item !== "object") continue;
                const value = window.ClimateData.normalizeMeasurementValue(key, item[key]);
                if (value !== null) values.push(value);
            }
        }
        return values;
    }

    function calculateStats(values) {
        const first = values[0];
        const last = values[values.length - 1];
        return {
            avg: values.reduce((sum, value) => sum + value, 0) / values.length,
            min: Math.min(...values),
            max: Math.max(...values),
            delta: last - first,
        };
    }

    function getTabLabel(tabId) {
        return { Tab1: "Sala", Tab2: "Quarto", Tab3: "Aquário" }[tabId] || tabId || "--";
    }

    function formatDate(firebaseDate) {
        return firebaseDate ? firebaseDate.replace(/-/g, "/") : "--";
    }

    function formatNumber(value) {
        return Number.isFinite(value) ? value.toFixed(2) : "--";
    }

    window.ClimateChat = { setup };
})();
