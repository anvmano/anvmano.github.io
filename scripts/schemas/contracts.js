'use strict';

(function () {
    const VERSAO = 1;

    function validarColecaoFirebase(dados) {
        return dados === null || (typeof dados === "object" && !Array.isArray(dados));
    }

    function validarContextoRelatorio(contexto) {
        const contextoBasicoValido = Boolean(
            contexto
            && typeof contexto === "object"
            && /^\d{2}-\d{2}-\d{4}$/.test(String(contexto.selectedDate || ""))
            && contexto.latestData
            && typeof contexto.latestData === "object"
        );
        return contextoBasicoValido && (
            contexto.dadosClimaExterno === undefined ||
            contexto.dadosClimaExterno === null ||
            typeof contexto.dadosClimaExterno === "object"
        );
    }

    function validarContextoAssistente(contexto) {
        return validarContextoRelatorio(contexto)
            && typeof contexto.activeTab === "string";
    }

    window.ClimateContracts = {
        versao: VERSAO,
        validarColecaoFirebase,
        validarContextoRelatorio,
        validarContextoAssistente,
    };
})();
