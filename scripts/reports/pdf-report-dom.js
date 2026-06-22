'use strict';

(function () {
    const modules = window.ClimatePdfReportModules = window.ClimatePdfReportModules || {};

    const { format } = modules;
    const { escapeHtml, formatFirebaseDate, formatDateTime, getStatusClass } = format;

    function createHeader(tabLabel, selectedDate, generatedAt) {
        const header = document.createElement("header");
        header.className = "pdf-report__header";
        header.innerHTML = `
            <div>
                <span class="pdf-report__eyebrow">Resumo executivo</span>
                <h2 class="pdf-report__title">Relatório da Estação Climática</h2>
                <p class="pdf-report__subtitle">Leitura consolidada da aba ativa e da data selecionada.</p>
            </div>
            <div class="pdf-report__meta">
                <div class="pdf-report__meta-item">
                    <span class="pdf-report__label">Aba selecionada</span>
                    <span class="pdf-report__value">${escapeHtml(tabLabel)}</span>
                </div>
                <div class="pdf-report__meta-item">
                    <span class="pdf-report__label">Data consultada</span>
                    <span class="pdf-report__value">${formatFirebaseDate(selectedDate)}</span>
                </div>
                <div class="pdf-report__meta-item">
                    <span class="pdf-report__label">Gerado em</span>
                    <span class="pdf-report__value">${formatDateTime(generatedAt)}</span>
                </div>
            </div>
        `;
        return header;
    }

    function createSummarySection(cards, alerts) {
        const section = document.createElement("section");
        section.className = "pdf-report__section pdf-report__summary-section";
        section.innerHTML = `<span class="pdf-report__section-title">Indicadores principais</span>`;

        const grid = document.createElement("div");
        grid.className = "pdf-summary-grid";
        cards.forEach(card => grid.appendChild(createSummaryCard(card)));
        section.appendChild(grid);
        section.appendChild(createAlertsPanel(alerts));
        return section;
    }

    function createAlertsPanel(alerts) {
        const panel = document.createElement("article");
        panel.className = "pdf-alert-panel";
        const items = alerts.length
            ? alerts.map(alert => `<li>${escapeHtml(alert)}</li>`).join("")
            : "<li>Nenhum alerta relevante encontrado para o período.</li>";

        panel.innerHTML = `
            <div class="pdf-alert-panel__heading">
                <span class="pdf-report__section-title">Alertas do dia</span>
                <span class="pdf-status pdf-status--${alerts.length ? "alert" : "stable"}">${alerts.length ? "Atenção" : "Estável"}</span>
            </div>
            <ul class="pdf-alert-list">${items}</ul>
        `;
        return panel;
    }

    function createSummaryCard(card) {
        const statusClass = getStatusClass(card.status);
        const details = normalizarDetalhesResumo(card);
        const el = document.createElement("article");
        el.className = "pdf-summary-card";
        el.innerHTML = `
            <div class="pdf-summary-card__top">
                <span class="pdf-summary-card__name">${escapeHtml(card.label)}</span>
                <span class="pdf-status pdf-status--${statusClass}">${escapeHtml(card.status)}</span>
            </div>
            <strong class="pdf-summary-card__current">${escapeHtml(card.current)}</strong>
            <dl class="pdf-summary-card__details">
                ${details.map(detail => `
                    <div>
                        <dt>${escapeHtml(detail.label)}</dt>
                        <dd>${escapeHtml(detail.value)}</dd>
                    </div>
                `).join("")}
            </dl>
        `;
        return el;
    }

    function normalizarDetalhesResumo(card) {
        if (Array.isArray(card.details) && card.details.length) {
            return card.details.slice(0, 3).map(detail => ({
                label: detail.label || "",
                value: detail.value ?? "--",
            }));
        }

        return [
            { label: "Mín", value: card.min },
            { label: "Máx", value: card.max },
            { label: "Delta", value: card.delta },
        ];
    }

    function createChartsSection(cards) {
        const section = document.createElement("section");
        section.className = "pdf-report__section pdf-report__charts-section";
        section.innerHTML = `<span class="pdf-report__section-title">Gráficos</span>`;

        const grid = document.createElement("div");
        grid.className = "pdf-chart-grid";
        cards.forEach(card => grid.appendChild(createChartCard(card)));
        section.appendChild(grid);
        return section;
    }

    function createChartCard(card) {
        const el = document.createElement("article");
        el.className = [
            "pdf-chart-card",
            card.wide ? "pdf-chart-card--wide" : "",
            card.compact ? "pdf-chart-card--compact" : "",
        ].filter(Boolean).join(" ");
        el.innerHTML = `
            <div class="pdf-chart-card__title">
                <span class="pdf-chart-card__name">${escapeHtml(card.label)}</span>
                <span class="pdf-chart-card__unit">${escapeHtml(card.unit || "")}</span>
            </div>
        `;

        if (card.image) {
            const img = document.createElement("img");
            img.src = card.image;
            img.alt = card.label;
            el.appendChild(img);
        } else {
            const empty = document.createElement("div");
            empty.className = "pdf-empty";
            empty.innerText = card.emptyMessage || "Sem dados disponíveis";
            el.appendChild(empty);
        }

        if (card.stats?.length) {
            const stats = document.createElement("div");
            stats.className = "pdf-chart-stats";
            stats.innerHTML = card.stats.map(item => `<span>${escapeHtml(item)}</span>`).join("");
            el.appendChild(stats);
        }

        return el;
    }

    function createTableSection(rows, metrics) {
        const section = document.createElement("section");
        section.className = "pdf-report__section pdf-report__table-section";
        section.innerHTML = `<span class="pdf-report__section-title">Tabela resumida</span>`;

        if (!rows.length) {
            const empty = document.createElement("div");
            empty.className = "pdf-empty";
            empty.innerText = "Sem dados disponíveis";
            section.appendChild(empty);
            return section;
        }

        const table = document.createElement("table");
        table.className = "pdf-table";
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Horário</th>
                    ${metrics.map(metric => `<th>${escapeHtml(metric.label)}</th>`).join("")}
                    <th>Status geral</th>
                </tr>
            </thead>
        `;
        const tbody = document.createElement("tbody");
        rows.forEach(row => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${escapeHtml(row.time)}</td>
                ${metrics.map(metric => `<td>${escapeHtml(row.values[metric.key] || "--")}</td>`).join("")}
                <td><span class="pdf-status pdf-status--${getStatusClass(row.status)}">${escapeHtml(row.status)}</span></td>
            `;
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        section.appendChild(table);
        return section;
    }

    modules.dom = {
        createHeader,
        createSummarySection,
        createAlertsPanel,
        createSummaryCard,
        normalizarDetalhesResumo,
        createChartsSection,
        createChartCard,
        createTableSection,
    };
})();
