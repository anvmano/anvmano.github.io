'use strict';

(function () {
    const scriptsCarregados = new Map();
    const estilosCarregados = new Map();

    const VERSOES = {
        chartJs: "4.5.1",
        chat: "20260614-3",
        pdf: "20260622-5",
        css: "20260623-4",
        zoomCss: "20260816-1",
    };

    const MODULOS_ASSISTENTE = [
        "scripts/assistant/ai-service.js?v=20260614-1",
        "scripts/assistant/assistant-config.js?v=20260614-1",
        "scripts/assistant/assistant-format.js?v=20260614-1",
        "scripts/assistant/assistant-solar.js?v=20260816-2",
        "scripts/assistant/assistant-aqi.js?v=20260614-1",
        "scripts/assistant/assistant-metrics.js?v=20260816-2",
        "scripts/assistant/assistant-intent.js?v=20260816-2",
        "scripts/assistant/assistant-planner.js?v=20260816-2",
        "scripts/assistant/assistant-query.js?v=20260816-2",
        "scripts/assistant/assistant-ui.js?v=20260816-1",
    ];

    const MODULOS_RELATORIO = [
        "scripts/reports/pdf-report-config.js?v=20260612-1",
        "scripts/reports/pdf-report-format.js?v=20260612-1",
        "scripts/reports/pdf-report-data.js?v=20260922-3",
        "scripts/reports/pdf-report-dom.js?v=20260622-1",
        "scripts/reports/pdf-report-charts.js?v=20260922-3",
        "scripts/reports/pdf-report-pdf.js?v=20260816-1",
        "scripts/reports/pdf-report-export.js?v=20260922-3",
    ];

    function carregarScriptUmaVez(url, validarGlobal) {
        if (typeof validarGlobal === "function" && validarGlobal()) return Promise.resolve();
        if (scriptsCarregados.has(url)) return scriptsCarregados.get(url);

        const carregamento = new Promise((resolver, rejeitar) => {
            const existente = document.querySelector(`script[src="${url}"]`);
            if (existente) {
                if (existente.dataset.carregado === "true" || existente.sheet) {
                    resolver();
                    return;
                }
                existente.addEventListener("load", resolver, { once: true });
                existente.addEventListener("error", rejeitar, { once: true });
                return;
            }

            const script = document.createElement("script");
            script.src = url;
            script.async = false;
            script.onload = resolver;
            script.onerror = () => rejeitar(new Error(`Falha ao carregar ${url}.`));
            document.head.appendChild(script);
        });

        scriptsCarregados.set(url, carregamento);
        return carregamento;
    }

    function carregarCssUmaVez(url, id) {
        const chave = id || url;
        if (estilosCarregados.has(chave)) return estilosCarregados.get(chave);
        if (id && document.getElementById(id)) return Promise.resolve();

        const carregamento = new Promise((resolver, rejeitar) => {
            const existente = document.querySelector(`link[href="${url}"]`);
            if (existente) {
                if (existente.dataset.carregado === "true" || existente.sheet) {
                    resolver();
                    return;
                }
                existente.addEventListener("load", resolver, { once: true });
                existente.addEventListener("error", rejeitar, { once: true });
                return;
            }

            const ligacao = document.createElement("link");
            if (id) ligacao.id = id;
            ligacao.rel = "stylesheet";
            ligacao.href = url;
            ligacao.onload = () => {
                ligacao.dataset.carregado = "true";
                resolver();
            };
            ligacao.onerror = () => rejeitar(new Error(`Falha ao carregar ${url}.`));
            document.head.appendChild(ligacao);
        });

        estilosCarregados.set(chave, carregamento);
        return carregamento;
    }

    function carregarSequencialmente(urls) {
        return urls.reduce((fila, url) => fila.then(() => carregarScriptUmaVez(url)), Promise.resolve());
    }

    function carregarChart() {
        const url = `https://cdn.jsdelivr.net/npm/chart.js@${VERSOES.chartJs}/dist/chart.umd.min.js`;
        return carregarScriptUmaVez(url, () => !!window.Chart).then(() => window.Chart);
    }

    function carregarAssistente() {
        return carregarCssUmaVez(`styles/chat.css?v=${VERSOES.css}`, "climate-chat-css")
            .then(() => carregarSequencialmente(MODULOS_ASSISTENTE));
    }

    function carregarRelatorio() {
        return carregarSequencialmente(MODULOS_RELATORIO);
    }

    function carregarCssRelatorio() {
        return carregarCssUmaVez("styles/reports/pdf-report.css?v=20260816-1", "climate-pdf-css");
    }

    function carregarCssZoom() {
        return carregarCssUmaVez(`styles/zoom.css?v=${VERSOES.zoomCss}`, "climate-zoom-css");
    }

    function executarQuandoOcioso(aoConcluir, tempoLimite = 800) {
        if (typeof window.requestIdleCallback === "function") {
            window.requestIdleCallback(aoConcluir, { timeout: tempoLimite });
            return;
        }
        window.setTimeout(aoConcluir, Math.min(tempoLimite, 250));
    }

    window.ClimateAssets = {
        carregarAssistente,
        carregarChart,
        carregarCssRelatorio,
        carregarCssZoom,
        carregarCssUmaVez,
        carregarRelatorio,
        executarQuandoOcioso,
    };
})();
