'use strict';

(function () {
    let modelo = null;

    async function inicializar() {
        if (modelo) return modelo;

        const configuracaoFirebase = window.AppConfig?.firebase;
        if (!configuracaoFirebase?.aiUrl) {
            throw new Error("Firebase AI Logic não está configurado.");
        }

        await window.FirebaseService.ensureAppCheckInitialized?.();
        await window.FirebaseService.initialize();
        const aplicacao = window.FirebaseService.getApp();
        if (!aplicacao) {
            throw new Error("Firebase App não inicializado.");
        }

        const { getAI, getGenerativeModel, GoogleAIBackend } = await import(configuracaoFirebase.aiUrl);
        const ia = getAI(aplicacao, { backend: new GoogleAIBackend() });
        modelo = getGenerativeModel(ia, {
            model: configuracaoFirebase.aiModel || "gemini-3.5-flash",
        });

        return modelo;
    }

    async function gerarTexto(instrucaoModelo) {
        const modeloAtivo = await inicializar();
        const resposta = await modeloAtivo.generateContent(instrucaoModelo);
        if (typeof resposta.text === "function") return resposta.text();
        if (typeof resposta.text === "string") return resposta.text;
        return "Não consegui gerar uma resposta agora.";
    }

    window.ClimateAIService = {
        initialize: inicializar,
        generateText: gerarTexto,
    };
})();
