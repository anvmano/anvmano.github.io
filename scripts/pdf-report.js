'use strict';

(function () {
    const TAB_CONFIG = {
        Tab1: {
            label: "Sala",
            dataKey: "livingRoom",
            tableType: "livingRoom",
            metrics: [
                { key: "temperature", label: "Temperatura", unit: "°C", chart: "livingRoomTemperature" },
                { key: "feelsLike", label: "Sensação térmica", unit: "°C", chart: "livingRoomFeelsLike" },
                { key: "humidity", label: "Umidade", unit: "%", chart: "livingRoomHumidity" },
                { key: "pressure", label: "Pressão", unit: "hPa", chart: "livingRoomPressure" },
            ],
        },
        Tab2: {
            label: "Quarto",
            dataKey: "room",
            tableType: "room",
            metrics: [
                { key: "temperature", label: "Temperatura", unit: "°C", chart: "roomTemperature" },
                { key: "feelsLike", label: "Sensação térmica", unit: "°C", chart: "roomFeelsLike" },
                { key: "humidity", label: "Umidade", unit: "%", chart: "roomHumidity" },
            ],
            solarCharts: [
                { label: "Ciclo solar", unit: "h", chart: "solarToday" },
            ],
        },
        Tab3: {
            label: "Aquário",
            dataKey: "aquarium",
            tableType: "aquarium",
            metrics: [
                { key: "temperature", label: "Temperatura", unit: "°C", chart: "aquariumTemperature" },
                { key: "ph", label: "pH", unit: "", chart: "aquariumPh" },
                { key: "tds", label: "TDS", unit: "", chart: "aquariumTds" },
                { key: "turbidity", label: "Turbidez", unit: "", chart: "aquariumTurbidity" },
            ],
        },
    };

    let getContext = null;
    let selectedFormat = "pdf";

    function setup({ buttonId, formatName = "exportFormat", getContext: contextGetter }) {
        getContext = contextGetter;
        const button = document.getElementById(buttonId);
        if (!button) return;

        setupFormatControls(button, formatName);
        button.addEventListener("click", () => exportActiveTab(button));
    }

    async function exportActiveTab(button) {
        const format = getSelectedFormat();
        if (format === "pdf" && !canGeneratePdf()) {
            alert("Biblioteca de PDF não carregada.");
            return;
        }

        const originalText = button.innerText;
        button.disabled = true;
        button.innerText = format === "json" ? "Gerando JSON..." : "Gerando PDF...";

        const renderRoot = document.createElement("div");
        renderRoot.className = "pdf-render-root";

        try {
            const context = getContext ? getContext() : {};
            const report = buildReport(context);

            if (format === "json") {
                exportJsonReport(report);
                return;
            }

            renderRoot.appendChild(report.element);
            document.body.appendChild(renderRoot);
            await generatePdf(report.element, report.fileNamePdf);
        } catch (error) {
            console.error("Erro ao exportar dados:", error);
            alert("Não foi possível exportar os dados.");
        } finally {
            renderRoot.remove();
            button.disabled = false;
            button.innerText = originalText || getButtonLabel(getSelectedFormat());
        }
    }

    function setupFormatControls(button, formatName) {
        const inputs = Array.from(document.querySelectorAll(`input[name="${formatName}"]`));
        if (!inputs.length) {
            button.innerText = getButtonLabel(selectedFormat);
            return;
        }

        const sync = () => {
            selectedFormat = getSelectedFormat(formatName);
            button.innerText = getButtonLabel(selectedFormat);
        };

        inputs.forEach(input => input.addEventListener("change", sync));
        sync();
    }

    function getSelectedFormat(formatName = "exportFormat") {
        const checked = document.querySelector(`input[name="${formatName}"]:checked`);
        return checked?.value === "json" ? "json" : "pdf";
    }

    function getButtonLabel(format) {
        return format === "json" ? "Exportar JSON" : "Exportar PDF";
    }

    function canGeneratePdf() {
        return typeof html2canvas === "function" && typeof window.jspdf?.jsPDF === "function";
    }

    function exportJsonReport(report) {
        const payload = {
            relatorio: "Estação Climática",
            aba: report.tabLabel,
            dataConsultada: formatFirebaseDate(report.selectedDate),
            dataConsultadaFirebase: report.selectedDate,
            geradoEm: report.generatedAt.toISOString(),
            resumo: report.summaryCards.map(card => ({
                indicador: card.label,
                atual: card.current,
                minimo: card.min,
                maximo: card.max,
                delta: card.delta,
                status: card.status,
            })),
            tabela: report.rows.map(row => ({
                horario: row.time,
                indicador: row.label,
                valor: row.value,
                status: row.status,
            })),
            dadosBrutos: report.selectedData,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
            type: "application/json;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = report.fileNameJson;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function buildReport(context) {
        const tabConfig = TAB_CONFIG[context.activeTab] || TAB_CONFIG.Tab1;
        const selectedDate = context.selectedDate || ClimateData.dataAtual();
        const generatedAt = new Date();
        const fileNameBase = `relatorio-estacao-${slug(tabConfig.label)}-${selectedDate}`;
        const data = context.latestData?.[tabConfig.dataKey] || {};
        const selectedData = ClimateData.filterDataByDays(data, 2, selectedDate);
        const fields = getFields(tabConfig);
        const rows = extractReportRows(selectedData, tabConfig.metrics, fields);
        const chartCards = collectChartCards(tabConfig, context.chartInstances || {});
        const summaryCards = buildSummaryCards(tabConfig, rows, context.chartInstances || {});

        const report = document.createElement("article");
        report.className = "pdf-report";
        report.appendChild(createHeader(tabConfig.label, selectedDate, generatedAt));
        report.appendChild(createIndexSection());
        report.appendChild(createSummarySection(summaryCards));
        report.appendChild(createChartsSection(chartCards));
        report.appendChild(createTableSection(rows));

        return {
            element: report,
            fileNamePdf: `${fileNameBase}.pdf`,
            fileNameJson: `${fileNameBase}.json`,
            tabLabel: tabConfig.label,
            selectedDate,
            generatedAt,
            summaryCards,
            rows,
            selectedData,
        };
    }

    function getFields(tabConfig) {
        if (tabConfig.tableType === "room") return AppConfig.fields.room;
        if (tabConfig.tableType === "livingRoom") return AppConfig.fields.livingRoom;
        return AppConfig.fields.aquarium;
    }

    function createHeader(tabLabel, selectedDate, generatedAt) {
        const header = document.createElement("header");
        header.className = "pdf-report__header";
        header.innerHTML = `
            <div>
                <span class="pdf-report__eyebrow">Relatório</span>
                <h2 class="pdf-report__title">Relatório da Estação Climática</h2>
                <div class="pdf-report__badge">Gerado pelo sistema</div>
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

    function createIndexSection() {
        const section = document.createElement("section");
        section.className = "pdf-report__index";
        section.innerHTML = `
            <span class="pdf-report__section-title">Índice</span>
            <ol class="pdf-index-list">
                <li><span>Resumo geral</span><strong>1</strong></li>
                <li><span>Gráficos</span><strong>2</strong></li>
                <li><span>Tabela</span><strong>3</strong></li>
            </ol>
        `;
        return section;
    }

    function createSummarySection(cards) {
        const section = document.createElement("section");
        section.className = "pdf-report__section";
        section.innerHTML = `<span class="pdf-report__section-title">Resumo geral</span>`;

        const grid = document.createElement("div");
        grid.className = "pdf-summary-grid";
        cards.forEach(card => grid.appendChild(createSummaryCard(card)));
        section.appendChild(grid);
        return section;
    }

    function createSummaryCard(card) {
        const statusClass = getStatusClass(card.status);
        const el = document.createElement("article");
        el.className = "pdf-summary-card";
        el.innerHTML = `
            <div class="pdf-summary-card__top">
                <span class="pdf-summary-card__name">${escapeHtml(card.label)}</span>
                <span class="pdf-status pdf-status--${statusClass}">${escapeHtml(card.status)}</span>
            </div>
            <strong class="pdf-summary-card__current">${escapeHtml(card.current)}</strong>
            <dl class="pdf-summary-card__details">
                <div><dt>Mín</dt><dd>${escapeHtml(card.min)}</dd></div>
                <div><dt>Máx</dt><dd>${escapeHtml(card.max)}</dd></div>
                <div><dt>Delta</dt><dd>${escapeHtml(card.delta)}</dd></div>
            </dl>
        `;
        return el;
    }

    function createChartsSection(cards) {
        const section = document.createElement("section");
        section.className = "pdf-report__section";
        section.innerHTML = `<span class="pdf-report__section-title">Gráficos</span>`;

        const grid = document.createElement("div");
        grid.className = "pdf-chart-grid";
        cards.forEach(card => grid.appendChild(createChartCard(card)));
        section.appendChild(grid);
        return section;
    }

    function createChartCard(card) {
        const el = document.createElement("article");
        el.className = card.wide ? "pdf-chart-card pdf-chart-card--wide" : "pdf-chart-card";
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
            empty.innerText = "Sem dados disponíveis";
            el.appendChild(empty);
        }

        return el;
    }

    function createTableSection(rows) {
        const section = document.createElement("section");
        section.className = "pdf-report__section";
        section.innerHTML = `<span class="pdf-report__section-title">Tabela detalhada</span>`;

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
                    <th>Indicador</th>
                    <th>Valor</th>
                    <th>Status</th>
                </tr>
            </thead>
        `;
        const tbody = document.createElement("tbody");
        rows.forEach(row => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${escapeHtml(row.time)}</td>
                <td>${escapeHtml(row.label)}</td>
                <td>${escapeHtml(row.value)}</td>
                <td>${escapeHtml(row.status)}</td>
            `;
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        section.appendChild(table);
        return section;
    }

    function buildSummaryCards(tabConfig, rows, chartInstances) {
        const cards = tabConfig.metrics.map(metric => {
            const values = rows
                .filter(row => row.metricKey === metric.key && Number.isFinite(row.numericValue))
                .map(row => row.numericValue);
            return buildMetricSummary(metric, values);
        });

        if (tabConfig.solarCharts) {
            const solarChart = chartInstances[AppConfig.ids.charts.solarToday];
            cards.push(buildSolarSummary(solarChart));
        }

        return cards;
    }

    function buildMetricSummary(metric, values) {
        if (!values.length) {
            return emptySummary(metric.label);
        }

        const first = values[0];
        const last = values[values.length - 1];
        const min = Math.min(...values);
        const max = Math.max(...values);
        const delta = last - first;
        const status = getMetricStatus(metric, last);

        return {
            label: metric.label,
            current: formatValue(last, metric.unit),
            min: formatValue(min, metric.unit),
            max: formatValue(max, metric.unit),
            delta: formatDelta(delta, metric.unit),
            status,
        };
    }

    function buildSolarSummary(chart) {
        const times = chart?.$solarDayTimes;
        if (!times) return emptySummary("Ciclo solar");

        const dayLength = times.sunset - times.sunrise;
        return {
            label: "Ciclo solar",
            current: `Zênite ${ClimateData.formatTime(times.zenith)}`,
            min: `Nascer ${ClimateData.formatTime(times.sunrise)}`,
            max: `Pôr ${ClimateData.formatTime(times.sunset)}`,
            delta: `${dayLength.toFixed(2)}h`,
            status: "Estável",
        };
    }

    function emptySummary(label) {
        return {
            label,
            current: "--",
            min: "--",
            max: "--",
            delta: "--",
            status: "Sem dados",
        };
    }

    function collectChartCards(tabConfig, chartInstances) {
        const cards = tabConfig.metrics.map(metric => {
            const chartId = AppConfig.ids.charts[metric.chart];
            return {
                label: metric.label,
                unit: metric.unit,
                image: captureChartImage(chartId, chartInstances),
            };
        });

        (tabConfig.solarCharts || []).forEach(metric => {
            const chartId = AppConfig.ids.charts[metric.chart];
            cards.push({
                label: metric.label,
                unit: metric.unit,
                image: captureChartImage(chartId, chartInstances),
                wide: true,
            });
        });

        return cards;
    }

    function captureChartImage(chartId, chartInstances) {
        const chart = chartInstances[chartId];
        const canvas = chart?.canvas || document.getElementById(chartId);
        if (!canvas || typeof canvas.toDataURL !== "function") return null;

        try {
            return canvas.toDataURL("image/png", 1);
        } catch {
            return null;
        }
    }

    function extractReportRows(data, metrics, fields) {
        const rows = [];
        const firebaseDates = Object.keys(data || {}).sort((a, b) => ClimateData.parseFirebaseDate(a) - ClimateData.parseFirebaseDate(b));

        for (const firebaseDate of firebaseDates) {
            const dateData = data[firebaseDate];
            if (!dateData || typeof dateData !== "object") continue;

            for (const time of Object.keys(dateData).sort()) {
                const timeData = dateData[time];
                if (!timeData || typeof timeData !== "object") continue;
                const [hour, minute = "0"] = time.split("-");

                for (const itemKey of Object.keys(timeData).sort()) {
                    const item = timeData[itemKey];
                    if (!item || typeof item !== "object") continue;

                    metrics.forEach((metric, metricIndex) => {
                        const fieldName = fields[metric.key];
                        const rawValue = item[fieldName];
                        const numericValue = Number(rawValue);
                        const hasValue = Number.isFinite(numericValue);
                        rows.push({
                            time: metricIndex === 0 ? `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` : "",
                            metricKey: metric.key,
                            label: metric.label,
                            numericValue: hasValue ? numericValue : null,
                            value: hasValue ? formatValue(numericValue, metric.unit) : "--",
                            status: hasValue ? getMetricStatus(metric, numericValue) : "Sem dados",
                        });
                    });
                }
            }
        }

        return rows;
    }

    async function generatePdf(element, fileName) {
        await waitForImages(element);

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            unit: "mm",
            format: "a4",
            orientation: "portrait",
            compress: true,
        });

        await addReportBlocks(pdf, element);
        addPdfFooters(pdf);
        pdf.save(fileName);
    }

    async function addReportBlocks(pdf, element) {
        const layout = createPdfLayout();
        const sections = Array.from(element.querySelectorAll(".pdf-report__section"));
        const header = element.querySelector(".pdf-report__header");
        const indexSection = element.querySelector(".pdf-report__index");
        const summarySection = sections[0];
        const chartsSection = sections[1];
        const tableSection = sections[2];
        let cursorY = layout.margin.top;

        paintPdfPage(pdf, layout);

        cursorY = await addElementBlock(pdf, header, layout, cursorY, { gap: 8 });
        await addElementBlock(pdf, indexSection, layout, cursorY, { gap: 0 });

        cursorY = addPdfPage(pdf, layout);
        await addElementBlock(pdf, summarySection, layout, cursorY, { gap: 0 });

        cursorY = addPdfPage(pdf, layout);
        cursorY = addSectionHeading(pdf, "Gráficos", layout, cursorY);
        for (const chartCard of chartsSection.querySelectorAll(".pdf-chart-card")) {
            cursorY = await addElementBlock(pdf, chartCard, layout, cursorY, { gap: 4 });
        }

        cursorY = addPdfPage(pdf, layout);
        cursorY = addSectionHeading(pdf, "Tabela detalhada", layout, cursorY);
        const tableContent = tableSection.querySelector(".pdf-table, .pdf-empty");
        await addElementBlock(pdf, tableContent, layout, cursorY, { allowSplit: true, gap: 0 });
    }

    function createPdfLayout() {
        return {
            pageWidth: 210,
            pageHeight: 297,
            contentWidth: 194,
            contentBottom: 281,
            margin: {
                top: 8,
                right: 8,
                bottom: 16,
                left: 8,
            },
        };
    }

    async function addElementBlock(pdf, element, layout, cursorY, options = {}) {
        if (!element) return cursorY;

        const gap = options.gap ?? 4;
        const canvas = await captureElement(element);
        const heightMm = getCanvasHeightMm(canvas, layout);

        if (options.allowSplit || heightMm > getContentHeight(layout)) {
            return addCanvasSlices(pdf, canvas, layout, cursorY, gap);
        }

        if (cursorY + heightMm > layout.contentBottom) {
            cursorY = addPdfPage(pdf, layout);
        }

        addCanvasImage(pdf, canvas, layout, cursorY, heightMm);
        return cursorY + heightMm + gap;
    }

    async function captureElement(element) {
        return html2canvas(element, {
            scale: 2,
            backgroundColor: "#0b1120",
            useCORS: true,
            scrollX: 0,
            scrollY: 0,
            windowWidth: Math.max(element.scrollWidth, element.offsetWidth),
            windowHeight: Math.max(element.scrollHeight, element.offsetHeight),
        });
    }

    function addCanvasSlices(pdf, canvas, layout, cursorY, gap) {
        const pixelsPerMm = canvas.width / layout.contentWidth;
        let sourceY = 0;

        while (sourceY < canvas.height) {
            const availableHeight = layout.contentBottom - cursorY;
            if (availableHeight < 35) {
                cursorY = addPdfPage(pdf, layout);
            }

            const sliceHeight = Math.min(
                Math.floor((layout.contentBottom - cursorY) * pixelsPerMm),
                canvas.height - sourceY
            );
            const pageCanvas = createCanvasSlice(canvas, sourceY, sliceHeight);
            const sliceHeightMm = sliceHeight / pixelsPerMm;

            addCanvasImage(pdf, pageCanvas, layout, cursorY, sliceHeightMm);
            sourceY += sliceHeight;
            cursorY += sliceHeightMm;

            if (sourceY < canvas.height) {
                cursorY = addPdfPage(pdf, layout);
            }
        }

        return cursorY + gap;
    }

    function createCanvasSlice(canvas, sourceY, sliceHeight) {
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;

        const context = pageCanvas.getContext("2d");
        context.fillStyle = "#0b1120";
        context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        context.drawImage(
            canvas,
            0,
            sourceY,
            canvas.width,
            sliceHeight,
            0,
            0,
            pageCanvas.width,
            pageCanvas.height
        );

        return pageCanvas;
    }

    function addCanvasImage(pdf, canvas, layout, y, heightMm) {
        pdf.addImage(
            canvas.toDataURL("image/jpeg", 0.96),
            "JPEG",
            layout.margin.left,
            y,
            layout.contentWidth,
            heightMm
        );
    }

    function getCanvasHeightMm(canvas, layout) {
        return canvas.height * layout.contentWidth / canvas.width;
    }

    function getContentHeight(layout) {
        return layout.contentBottom - layout.margin.top;
    }

    function addSectionHeading(pdf, title, layout, cursorY) {
        const height = 8;
        if (cursorY + height > layout.contentBottom) {
            cursorY = addPdfPage(pdf, layout);
        }

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(148, 163, 184);
        pdf.text(title.toUpperCase(), layout.margin.left, cursorY + 4);
        return cursorY + height;
    }

    function addPdfPage(pdf, layout) {
        pdf.addPage();
        paintPdfPage(pdf, layout);
        return layout.margin.top;
    }

    function paintPdfPage(pdf, layout) {
        pdf.setFillColor(11, 17, 32);
        pdf.rect(0, 0, layout.pageWidth, layout.pageHeight, "F");
    }

    function waitForImages(element) {
        const images = Array.from(element.querySelectorAll("img"));
        const pending = images
            .filter(img => !img.complete)
            .map(img => new Promise(resolve => {
                img.addEventListener("load", resolve, { once: true });
                img.addEventListener("error", resolve, { once: true });
            }));

        return Promise.all(pending);
    }

    function addPdfFooters(pdf) {
        const pageCount = pdf.internal.getNumberOfPages();
        const generatedAt = formatDateTime(new Date());

        for (let page = 1; page <= pageCount; page++) {
            pdf.setPage(page);
            pdf.setFontSize(8);
            pdf.setTextColor(148, 163, 184);
            pdf.text("Estação Climática", 8, 290);
            pdf.text(`Página ${page} / ${pageCount}`, 105, 290, { align: "center" });
            pdf.text(generatedAt, 202, 290, { align: "right" });
        }
    }

    function getMetricStatus(metric, value) {
        if (!Number.isFinite(value)) return "Sem dados";
        if (["temperature", "feelsLike"].includes(metric.key)) {
            const band = AppConfig.comfortBand;
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

    window.ClimatePdfReport = {
        setup,
    };
})();
