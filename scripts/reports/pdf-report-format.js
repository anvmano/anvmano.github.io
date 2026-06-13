'use strict';

(function () {
    const modules = window.ClimatePdfReportModules = window.ClimatePdfReportModules || {};

    function buildNoDataMessage(label, selectedDate) {
        return `Sem dados de ${label.toLowerCase()} em ${formatFirebaseDate(selectedDate)}.`;
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function getMetricStatus(metric, value) {
        if (!Number.isFinite(value)) return "Sem dados";
        if (["temperature", "feelsLike", "humidity"].includes(metric.key)) {
            const band = metric.comfortBand || AppConfig.comfortBand;
            return value < band.min || value > band.max ? "Alerta" : "Estável";
        }
        return "Estável";
    }

    function getStatusClass(status) {
        if (status === "Alerta") return "alert";
        if (status === "Sem dados") return "empty";
        return "stable";
    }

    function formatValue(value, unit) {
        if (!Number.isFinite(value)) return "--";
        return `${value.toFixed(2)}${unit}`;
    }

    function formatDelta(value, unit) {
        if (!Number.isFinite(value)) return "--";
        const sign = value > 0 ? "+" : "";
        return `${sign}${value.toFixed(2)}${unit}`;
    }

    function formatFirebaseDate(date) {
        return date ? date.replace(/-/g, "/") : "--";
    }

    function formatDateTime(date) {
        return date.toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function slug(value) {
        return value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");
    }

    modules.format = {
        buildNoDataMessage,
        clamp,
        getMetricStatus,
        getStatusClass,
        formatValue,
        formatDelta,
        formatFirebaseDate,
        formatDateTime,
        escapeHtml,
        slug,
    };
})();
