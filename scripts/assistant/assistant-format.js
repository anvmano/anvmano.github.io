'use strict';

(function () {
    const namespace = window.ClimateAssistant || {};

    function normalizarTexto(texto) {
        return String(texto || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
    }

    function escaparRegExp(valor) {
        return String(valor).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function temPalavra(texto, palavra) {
        return new RegExp(`(^|\\W)${escaparRegExp(palavra)}(\\W|$)`, "i").test(texto);
    }

    function normalizarFiltroHora(valor) {
        if (!valor) return null;

        const texto = String(valor).trim();
        const partes = texto.match(/^(\d{1,2})(?:(?::|-)\d{2}|h)?$/i);
        if (!partes) return null;

        const hora = Number(partes[1]);
        if (!Number.isFinite(hora) || hora < 0 || hora > 23) return null;

        return String(hora).padStart(2, "0");
    }

    function formatarData(dataFirebase) {
        return dataFirebase ? dataFirebase.replace(/-/g, "/") : "--";
    }

    function formatarNumero(valor) {
        return Number.isFinite(valor) ? valor.toFixed(2) : "--";
    }

    function formatarValorMetrica(valor, unidade) {
        if (!Number.isFinite(valor)) return "--";
        if (!unidade) return Number.isInteger(valor) ? String(valor) : formatarNumero(valor);
        return `${formatarNumero(valor)}${unidade}`;
    }

    function formatarRotuloHora(hora) {
        const horaNormalizada = normalizarFiltroHora(hora);
        return horaNormalizada ? `${horaNormalizada}:00` : "--";
    }

    function formatarRotuloFaixaHora(faixaHora) {
        if (!faixaHora?.start || !faixaHora?.end) return null;
        return `${formatarRotuloHora(faixaHora.start)} a ${formatarRotuloHora(faixaHora.end)}`;
    }

    function formatarRotuloPeriodo(datas) {
        if (!datas.length) return "--";
        if (datas.length === 1) return formatarData(datas[0]);
        return `${formatarData(datas[0])} a ${formatarData(datas[datas.length - 1])}`;
    }

    function formatarDataFirebase(data) {
        return `${String(data.getDate()).padStart(2, "0")}-${String(data.getMonth() + 1).padStart(2, "0")}-${data.getFullYear()}`;
    }

    function formatarRotuloTimestamp(timestamp) {
        if (!(timestamp instanceof Date) || Number.isNaN(timestamp.getTime())) return null;
        const data = `${String(timestamp.getDate()).padStart(2, "0")}/${String(timestamp.getMonth() + 1).padStart(2, "0")}/${timestamp.getFullYear()}`;
        const hora = `${String(timestamp.getHours()).padStart(2, "0")}:${String(timestamp.getMinutes()).padStart(2, "0")}`;
        return `${data} ${hora}`;
    }

    function obterRotuloAba(idAba) {
        return { Tab1: "Sala", Tab2: "Quarto", Tab3: "Aquário" }[idAba] || idAba || "--";
    }

    function obterDatasUnicas(datas) {
        return [...new Set(datas.filter(Boolean))];
    }

    namespace.format = {
        normalizeText: normalizarTexto,
        hasWord: temPalavra,
        normalizeHourFilter: normalizarFiltroHora,
        formatDate: formatarData,
        formatNumber: formatarNumero,
        formatMetricValue: formatarValorMetrica,
        formatHourLabel: formatarRotuloHora,
        formatHourRangeLabel: formatarRotuloFaixaHora,
        formatPeriodLabel: formatarRotuloPeriodo,
        formatFirebaseDate: formatarDataFirebase,
        formatTimestampLabel: formatarRotuloTimestamp,
        getTabLabel: obterRotuloAba,
        uniqueDates: obterDatasUnicas,
    };

    window.ClimateAssistant = namespace;
})();
