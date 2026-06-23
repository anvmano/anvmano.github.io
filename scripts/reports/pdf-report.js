'use strict';

(function () {
    let contextoGetter = null;
    let formatoSelecionado = "pdf";
    let carregamentoRelatorio = null;

    function setup({ buttonId, formatName = "exportFormat", getContext } = {}) {
        contextoGetter = getContext;
        const botao = document.getElementById(buttonId);
        if (!botao) return;

        configurarControlesFormato(botao, formatName);
        botao.addEventListener("click", () => exportarAbaAtiva(botao));
    }

    async function exportarAbaAtiva(botao) {
        const formato = obterFormatoSelecionado();
        const textoOriginal = botao.innerText;
        botao.disabled = true;
        botao.innerText = formato === "json" ? "Gerando JSON..." : "Gerando PDF...";

        try {
            const exportador = await carregarExportador(formato);
            const contexto = contextoGetter ? contextoGetter() : {};
            const relatorio = await exportador.buildReport(contexto);

            if (formato === "json") {
                exportador.exportJsonReport(relatorio);
                return;
            }

            await exportador.carregarBibliotecasPdf?.();
            const raizRenderizacao = document.createElement("div");
            raizRenderizacao.className = "pdf-render-root";
            try {
                raizRenderizacao.appendChild(relatorio.element);
                document.body.appendChild(raizRenderizacao);
                await window.ClimatePdfReportModules.pdf.generatePdf(relatorio.element, relatorio.fileNamePdf);
            } finally {
                raizRenderizacao.remove();
            }
        } catch (error) {
            window.ClimateDiagnostics?.depurar("Erro ao exportar dados.", error);
            alert("Não foi possível exportar os dados.");
        } finally {
            botao.disabled = false;
            botao.innerText = textoOriginal || obterRotuloBotao(obterFormatoSelecionado());
        }
    }

    function configurarControlesFormato(botao, formatName) {
        const inputs = Array.from(document.querySelectorAll(`input[name="${formatName}"]`));
        if (!inputs.length) {
            botao.innerText = obterRotuloBotao(formatoSelecionado);
            return;
        }

        const sincronizar = () => {
            formatoSelecionado = obterFormatoSelecionado(formatName);
            botao.innerText = obterRotuloBotao(formatoSelecionado);
        };

        inputs.forEach(input => input.addEventListener("change", sincronizar));
        sincronizar();
    }

    function obterFormatoSelecionado(formatName = "exportFormat") {
        const marcado = document.querySelector(`input[name="${formatName}"]:checked`);
        return marcado?.value === "json" ? "json" : "pdf";
    }

    function obterRotuloBotao(formato) {
        return formato === "json" ? "Exportar JSON" : "Exportar PDF";
    }

    async function carregarExportador(formato) {
        if (!carregamentoRelatorio) {
            carregamentoRelatorio = window.ClimateAssets?.carregarRelatorio?.() || Promise.reject(new Error("Carregador do relatório indisponível."));
        }

        if (formato === "pdf") {
            await window.ClimateAssets?.carregarCssRelatorio?.();
            await window.ClimateAssets?.carregarChart?.();
            window.ClimateCharts?.registerComfortBand?.();
        }

        await carregamentoRelatorio;

        const exportador = window.ClimatePdfReportModules?.exporter;
        if (!exportador) throw new Error("Exportador de relatório indisponível.");
        return exportador;
    }

    window.ClimatePdfReport = {
        setup,
    };
})();
