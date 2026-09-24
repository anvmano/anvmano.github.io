'use strict';

(function () {
    const modulos = window.ClimatePdfReportModules = window.ClimatePdfReportModules || {};

    const { format: formatacao } = modulos;
    const { escapeHtml: escaparTextoHtml, formatFirebaseDate: formatarDataFirebaseRelatorio, formatDateTime: formatarDataHoraRelatorio, getStatusClass: obterClasseEstado } = formatacao;

    function criarCabecalho(rotuloAba, dataSelecionada, geradoEm) {
        const cabecalho = document.createElement("header");
        cabecalho.className = "pdf-report__header";
        cabecalho.innerHTML = `
            <div>
                <span class="pdf-report__eyebrow">Resumo executivo</span>
                <h2 class="pdf-report__title">Relatório da Estação Climática</h2>
                <p class="pdf-report__subtitle">Leitura consolidada da aba ativa e da data selecionada.</p>
            </div>
            <div class="pdf-report__meta">
                <div class="pdf-report__meta-item">
                    <span class="pdf-report__label">Aba selecionada</span>
                    <span class="pdf-report__value">${escaparTextoHtml(rotuloAba)}</span>
                </div>
                <div class="pdf-report__meta-item">
                    <span class="pdf-report__label">Data consultada</span>
                    <span class="pdf-report__value">${formatarDataFirebaseRelatorio(dataSelecionada)}</span>
                </div>
                <div class="pdf-report__meta-item">
                    <span class="pdf-report__label">Gerado em</span>
                    <span class="pdf-report__value">${formatarDataHoraRelatorio(geradoEm)}</span>
                </div>
            </div>
        `;
        return cabecalho;
    }

    function criarSecaoResumo(cards, alertas) {
        const secao = document.createElement("section");
        secao.className = "pdf-report__section pdf-report__summary-section";
        secao.innerHTML = `<span class="pdf-report__section-title">Indicadores principais</span>`;

        const grade = document.createElement("div");
        grade.className = "pdf-summary-rows";
        cards.forEach((card, indice) => {
            if (indice % 2 === 0) {
                const linha = document.createElement("div");
                linha.className = "pdf-summary-grid";
                grade.appendChild(linha);
            }
            grade.lastElementChild.appendChild(criarCardResumoRelatorio(card));
        });
        secao.appendChild(grade);
        secao.appendChild(criarPainelAlertas(alertas));
        return secao;
    }

    function criarPainelAlertas(alertas) {
        const painel = document.createElement("article");
        painel.className = "pdf-alert-panel";
        const itens = alertas.length
            ? alertas.map(alerta => `<li>${escaparTextoHtml(alerta)}</li>`).join("")
            : "<li>Nenhum alerta relevante encontrado para o período.</li>";

        painel.innerHTML = `
            <div class="pdf-alert-panel__heading">
                <span class="pdf-report__section-title">Alertas do dia</span>
                <span class="pdf-status pdf-status--${alertas.length ? "alert" : "stable"}">${alertas.length ? "Atenção" : "Estável"}</span>
            </div>
            <ul class="pdf-alert-list">${itens}</ul>
        `;
        return painel;
    }

    function criarCardResumoRelatorio(card) {
        const classeEstado = obterClasseEstado(card.status);
        const detalhesSecao = normalizarDetalhesResumo(card);
        const elementoDom = document.createElement("article");
        elementoDom.className = "pdf-summary-card";
        elementoDom.innerHTML = `
            <div class="pdf-summary-card__top">
                <span class="pdf-summary-card__name">${escaparTextoHtml(card.label)}</span>
                <span class="pdf-status pdf-status--${classeEstado}">${escaparTextoHtml(card.status)}</span>
            </div>
            <strong class="pdf-summary-card__current">${escaparTextoHtml(card.current)}</strong>
            <dl class="pdf-summary-card__details">
                ${detalhesSecao.map(detalhe => `
                    <div>
                        <dt>${escaparTextoHtml(detalhe.label)}</dt>
                        <dd>${escaparTextoHtml(detalhe.value)}</dd>
                    </div>
                `).join("")}
            </dl>
        `;
        return elementoDom;
    }

    function normalizarDetalhesResumo(card) {
        if (Array.isArray(card.details) && card.details.length) {
            return card.details.slice(0, 4).map(detalhe => ({
                label: detalhe.label || "",
                value: detalhe.value ?? "--",
            }));
        }

        return [
            { label: "Mín", value: card.min },
            { label: "Máx", value: card.max },
            { label: "Delta", value: card.delta },
        ];
    }

    function criarSecaoGraficos(cards) {
        const secao = document.createElement("section");
        secao.className = "pdf-report__section pdf-report__charts-section";
        secao.innerHTML = `<span class="pdf-report__section-title">Gráficos</span>`;

        const grade = document.createElement("div");
        grade.className = "pdf-chart-grid";
        cards.forEach(card => grade.appendChild(criarCardGrafico(card)));
        secao.appendChild(grade);
        return secao;
    }

    function criarCardGrafico(card) {
        const elementoDom = document.createElement("article");
        elementoDom.className = [
            "pdf-chart-card",
            card.wide ? "pdf-chart-card--wide" : "",
            card.compact ? "pdf-chart-card--compact" : "",
        ].filter(Boolean).join(" ");
        elementoDom.innerHTML = `
            <div class="pdf-chart-card__title">
                <span class="pdf-chart-card__name">${escaparTextoHtml(card.label)}</span>
                <span class="pdf-chart-card__unit">${escaparTextoHtml(card.unit || "")}</span>
            </div>
        `;

        if (card.image) {
            const imagemElemento = document.createElement("img");
            imagemElemento.src = card.image;
            imagemElemento.alt = card.label;
            elementoDom.appendChild(imagemElemento);
        } else {
            const vazio = document.createElement("div");
            vazio.className = "pdf-empty";
            vazio.innerText = card.emptyMessage || "Sem dados disponíveis";
            elementoDom.appendChild(vazio);
        }

        if (card.stats?.length) {
            const estatisticas = document.createElement("div");
            estatisticas.className = "pdf-chart-stats";
            estatisticas.innerHTML = card.stats.map(item => `<span>${escaparTextoHtml(item)}</span>`).join("");
            elementoDom.appendChild(estatisticas);
        }

        return elementoDom;
    }

    function criarSecaoTabela(linhas, metricas) {
        const secao = document.createElement("section");
        secao.className = "pdf-report__section pdf-report__table-section";
        secao.innerHTML = `<span class="pdf-report__section-title">Tabela resumida</span>`;

        if (!linhas.length) {
            const vazio = document.createElement("div");
            vazio.className = "pdf-empty";
            vazio.innerText = "Sem dados disponíveis";
            secao.appendChild(vazio);
            return secao;
        }

        const tabela = document.createElement("table");
        tabela.className = "pdf-table";
        tabela.innerHTML = `
            <thead>
                <tr>
                    <th>Horário</th>
                    ${metricas.map(metrica => `<th>${escaparTextoHtml(metrica.label)}</th>`).join("")}
                    <th>Status geral</th>
                </tr>
            </thead>
        `;
        const tbody = document.createElement("tbody");
        linhas.forEach(linha => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${escaparTextoHtml(linha.time)}</td>
                ${metricas.map(metrica => `<td>${escaparTextoHtml(linha.values[metrica.key] || "--")}</td>`).join("")}
                <td><span class="pdf-status pdf-status--${obterClasseEstado(linha.status)}">${escaparTextoHtml(linha.status)}</span></td>
            `;
            tbody.appendChild(tr);
        });
        tabela.appendChild(tbody);
        secao.appendChild(tabela);
        return secao;
    }

    modulos.dom = {
        createHeader: criarCabecalho,
        createSummarySection: criarSecaoResumo,
        createAlertsPanel: criarPainelAlertas,
        createSummaryCard: criarCardResumoRelatorio,
        normalizarDetalhesResumo,
        createChartsSection: criarSecaoGraficos,
        createChartCard: criarCardGrafico,
        createTableSection: criarSecaoTabela,
    };
})();
