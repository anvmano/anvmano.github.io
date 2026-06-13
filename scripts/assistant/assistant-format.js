'use strict';

(function () {
    const namespace = window.ClimateAssistant || {};

    function normalizeText(text) {
        return String(text || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
    }

    function escapeRegExp(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function hasWord(text, word) {
        return new RegExp(`(^|\\W)${escapeRegExp(word)}(\\W|$)`, "i").test(text);
    }

    function normalizeHourFilter(value) {
        if (!value) return null;

        const text = String(value).trim();
        const match = text.match(/^(\d{1,2})(?:(?::|-)\d{2}|h)?$/i);
        if (!match) return null;

        const hour = Number(match[1]);
        if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;

        return String(hour).padStart(2, "0");
    }

    function formatDate(firebaseDate) {
        return firebaseDate ? firebaseDate.replace(/-/g, "/") : "--";
    }

    function formatNumber(value) {
        return Number.isFinite(value) ? value.toFixed(2) : "--";
    }

    function formatMetricValue(value, unit) {
        if (!Number.isFinite(value)) return "--";
        if (!unit) return Number.isInteger(value) ? String(value) : formatNumber(value);
        return `${formatNumber(value)}${unit}`;
    }

    function formatHourLabel(hour) {
        const normalizedHour = normalizeHourFilter(hour);
        return normalizedHour ? `${normalizedHour}:00` : "--";
    }

    function formatHourRangeLabel(hourRange) {
        if (!hourRange?.start || !hourRange?.end) return null;
        return `${formatHourLabel(hourRange.start)} a ${formatHourLabel(hourRange.end)}`;
    }

    function formatPeriodLabel(dates) {
        if (!dates.length) return "--";
        if (dates.length === 1) return formatDate(dates[0]);
        return `${formatDate(dates[0])} a ${formatDate(dates[dates.length - 1])}`;
    }

    function formatFirebaseDate(date) {
        return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
    }

    function formatTimestampLabel(timestamp) {
        if (!(timestamp instanceof Date) || Number.isNaN(timestamp.getTime())) return null;
        const date = `${String(timestamp.getDate()).padStart(2, "0")}/${String(timestamp.getMonth() + 1).padStart(2, "0")}/${timestamp.getFullYear()}`;
        const time = `${String(timestamp.getHours()).padStart(2, "0")}:${String(timestamp.getMinutes()).padStart(2, "0")}`;
        return `${date} ${time}`;
    }

    function getTabLabel(tabId) {
        return { Tab1: "Sala", Tab2: "Quarto", Tab3: "Aquário" }[tabId] || tabId || "--";
    }

    function uniqueDates(dates) {
        return [...new Set(dates.filter(Boolean))];
    }

    namespace.format = {
        normalizeText,
        hasWord,
        normalizeHourFilter,
        formatDate,
        formatNumber,
        formatMetricValue,
        formatHourLabel,
        formatHourRangeLabel,
        formatPeriodLabel,
        formatFirebaseDate,
        formatTimestampLabel,
        getTabLabel,
        uniqueDates,
    };

    window.ClimateAssistant = namespace;
})();
