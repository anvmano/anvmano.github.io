'use strict';

(function () {
    const modulos = window.ClimatePdfReportModules = window.ClimatePdfReportModules || {};

    const { format: formatacao } = modulos;
    const { formatDateTime: formatarDataHoraRelatorio } = formatacao;

    async function gerarPdf(elemento, nomeArquivo, { deveCancelar = () => false } = {}) {
        await aguardarImagens(elemento);
        if (deveCancelar()) return;

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            unit: "mm",
            format: "a4",
            orientation: "portrait",
            compress: true,
        });

        await adicionarBlocosRelatorio(pdf, elemento);
        if (deveCancelar()) return;
        adicionarRodapesPdf(pdf);
        if (deveCancelar()) return;
        pdf.save(nomeArquivo);
    }

    async function adicionarBlocosRelatorio(pdf, elemento) {
        const leiaute = criarLeiautePdf();
        const cabecalho = elemento.querySelector(".pdf-report__header");
        const secaoResumo = elemento.querySelector(".pdf-report__summary-section");
        const secaoGraficos = elemento.querySelector(".pdf-report__charts-section");
        const secaoTabela = elemento.querySelector(".pdf-report__table-section");
        let posicaoAtualY = leiaute.margin.top;

        pintarPaginaPdf(pdf, leiaute);

        posicaoAtualY = await adicionarBlocoElemento(pdf, cabecalho, leiaute, posicaoAtualY, { gap: 6 });
        if (secaoResumo) {
            posicaoAtualY = adicionarTituloSecao(pdf, "Indicadores principais", leiaute, posicaoAtualY);
            for (const linha of secaoResumo.querySelectorAll(".pdf-summary-grid")) {
                posicaoAtualY = await adicionarBlocoElemento(pdf, linha, leiaute, posicaoAtualY, { gap: 3 });
            }
            await adicionarBlocoElemento(pdf, secaoResumo.querySelector(".pdf-alert-panel"), leiaute, posicaoAtualY, { gap: 0 });
        }

        posicaoAtualY = adicionarPaginaPdf(pdf, leiaute);
        posicaoAtualY = adicionarTituloSecao(pdf, "Gráficos", leiaute, posicaoAtualY);
        for (const cardGrafico of secaoGraficos.querySelectorAll(".pdf-chart-card")) {
            posicaoAtualY = await adicionarBlocoElemento(pdf, cardGrafico, leiaute, posicaoAtualY, { gap: 4 });
        }

        if (secaoTabela) {
            posicaoAtualY = adicionarPaginaPdf(pdf, leiaute);
            posicaoAtualY = adicionarTituloSecao(pdf, "Tabela resumida", leiaute, posicaoAtualY);
            const conteudoTabela = secaoTabela.querySelector(".pdf-table, .pdf-empty");
            await adicionarBlocoElemento(pdf, conteudoTabela, leiaute, posicaoAtualY, { allowSplit: true, gap: 0 });
        }
    }

    function criarLeiautePdf() {
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

    async function adicionarBlocoElemento(pdf, elemento, leiaute, posicaoAtualY, opcoes = {}) {
        if (!elemento) return posicaoAtualY;

        const intervaloVisual = opcoes.gap ?? 4;
        const canvas = await capturarElemento(elemento);
        const alturaMm = obterAlturaCanvasMm(canvas, leiaute);

        if (opcoes.allowSplit || alturaMm > obterAlturaConteudo(leiaute)) {
            return adicionarFatiasCanvas(pdf, canvas, leiaute, posicaoAtualY, intervaloVisual);
        }

        if (posicaoAtualY + alturaMm > leiaute.contentBottom) {
            posicaoAtualY = adicionarPaginaPdf(pdf, leiaute);
        }

        adicionarImagemCanvas(pdf, canvas, leiaute, posicaoAtualY, alturaMm);
        return posicaoAtualY + alturaMm + intervaloVisual;
    }

    async function capturarElemento(elemento) {
        return html2canvas(elemento, {
            scale: 2,
            backgroundColor: "#0b1120",
            useCORS: true,
            logging: false,
            scrollX: 0,
            scrollY: 0,
            windowWidth: Math.max(elemento.scrollWidth, elemento.offsetWidth),
            windowHeight: Math.max(elemento.scrollHeight, elemento.offsetHeight),
        });
    }

    function adicionarFatiasCanvas(pdf, canvas, leiaute, posicaoAtualY, intervaloVisual) {
        const pixelsPorMm = canvas.width / leiaute.contentWidth;
        let posicaoOrigemY = 0;

        while (posicaoOrigemY < canvas.height) {
            const alturaDisponivel = leiaute.contentBottom - posicaoAtualY;
            if (alturaDisponivel < 35) {
                posicaoAtualY = adicionarPaginaPdf(pdf, leiaute);
            }

            const alturaFatia = Math.min(
                Math.floor((leiaute.contentBottom - posicaoAtualY) * pixelsPorMm),
                canvas.height - posicaoOrigemY
            );
            const canvasPagina = criarFatiaCanvas(canvas, posicaoOrigemY, alturaFatia);
            const alturaFatiaMm = alturaFatia / pixelsPorMm;

            adicionarImagemCanvas(pdf, canvasPagina, leiaute, posicaoAtualY, alturaFatiaMm);
            posicaoOrigemY += alturaFatia;
            posicaoAtualY += alturaFatiaMm;

            if (posicaoOrigemY < canvas.height) {
                posicaoAtualY = adicionarPaginaPdf(pdf, leiaute);
            }
        }

        return posicaoAtualY + intervaloVisual;
    }

    function criarFatiaCanvas(canvas, posicaoOrigemY, alturaFatia) {
        const canvasPagina = document.createElement("canvas");
        canvasPagina.width = canvas.width;
        canvasPagina.height = alturaFatia;

        const contexto = canvasPagina.getContext("2d");
        contexto.fillStyle = "#0b1120";
        contexto.fillRect(0, 0, canvasPagina.width, canvasPagina.height);
        contexto.drawImage(
            canvas,
            0,
            posicaoOrigemY,
            canvas.width,
            alturaFatia,
            0,
            0,
            canvasPagina.width,
            canvasPagina.height
        );

        return canvasPagina;
    }

    function adicionarImagemCanvas(pdf, canvas, leiaute, y, alturaMm) {
        pdf.addImage(
            canvas.toDataURL("image/jpeg", 0.96),
            "JPEG",
            leiaute.margin.left,
            y,
            leiaute.contentWidth,
            alturaMm
        );
    }

    function obterAlturaCanvasMm(canvas, leiaute) {
        return canvas.height * leiaute.contentWidth / canvas.width;
    }

    function obterAlturaConteudo(leiaute) {
        return leiaute.contentBottom - leiaute.margin.top;
    }

    function adicionarTituloSecao(pdf, titulo, leiaute, posicaoAtualY) {
        const altura = 8;
        if (posicaoAtualY + altura > leiaute.contentBottom) {
            posicaoAtualY = adicionarPaginaPdf(pdf, leiaute);
        }

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(148, 163, 184);
        pdf.text(titulo.toUpperCase(), leiaute.margin.left, posicaoAtualY + 4);
        return posicaoAtualY + altura;
    }

    function adicionarPaginaPdf(pdf, leiaute) {
        pdf.addPage();
        pintarPaginaPdf(pdf, leiaute);
        return leiaute.margin.top;
    }

    function pintarPaginaPdf(pdf, leiaute) {
        pdf.setFillColor(11, 17, 32);
        pdf.rect(0, 0, leiaute.pageWidth, leiaute.pageHeight, "F");
    }

    function aguardarImagens(elemento) {
        const imagens = Array.from(elemento.querySelectorAll("img"));
        const pendente = imagens
            .filter(imagemElemento => !imagemElemento.complete)
            .map(imagemElemento => new Promise(resolver => {
                imagemElemento.addEventListener("load", resolver, { once: true });
                imagemElemento.addEventListener("error", resolver, { once: true });
            }));

        return Promise.all(pendente);
    }

    function adicionarRodapesPdf(pdf) {
        const quantidadePaginas = pdf.internal.getNumberOfPages();
        const geradoEm = formatarDataHoraRelatorio(new Date());

        for (let pagina = 1; pagina <= quantidadePaginas; pagina++) {
            pdf.setPage(pagina);
            pdf.setFontSize(8);
            pdf.setTextColor(148, 163, 184);
            pdf.text("Estação Climática", 8, 290);
            pdf.text(`Página ${pagina} / ${quantidadePaginas}`, 105, 290, { align: "center" });
            pdf.text(geradoEm, 202, 290, { align: "right" });
        }
    }

    modulos.pdf = {
        generatePdf: gerarPdf,
        addReportBlocks: adicionarBlocosRelatorio,
        createPdfLayout: criarLeiautePdf,
        addElementBlock: adicionarBlocoElemento,
        captureElement: capturarElemento,
        addCanvasSlices: adicionarFatiasCanvas,
        createCanvasSlice: criarFatiaCanvas,
        addCanvasImage: adicionarImagemCanvas,
        getCanvasHeightMm: obterAlturaCanvasMm,
        getContentHeight: obterAlturaConteudo,
        addSectionHeading: adicionarTituloSecao,
        addPdfPage: adicionarPaginaPdf,
        paintPdfPage: pintarPaginaPdf,
        waitForImages: aguardarImagens,
        addPdfFooters: adicionarRodapesPdf,
    };
})();
