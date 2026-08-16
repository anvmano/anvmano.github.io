'use strict';

(function () {
    const namespace = window.ClimateAssistant || {};
    const {
        normalizeText,
        hasWord,
        formatFirebaseDate,
    } = namespace.format;
    const { ENVIRONMENTS } = namespace.config;

    function planejarIntencaoPergunta(intencao, pergunta, contexto = {}) {
        const perguntaNormalizada = normalizeText(pergunta);
        let plano = { ...intencao };

        plano = aplicarMemoriaCurta(plano, perguntaNormalizada, contexto?.chatMemory);
        plano = aplicarAtalhosContextuais(plano, perguntaNormalizada, contexto);
        plano = aplicarOperacaoDeterministica(plano, perguntaNormalizada);
        plano = aplicarConsultaSolarExtrema(plano, perguntaNormalizada, contexto);
        plano = aplicarConsultaDeUltimaMedicao(plano, perguntaNormalizada);
        plano = aplicarComparacaoEntreDias(plano, perguntaNormalizada);

        return plano;
    }

    function aplicarAtalhosContextuais(plano, perguntaNormalizada, contexto) {
        const pedeResumo = perguntaNormalizada.includes("resumo da data")
            || perguntaNormalizada.includes("resumo dos dados")
            || perguntaNormalizada === "resumo";
        const pedeAlertas = perguntaNormalizada.includes("alerta")
            || perguntaNormalizada.includes("indicadores ficaram fora")
            || perguntaNormalizada.includes("indicadores estao fora");
        const pedeMediaTemperatura = perguntaNormalizada.includes("temperatura media da data selecionada");
        const pedeMaximaTemperatura = perguntaNormalizada.includes("temperatura maxima da data selecionada");
        if (!pedeResumo && !pedeAlertas && !pedeMediaTemperatura && !pedeMaximaTemperatura) return plano;

        const abaEstacao = contexto?.activeTab === "Tab0";
        const atalhoTemperatura = pedeMediaTemperatura || pedeMaximaTemperatura;
        const ambientes = abaEstacao
            ? (atalhoTemperatura || pedeAlertas
                ? [ENVIRONMENTS.sala, ENVIRONMENTS.quarto, ENVIRONMENTS.aquario]
                : (pedeResumo
                ? [ENVIRONMENTS.estacao, ENVIRONMENTS.sala, ENVIRONMENTS.quarto, ENVIRONMENTS.aquario]
                : [ENVIRONMENTS.sala, ENVIRONMENTS.quarto, ENVIRONMENTS.aquario]))
            : plano.environments;

        return {
            ...plano,
            environments: ambientes,
            metrics: atalhoTemperatura
                ? ["temperatura"]
                : pedeAlertas
                ? ["temperatura", "sensacao_termica", "umidade"]
                : ["temperatura", "sensacao_termica", "umidade", "pressao", "qualidade_ar", "ph", "tds", "turbidez", "ciclo_solar"],
            operation: pedeMediaTemperatura
                ? "media"
                : pedeMaximaTemperatura
                    ? "maxima"
                    : pedeAlertas ? "status_faixa" : "resumo",
            needsClarification: false,
            clarificationQuestion: null,
        };
    }

    function aplicarOperacaoDeterministica(plano, perguntaNormalizada) {
        if (temIntencaoFaixa(perguntaNormalizada)) return { ...plano, operation: "status_faixa" };

        const operacaoHoraria = obterOperacaoHoraria(perguntaNormalizada);
        if (operacaoHoraria) return { ...plano, operation: operacaoHoraria };

        if (perguntaNormalizada.includes("tendencia") || perguntaNormalizada.includes("subindo") || perguntaNormalizada.includes("caindo")) {
            return { ...plano, operation: "tendencia" };
        }
        if (perguntaNormalizada.includes("variou") || perguntaNormalizada.includes("variacao") || perguntaNormalizada.includes("delta")) {
            return { ...plano, operation: "delta" };
        }
        if (perguntaNormalizada.includes("maxim") || perguntaNormalizada.includes("mais alta") || perguntaNormalizada.includes("maior valor")) {
            return { ...plano, operation: "maxima" };
        }
        if (perguntaNormalizada.includes("minim") || perguntaNormalizada.includes("mais baixa") || perguntaNormalizada.includes("menor valor")) {
            return { ...plano, operation: "minima" };
        }
        if (perguntaNormalizada.includes("media")) return { ...plano, operation: "media" };

        return plano;
    }

    function temIntencaoFaixa(perguntaNormalizada) {
        return ["faixa", "conforto", "ideal", "quantas horas fora", "pior horario fora"]
            .some(termo => perguntaNormalizada.includes(termo));
    }

    function obterOperacaoHoraria(perguntaNormalizada) {
        const pedeHorario = ["qual horario", "qual foi o horario", "que horario", "em qual horario", "qual hora", "qual foi a hora", "que hora"]
            .some(termo => perguntaNormalizada.includes(termo));
        if (!pedeHorario) return null;
        if (["mais quent", "maior", "maxim", "mais alto", "pico"].some(termo => perguntaNormalizada.includes(termo))) {
            return "horario_maior_valor";
        }
        if (["mais fri", "menor", "minim", "mais baixo"].some(termo => perguntaNormalizada.includes(termo))) {
            return "horario_menor_valor";
        }
        return null;
    }

    function aplicarMemoriaCurta(plano, perguntaNormalizada, memoria) {
        if (!memoria || !pareceContinuidade(perguntaNormalizada)) return plano;

        return {
            ...plano,
            environments: deveHerdarAmbiente(plano, perguntaNormalizada) ? [...(memoria.environments || [])] : plano.environments,
            metrics: plano.metrics?.length ? plano.metrics : [...(memoria.metrics || [])],
            operation: deveHerdarOperacao(plano, perguntaNormalizada) ? memoria.operation : plano.operation,
            period: deveHerdarPeriodo(plano, perguntaNormalizada) ? memoria.period : plano.period,
            hour: plano.hour || memoria.hour || null,
            hourRange: plano.hourRange || memoria.hourRange || null,
            needsClarification: false,
            clarificationQuestion: null,
        };
    }

    function deveHerdarAmbiente(plano, perguntaNormalizada) {
        if (!plano.environments?.length) return true;
        return ![
            "sala",
            "quarto",
            "estacao",
            "estação",
            "aquario",
            "aquário",
        ].some(termo => hasWord(perguntaNormalizada, normalizeText(termo)));
    }

    function pareceContinuidade(perguntaNormalizada) {
        return [
            "e ",
            "e no ",
            "e na ",
            "e em ",
            "tambem",
            "também",
            "agora no",
            "agora na",
        ].some(prefixo => perguntaNormalizada.startsWith(normalizeText(prefixo)))
            || [
                "no quarto",
                "na sala",
                "na estacao",
                "na estação",
                "no aquario",
                "no aquário",
                "ontem",
                "anteontem",
                "antiontem",
            ].some(termo => perguntaNormalizada === normalizeText(termo));
    }

    function deveHerdarOperacao(plano, perguntaNormalizada) {
        if (!plano.operation || plano.operation === "resumo") return true;
        if (plano.operation === "ultima_medicao" && !temIntencaoUltimaMedicao(perguntaNormalizada)) return false;
        return false;
    }

    function deveHerdarPeriodo(plano, perguntaNormalizada) {
        const mencionaTempo = [
            "hoje",
            "hj",
            "ontem",
            "anteontem",
            "antiontem",
            "ultim",
            "urtim",
        ].some(termo => perguntaNormalizada.includes(normalizeText(termo)))
            || /\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/.test(perguntaNormalizada);

        return !mencionaTempo && Boolean(plano.period);
    }

    function aplicarConsultaSolarExtrema(plano, perguntaNormalizada, contexto) {
        const pedeDiaMaisLongo = perguntaNormalizada.includes("dia mais long")
            || perguntaNormalizada.includes("dia com mais tempo de luz");
        const pedeDiaMaisCurto = perguntaNormalizada.includes("dia mais curt")
            || perguntaNormalizada.includes("dia com menos tempo de luz");

        if (!pedeDiaMaisLongo && !pedeDiaMaisCurto) return plano;

        return {
            ...plano,
            environments: [ENVIRONMENTS.estacao],
            metrics: ["ciclo_solar"],
            operation: pedeDiaMaisCurto ? "solar_menor_duracao_luz" : "solar_maior_duracao_luz",
            period: montarPeriodoSolarExtremo(perguntaNormalizada, contexto?.selectedDate),
            needsClarification: false,
            clarificationQuestion: null,
        };
    }

    function aplicarConsultaDeUltimaMedicao(plano, perguntaNormalizada) {
        if (!temIntencaoUltimaMedicao(perguntaNormalizada)) return plano;

        return {
            ...plano,
            operation: "ultima_medicao",
            needsClarification: false,
            clarificationQuestion: null,
        };
    }

    function aplicarComparacaoEntreDias(plano, perguntaNormalizada) {
        if (!temIntencaoComparacaoEntreDias(perguntaNormalizada)) {
            return plano.operation === "comparar_dias" ? { ...plano, operation: "delta" } : plano;
        }

        return {
            ...plano,
            operation: "comparar_dias",
            needsClarification: false,
            clarificationQuestion: null,
        };
    }

    function temIntencaoComparacaoEntreDias(perguntaNormalizada) {
        const diasRelativos = [
            "hoje",
            "hj",
            "ontem",
            "anteontem",
            "antiontem",
        ].filter(termo => hasWord(perguntaNormalizada, normalizeText(termo)));
        const datasExplicitas = [...perguntaNormalizada.matchAll(/\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/g)];
        const quantidadeReferencias = new Set(diasRelativos).size + datasExplicitas.length;
        const pedeComparacaoExplicitamente = ["compar", "diferenca", "diferença"]
            .some(termo => perguntaNormalizada.includes(normalizeText(termo)));

        return quantidadeReferencias >= 2 || pedeComparacaoExplicitamente;
    }

    function temIntencaoUltimaMedicao(perguntaNormalizada) {
        const pedeValorAtual = [
            "agora",
            "atual",
            "atualmente",
            "nesse momento",
            "neste momento",
            "ultima medicao",
            "ultima medição",
            "ultimo valor",
            "último valor",
            "valor atual",
        ].some(termo => perguntaNormalizada.includes(normalizeText(termo)));
        if (pedeValorAtual) return true;

        const pedeValorSimples = [
            "qual o",
            "qual a",
            "quanto esta",
            "quanto está",
            "quanto ta",
            "quanto tá",
        ].some(termo => perguntaNormalizada.includes(normalizeText(termo)));
        if (!pedeValorSimples) return false;

        return ![
            "media",
            "média",
            "maxim",
            "minim",
            "tendencia",
            "tendência",
            "delta",
            "diferenca",
            "diferença",
            "faixa",
            "conforto",
            "horario",
            "horário",
            "dia mais",
            "ultimas",
            "últimas",
            "ultimos",
            "últimos",
        ].some(termo => perguntaNormalizada.includes(normalizeText(termo)));
    }

    function montarPeriodoSolarExtremo(perguntaNormalizada, dataSelecionada) {
        const dataMes = obterDataMesMencionado(perguntaNormalizada, dataSelecionada);
        if (dataMes) return { type: "selected_month", selectedDate: dataMes };

        return { type: "selected_year", selectedDate: obterDataAnoMencionado(perguntaNormalizada, dataSelecionada) };
    }

    function obterDataMesMencionado(perguntaNormalizada, dataSelecionada) {
        const indiceMes = obterIndiceMesMencionado(perguntaNormalizada);
        if (indiceMes === null) return null;

        const selecionada = window.ClimateData.parseFirebaseDate(dataSelecionada || window.ClimateData.dataAtual());
        const ano = obterAnoMencionado(perguntaNormalizada) || selecionada.getFullYear();
        return formatFirebaseDate(new Date(ano, indiceMes, 1));
    }

    function obterDataAnoMencionado(perguntaNormalizada, dataSelecionada) {
        const selecionada = window.ClimateData.parseFirebaseDate(dataSelecionada || window.ClimateData.dataAtual());
        const ano = obterAnoMencionado(perguntaNormalizada) || selecionada.getFullYear();
        return formatFirebaseDate(new Date(ano, selecionada.getMonth(), selecionada.getDate()));
    }

    function obterAnoMencionado(perguntaNormalizada) {
        const resultado = perguntaNormalizada.match(/\b(20\d{2})\b/);
        return resultado ? Number(resultado[1]) : null;
    }

    function obterIndiceMesMencionado(perguntaNormalizada) {
        const meses = [
            ["janeiro", "jan"],
            ["fevereiro", "fev"],
            ["marco", "março", "mar"],
            ["abril", "abr"],
            ["maio", "mai"],
            ["junho", "jun"],
            ["julho", "jul"],
            ["agosto", "ago"],
            ["setembro", "set"],
            ["outubro", "out"],
            ["novembro", "nov"],
            ["dezembro", "dez"],
        ];

        const indice = meses.findIndex(aliases => aliases.some(alias => hasWord(perguntaNormalizada, normalizeText(alias))));
        return indice >= 0 ? indice : null;
    }

    namespace.planner = {
        planQuestionIntent: planejarIntencaoPergunta,
    };
    window.ClimateAssistant = namespace;
})();
