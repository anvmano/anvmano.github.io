'use strict';

(function () {
    const namespace = window.ClimateAssistant || {};
    const { CHAT_EXAMPLES } = namespace.config;

    let obterContexto = null;
    let elementos = {};
    let estaAberto = false;
    let estaOcupado = false;
    let temporizadorFechamento = null;
    let posicaoRolagemTravada = 0;
    let memoriaConversa = null;

    function configurar(opcoes = {}) {
        obterContexto = opcoes.getContext;
        elementos = coletarElementos();
        if (!elementos.toggle || !elementos.panel || !elementos.form || !elementos.input || !elementos.messages) return;

        elementos.toggle.addEventListener("click", alternarChat);
        elementos.close?.addEventListener("click", fecharChat);
        elementos.form.addEventListener("submit", aoEnviarFormulario);
        document.addEventListener("pointerdown", aoPressionarFora);
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
        };
    }

    function alternarChat() {
        estaAberto ? fecharChat() : abrirChat();
    }

    function abrirChat() {
        estaAberto = true;
        clearTimeout(temporizadorFechamento);
        travarRolagemPagina();
        elementos.toggle?.setAttribute("aria-expanded", "true");
        elementos.panel?.removeAttribute("hidden");
        requestAnimationFrame(() => {
            elementos.root?.classList.add("is-open");
        });
        setTimeout(() => elementos.input?.focus(), 50);
    }

    function fecharChat() {
        estaAberto = false;
        elementos.root?.classList.remove("is-open");
        elementos.toggle?.setAttribute("aria-expanded", "false");
        liberarRolagemPagina();
        clearTimeout(temporizadorFechamento);
        temporizadorFechamento = setTimeout(() => {
            if (!estaAberto) elementos.panel?.setAttribute("hidden", "");
        }, 220);
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
        adicionarMensagem("assistant", `Tenho acesso aos dados carregados da estação climática. Escolha um atalho acima ou pergunte algo como:\n${CHAT_EXAMPLES.map(item => `• ${item}`).join("\n")}`);
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
            const resultado = await namespace.query.answerQuestionDetailed(pergunta, {
                ...contexto,
                chatMemory: memoriaConversa,
            });
            mensagemPensando.textContent = resultado.answer;
            atualizarMemoriaConversa(pergunta, resultado.result);
        } catch (erro) {
            console.error("Falha no chat com IA:", erro);
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

    namespace.ui = { setup: configurar };
    window.ClimateAssistant = namespace;
})();
