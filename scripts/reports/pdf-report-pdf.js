'use strict';

(function () {
    const modules = window.ClimatePdfReportModules = window.ClimatePdfReportModules || {};

    const { format } = modules;
    const { formatDateTime } = format;

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
        const header = element.querySelector(".pdf-report__header");
        const summarySection = element.querySelector(".pdf-report__summary-section");
        const chartsSection = element.querySelector(".pdf-report__charts-section");
        const tableSection = element.querySelector(".pdf-report__table-section");
        let cursorY = layout.margin.top;

        paintPdfPage(pdf, layout);

        cursorY = await addElementBlock(pdf, header, layout, cursorY, { gap: 6 });
        await addElementBlock(pdf, summarySection, layout, cursorY, { gap: 0 });

        cursorY = addPdfPage(pdf, layout);
        cursorY = addSectionHeading(pdf, "Gráficos", layout, cursorY);
        for (const chartCard of chartsSection.querySelectorAll(".pdf-chart-card")) {
            cursorY = await addElementBlock(pdf, chartCard, layout, cursorY, { gap: 4 });
        }

        if (tableSection) {
            cursorY = addPdfPage(pdf, layout);
            cursorY = addSectionHeading(pdf, "Tabela resumida", layout, cursorY);
            const tableContent = tableSection.querySelector(".pdf-table, .pdf-empty");
            await addElementBlock(pdf, tableContent, layout, cursorY, { allowSplit: true, gap: 0 });
        }
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
            logging: false,
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

    modules.pdf = {
        generatePdf,
        addReportBlocks,
        createPdfLayout,
        addElementBlock,
        captureElement,
        addCanvasSlices,
        createCanvasSlice,
        addCanvasImage,
        getCanvasHeightMm,
        getContentHeight,
        addSectionHeading,
        addPdfPage,
        paintPdfPage,
        waitForImages,
        addPdfFooters,
    };
})();
