'use strict';

(function () {
    let opcoesConfiguradas = null;
    let assistentePronta = false;
    let carregamentoAssistente = null;

    function configurar(opcoes = {}) {
        opcoesConfiguradas = opcoes;

        if (window.ClimateAssistant?.ui) {
            inicializarAssistente();
            return;
        }

        configurarAberturaSobDemanda();
    }

    function configurarAberturaSobDemanda() {
        const botao = document.getElementById("aiChatToggle");
        if (!botao || botao.dataset.lazyChatReady === "true") return;

        botao.dataset.lazyChatReady = "true";
        botao.addEventListener("click", abrirAssistenteSobDemanda, { once: true });
    }

    async function abrirAssistenteSobDemanda(event) {
        event.preventDefault();
        event.stopPropagation();

        const botao = document.getElementById("aiChatToggle");
        if (botao) {
            botao.disabled = true;
            botao.setAttribute("aria-busy", "true");
        }

        try {
            await carregarAssistente();
            inicializarAssistente();
            window.setTimeout(() => botao?.click(), 0);
        } catch (error) {
            window.ClimateDiagnostics?.erro("Falha ao carregar assistente.", error);
            alert("Não foi possível carregar a assistente agora.");
        } finally {
            if (botao) {
                botao.disabled = false;
                botao.removeAttribute("aria-busy");
            }
        }
    }

    function carregarAssistente() {
        if (window.ClimateAssistant?.ui) return Promise.resolve();
        if (!carregamentoAssistente) {
            carregamentoAssistente = window.ClimateAssets?.carregarAssistente?.() || Promise.reject(new Error("Carregador da assistente indisponível."));
        }
        return carregamentoAssistente;
    }

    function inicializarAssistente() {
        if (assistentePronta) return;
        if (!window.ClimateAssistant?.ui) return;
        window.ClimateAssistant.ui.setup(opcoesConfiguradas || {});
        assistentePronta = true;
    }

    window.ClimateChat = { setup: configurar };
})();
