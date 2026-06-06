'use strict';

(function () {
    let model = null;

    async function initialize() {
        if (model) return model;

        const firebaseConfig = window.AppConfig?.firebase;
        if (!firebaseConfig?.aiUrl) {
            throw new Error("Firebase AI Logic não está configurado.");
        }

        await window.FirebaseService.initialize();
        const app = window.FirebaseService.getApp();
        if (!app) {
            throw new Error("Firebase App não inicializado.");
        }

        const { getAI, getGenerativeModel, GoogleAIBackend } = await import(firebaseConfig.aiUrl);
        const ai = getAI(app, { backend: new GoogleAIBackend() });
        model = getGenerativeModel(ai, {
            model: firebaseConfig.aiModel || "gemini-3.5-flash",
        });

        return model;
    }

    async function generateText(prompt) {
        const activeModel = await initialize();
        const response = await activeModel.generateContent(prompt);
        if (typeof response.text === "function") return response.text();
        if (typeof response.text === "string") return response.text;
        return "Não consegui gerar uma resposta agora.";
    }

    window.ClimateAIService = {
        initialize,
        generateText,
    };
})();
