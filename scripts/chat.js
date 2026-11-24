'use strict';

(function () {
    let opcoesConfiguradas = null;
    let assistentePronta = false;
    let carregamentoAssistente = null;
    let geracaoSessao = 0;
    let sessaoAtiva = true;

    function configurar(opcoes = {}) {
        opcoesConfiguradas = {
            ...opcoes,
            getContext: () => {
                const contexto = opcoes.getContext?.() || {};
                if (!window.ClimateContracts?.validarContextoAssistente?.(contexto)) {
                    throw new TypeError("Contexto da assistente inválido.");
                }
                return contexto;
            },
        };

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
        botao.addEventListener("click", abrirAssistenteSobDemanda);
    }

    async function abrirAssistenteSobDemanda(evento) {
        if (assistentePronta || !sessaoAtiva) return;
        const geracao = geracaoSessao;
        evento.preventDefault();
        evento.stopPropagation();

        const botao = document.getElementById("aiChatToggle");
        if (botao) {
            botao.disabled = true;
            botao.setAttribute("aria-busy", "true");
        }

        try {
            await carregarAssistente();
            if (!sessaoAtiva || geracao !== geracaoSessao) return;
            inicializarAssistente();
            window.ClimateAssistant?.ui?.open();
        } catch (erro) {
            if (!sessaoAtiva || geracao !== geracaoSessao) return;
            window.ClimateDiagnostics?.erro("Falha ao carregar assistente.", erro);
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
            carregamentoAssistente = (window.ClimateAssets?.carregarAssistente?.() || Promise.reject(new Error("Carregador da assistente indisponível.")))
                .catch(erro => { carregamentoAssistente = null; throw erro; });
        }
        return carregamentoAssistente;
    }

    function inicializarAssistente() {
        if (assistentePronta) return;
        if (!window.ClimateAssistant?.ui) return;
        window.ClimateAssistant.ui.setup(opcoesConfiguradas || {});
        assistentePronta = true;
    }

    function encerrarSessao() {
        sessaoAtiva = false;
        geracaoSessao++;
        window.ClimateAssistant?.ui?.encerrarSessao();
    }

    function iniciarSessao() {
        sessaoAtiva = true;
        window.ClimateAssistant?.ui?.iniciarSessao();
    }

    window.ClimateChat = { setup: configurar, encerrarSessao, iniciarSessao };
})();
