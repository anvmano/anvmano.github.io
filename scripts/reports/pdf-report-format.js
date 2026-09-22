'use strict';

(function () {
    const modulos = window.ClimatePdfReportModules = window.ClimatePdfReportModules || {};

    function montarMensagemSemDados(rotulo, dataSelecionada) {
        return `Sem dados de ${rotulo.toLowerCase()} em ${formatarDataFirebaseRelatorio(dataSelecionada)}.`;
    }

    function limitar(valor, minimo, maximo) {
        return Math.min(Math.max(valor, minimo), maximo);
    }

    function obterEstadoMetrica(metrica, valor) {
        if (!Number.isFinite(valor)) return "Sem dados";
        if (["temperature", "feelsLike", "humidity"].includes(metrica.key)) {
            const faixa = metrica.comfortBand || AppConfig.comfortBand;
            return valor < faixa.min || valor > faixa.max ? "Alerta" : "Estável";
        }
        return "Estável";
    }

    function obterClasseEstado(estado) {
        if (estado === "Alerta") return "alert";
        if (estado === "Sem dados") return "empty";
        return "stable";
    }

    function formatarValorRelatorio(valor, unidade) {
        if (!Number.isFinite(valor)) return "--";
        return `${valor.toFixed(2)}${unidade}`;
    }

    function formatarDiferenca(valor, unidade) {
        if (!Number.isFinite(valor)) return "--";
        const sinal = valor > 0 ? "+" : "";
        return `${sinal}${valor.toFixed(2)}${unidade}`;
    }

    function formatarDataFirebaseRelatorio(dataReferencia) {
        return dataReferencia ? dataReferencia.replace(/-/g, "/") : "--";
    }

    function formatarDataHoraRelatorio(dataReferencia) {
        return dataReferencia.toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    function escaparTextoHtml(valor) {
        return String(valor)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function gerarIdentificadorUrl(valor) {
        return valor
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");
    }

    modulos.format = {
        buildNoDataMessage: montarMensagemSemDados,
        clamp: limitar,
        getMetricStatus: obterEstadoMetrica,
        getStatusClass: obterClasseEstado,
        formatValue: formatarValorRelatorio,
        formatDelta: formatarDiferenca,
        formatFirebaseDate: formatarDataFirebaseRelatorio,
        formatDateTime: formatarDataHoraRelatorio,
        escapeHtml: escaparTextoHtml,
        slug: gerarIdentificadorUrl,
    };
})();
