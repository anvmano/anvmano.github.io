'use strict';

(function () {
    let modelo = null;

    async function inicializar() {
        if (modelo) return modelo;

        const configuracaoFirebase = window.AppConfig?.firebase;
        if (!configuracaoFirebase?.aiUrl) {
            throw new Error("Firebase AI Logic não está configurado.");
        }

        await window.FirebaseService.initialize();
        const app = window.FirebaseService.getApp();
        if (!app) {
            throw new Error("Firebase App não inicializado.");
        }

        const { getAI, getGenerativeModel, GoogleAIBackend } = await import(configuracaoFirebase.aiUrl);
        const ia = getAI(app, { backend: new GoogleAIBackend() });
        modelo = getGenerativeModel(ia, {
            model: configuracaoFirebase.aiModel || "gemini-3.5-flash",
        });

        return modelo;
    }

    async function gerarTexto(prompt) {
        const modeloAtivo = await inicializar();
        const resposta = await modeloAtivo.generateContent(prompt);
        if (typeof resposta.text === "function") return resposta.text();
        if (typeof resposta.text === "string") return resposta.text;
        return "Não consegui gerar uma resposta agora.";
    }

    window.ClimateAIService = {
        initialize: inicializar,
        generateText: gerarTexto,
    };
})();
