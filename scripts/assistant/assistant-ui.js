'use strict';

(function () {
    const espacoNomes = window.ClimateAssistant || {};
    const { CHAT_EXAMPLES: EXEMPLOS_CONVERSA } = espacoNomes.config;

    let obterContexto = null;
    let elementos = {};
    let estaAberto = false;
    let estaOcupado = false;
    let temporizadorFechamento = null;
    let posicaoRolagemTravada = 0;
    let memoriaConversa = null;
    let focoAnterior = null;
    const elementosInertes = new Map();

    function configurar(opcoes = {}) {
        obterContexto = opcoes.getContext;
        elementos = coletarElementos();
        if (!elementos.toggle || !elementos.panel || !elementos.form || !elementos.input || !elementos.messages) return;

        elementos.toggle.addEventListener("click", alternarChat);
        elementos.close?.addEventListener("click", fecharChat);
        elementos.form.addEventListener("submit", aoEnviarFormulario);
        document.addEventListener("pointerdown", aoPressionarFora);
        document.addEventListener("keydown", aoPressionarTecla);
        document.addEventListener("focusin", conterFoco);
        window.addEventListener("resize", atualizarViewport);
        window.visualViewport?.addEventListener("resize", atualizarViewport);
        window.visualViewport?.addEventListener("scroll", atualizarViewport);
        elementos.quickActions.forEach(botao => {
            botao.addEventListener("click", () => enviarPergunta(botao.dataset.chatQuestion));
        });
        renderizarMensagemInicial();
    }

    function coletarElementos() {
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
            shortcuts: document.getElementById("aiChatShortcuts"),
        };
    }

    function alternarChat() {
        estaAberto ? fecharChat() : abrirChat();
    }

    function abrirChat() {
        if (estaAberto) return;
        focoAnterior = document.activeElement;
        estaAberto = true;
        clearTimeout(temporizadorFechamento);
        travarRolagemPagina();
        elementos.toggle?.setAttribute("aria-expanded", "true");
        elementos.panel?.removeAttribute("hidden");
        elementos.panel.inert = false;
        atualizarViewport();
        // Torna inativos os irmaos de cada ancestral, sem desativar o dialogo.
        for (let ramo = elementos.panel; ramo && ramo !== document.body; ramo = ramo.parentElement) {
            for (const irmao of ramo.parentElement.children) {
                if (irmao === ramo) continue;
                elementosInertes.set(irmao, irmao.inert);
                irmao.inert = true;
            }
        }
        requestAnimationFrame(() => {
            if (!estaAberto) return;
            elementos.root?.classList.add("is-open");
            const foco = window.matchMedia("(pointer: coarse)").matches || estaOcupado
                ? elementos.close : elementos.input;
            foco?.focus({ preventScroll: true });
        });
    }

    function fecharChat() {
        if (!estaAberto) return;
        estaAberto = false;
        elementos.panel.inert = true;
        elementosInertes.forEach((valor, elemento) => { elemento.inert = valor; });
        elementosInertes.clear();
        elementos.root?.classList.remove("is-open");
        elementos.toggle?.setAttribute("aria-expanded", "false");
        liberarRolagemPagina();
        const destino = focoAnterior?.isConnected && focoAnterior !== document.body && !focoAnterior.closest("[inert]")
            ? focoAnterior : elementos.toggle;
        destino?.focus({ preventScroll: true });
        clearTimeout(temporizadorFechamento);
        temporizadorFechamento = setTimeout(() => {
            if (!estaAberto) elementos.panel?.setAttribute("hidden", "");
        }, 220);
    }

    function atualizarViewport() {
        if (!estaAberto) return;
        const viewport = window.visualViewport;
        const altura = viewport?.height || window.innerHeight;
        const compacto = altura <= 500;
        if (compacto !== elementos.root.classList.contains("is-compact")) {
            elementos.shortcuts.open = !compacto;
            if (compacto && elementos.shortcuts.contains(document.activeElement)) {
                elementos.close.focus({ preventScroll: true });
            }
        }
        elementos.root.classList.toggle("is-compact", compacto);
        elementos.root.style.setProperty("--chat-viewport-height", `${altura}px`);
        elementos.root.style.setProperty("--chat-viewport-top", `${viewport?.offsetTop || 0}px`);
    }

    function conterFoco(evento) {
        if (estaAberto && !elementos.panel.contains(evento.target)) {
            elementos.close.focus({ preventScroll: true });
        }
    }

    function aoPressionarTecla(evento) {
        if (!estaAberto) return;
        if (evento.key === "Escape") {
            evento.preventDefault();
            fecharChat();
            return;
        }
        if (evento.key !== "Tab") return;
        const focaveis = Array.from(elementos.panel.querySelectorAll(
            'button:not(:disabled), input:not(:disabled), summary, [tabindex="0"]'
        )).filter(elemento => elemento.getClientRects().length && getComputedStyle(elemento).visibility !== "hidden");
        const primeiro = focaveis[0];
        const ultimo = focaveis.at(-1);
        if (!primeiro) return;
        if (evento.shiftKey && (document.activeElement === primeiro || document.activeElement === elementos.panel)) {
            evento.preventDefault();
            ultimo.focus();
        } else if (!evento.shiftKey && document.activeElement === ultimo) {
            evento.preventDefault();
            primeiro.focus();
        }
    }

    function travarRolagemPagina() {
        if (document.body.classList.contains("ai-chat-scroll-locked")) return;
        posicaoRolagemTravada = window.scrollY || document.documentElement.scrollTop || 0;
        document.documentElement.classList.add("ai-chat-scroll-locked");
        document.body.classList.add("ai-chat-scroll-locked");
        document.body.style.top = `-${posicaoRolagemTravada}px`;
    }

    function liberarRolagemPagina() {
        document.documentElement.classList.remove("ai-chat-scroll-locked");
        document.body.classList.remove("ai-chat-scroll-locked");
        document.body.style.top = "";
        window.scrollTo(0, posicaoRolagemTravada);
    }

    function aoPressionarFora(evento) {
        if (!estaAberto || elementos.root?.contains(evento.target)) return;
        fecharChat();
    }

    function renderizarMensagemInicial() {
        adicionarMensagem("assistant", `Tenho acesso aos dados carregados da estação climática. Escolha um atalho acima ou pergunte algo como:\n${EXEMPLOS_CONVERSA.map(item => `• ${item}`).join("\n")}`);
    }

    async function aoEnviarFormulario(evento) {
        evento.preventDefault();
        if (estaOcupado) return;

        const pergunta = elementos.input.value.trim();
        if (!pergunta) return;

        await enviarPergunta(pergunta);
    }

    async function enviarPergunta(pergunta) {
        if (estaOcupado || !pergunta) return;

        if (!estaAberto) abrirChat();
        adicionarMensagem("user", pergunta);
        elementos.input.value = "";
        definirOcupado(true);

        const mensagemPensando = adicionarMensagem("assistant", "Analisando os dados carregados...");

        try {
            const contexto = obterContexto ? obterContexto() : {};
            const resultado = await espacoNomes.query.answerQuestionDetailed(pergunta, {
                ...contexto,
                chatMemory: memoriaConversa,
            });
            mensagemPensando.textContent = resultado.answer;
            atualizarMemoriaConversa(pergunta, resultado.result);
        } catch (erro) {
            window.ClimateDiagnostics?.depurar("Falha no chat com IA.", erro);
            mensagemPensando.textContent = "Não consegui consultar a IA agora. Verifique se o Firebase AI Logic e o App Check estão configurados para este domínio.";
        } finally {
            definirOcupado(false);
        }
    }

    function atualizarMemoriaConversa(pergunta, resultado) {
        const intencao = resultado?.resolvedIntent;
        if (!intencao || resultado?.needsClarification) return;

        memoriaConversa = {
            pergunta,
            environments: intencao.environments || [],
            metrics: intencao.metrics || [],
            operation: intencao.operation || null,
            period: intencao.period || null,
            hour: intencao.hour || null,
            hourRange: intencao.hourRange || null,
        };
    }

    function definirOcupado(valor) {
        estaOcupado = valor;
        if (valor && estaAberto && (document.activeElement === elementos.input || document.activeElement === elementos.submit || document.activeElement?.matches("[data-chat-question]"))) {
            elementos.close.focus({ preventScroll: true });
        }
        elementos.submit.disabled = valor;
        elementos.input.disabled = valor;
        elementos.quickActions.forEach(botao => {
            botao.disabled = valor;
        });
    }

    function adicionarMensagem(papel, texto) {
        const mensagem = document.createElement("div");
        mensagem.className = `ai-chat__message ai-chat__message--${papel}`;
        mensagem.textContent = texto;
        elementos.messages.appendChild(mensagem);
        elementos.messages.scrollTop = elementos.messages.scrollHeight;
        return mensagem;
    }

    espacoNomes.ui = {
        setup: configurar,
        open: abrirChat,
        close: fecharChat,
    };
    window.ClimateAssistant = espacoNomes;
})();
