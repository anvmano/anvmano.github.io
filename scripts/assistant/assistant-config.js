'use strict';

(function () {
    const namespace = window.ClimateAssistant || {};

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
                ["Ciclo solar", "cicloSolar", ""],
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
                ["Ciclo solar", "cicloSolar", ""],
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
                ["Ciclo solar", "cicloSolar", ""],
            ],
        },
    };

    namespace.config = {
        MAX_PROMPT_CHARS,
        DEFAULT_RECENT_DAYS,
        MAX_PERIOD_DAYS,
        CHAT_EXAMPLES,
        METRIC_ALIASES,
        ENVIRONMENTS,
    };

    window.ClimateAssistant = namespace;
})();
