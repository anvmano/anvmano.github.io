'use strict';

(function () {
    const espacoNomes = window.ClimateAssistant || {};

    const MAX_CARACTERES_INSTRUCAO = 9000;
    const DIAS_RECENTES_PADRAO = 7;
    const MAX_DIAS_PERIODO = 30;
    const EXEMPLOS_CONVERSA = [
        "Qual foi a temperatura média hoje?",
        "Qual a máxima do aquário na data selecionada?",
        "A umidade ficou dentro da faixa?",
    ];

    const ALIASES_METRICAS = {
        temperatura: ["temperatura", "temp", "frio", "quente", "calor"],
        temperaturaDS18B20: ["temperatura", "temp", "frio", "quente", "calor"],
        "Sensacao termica": ["sensacao", "sensacao termica", "sensação térmica"],
        sensacaoTermica: ["sensacao", "sensacao termica", "sensação térmica"],
        Umidade: ["umidade", "humidade", "humidad"],
        umidade: ["umidade", "humidade", "humidad"],
        pressao: ["pressao", "pressão", "hpa"],
        cicloSolar: ["ciclo solar", "solar", "sol", "nascer do sol", "por do sol", "pôr do sol", "zenite", "zênite", "amanhecer", "anoitecer", "dia solar", "fotoperiodo", "fotoperíodo"],
        qualidadeAr: ["aqi", "iaq", "qualidade do ar", "qualidade ar", "indice de qualidade do ar", "índice de qualidade do ar", "indice do ar", "ar da sala"],
        CO: ["co", "monoxido de carbono", "monóxido de carbono", "monoxido", "monóxido"],
        CO2: ["co2", "dioxido de carbono", "dióxido de carbono", "gas carbonico", "gás carbônico"],
        Aceton: ["acetona", "aceton"],
        Alcohol: ["alcool", "álcool", "alcohol"],
        NH4: ["amonia", "amônia", "nh4"],
        Toluen: ["tolueno", "toluen"],
        PH: ["ph"],
        TDS: ["tds", "solidos", "sólidos"],
        Turbidez: ["turbidez", "ntu"],
    };

    const AMBIENTES = {
        estacao: {
            label: "Estação",
            dataKey: "solar",
            aliases: ["estacao", "estação", "geral", "global"],
            activeTab: "Tab0",
            metrics: [
                ["Ciclo solar", "cicloSolar", ""],
            ],
        },
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
                ["AQI estimado", "qualidadeAr", ""],
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

    espacoNomes.config = {
        MAX_PROMPT_CHARS: MAX_CARACTERES_INSTRUCAO,
        DEFAULT_RECENT_DAYS: DIAS_RECENTES_PADRAO,
        MAX_PERIOD_DAYS: MAX_DIAS_PERIODO,
        CHAT_EXAMPLES: EXEMPLOS_CONVERSA,
        METRIC_ALIASES: ALIASES_METRICAS,
        ENVIRONMENTS: AMBIENTES,
    };

    window.ClimateAssistant = espacoNomes;
})();
