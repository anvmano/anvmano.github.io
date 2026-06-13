'use strict';

(function () {
    const namespace = window.ClimateAssistant || {};
    const { CHAT_EXAMPLES } = namespace.config;

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
            const context = contextProvider ? contextProvider() : {};
            thinking.textContent = await namespace.query.answerQuestion(question, context);
        } catch (error) {
            console.error("Falha no chat com IA:", error);
            thinking.textContent = "Não consegui consultar a IA agora. Verifique se o Firebase AI Logic e o App Check estão configurados para este domínio.";
        } finally {
            setBusy(false);
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

    namespace.ui = { setup };
    window.ClimateAssistant = namespace;
})();
