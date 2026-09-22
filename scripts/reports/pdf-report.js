'use strict';

(function () {
    let obterContextoAtual = null;
    let formatoSelecionado = "pdf";
    let carregamentoRelatorio = null;
    let ultimaTentativa = null;

    function configurarModulo({ buttonId: idBotao, formatName: nomeFormato = "exportFormat", getContext: obterContextoModulo } = {}) {
        obterContextoAtual = obterContextoModulo;
        const botao = document.getElementById(idBotao);
        if (!botao) return;

        configurarControlesFormato(botao, nomeFormato);
        botao.addEventListener("click", () => exportarAbaAtiva(botao));
        document.getElementById("btnRetryExport")?.addEventListener("click", () => ultimaTentativa?.());
    }

    async function exportarAbaAtiva(botao) {
        const formato = obterFormatoSelecionado();
        const textoOriginal = botao.innerText;
        botao.disabled = true;
        botao.innerText = formato === "json" ? "Gerando JSON..." : "Gerando PDF...";
        ultimaTentativa = () => exportarAbaAtiva(botao);
        atualizarProgresso("Preparando exportação.", "loading");

        try {
            await executarComTimeout(async controle => {
                const informar = mensagem => {
                    if (!controle.cancelado) atualizarProgresso(mensagem, "loading");
                };
                const exportador = await carregarExportador(formato);
                if (controle.cancelado) return;
                const contexto = obterContextoAtual ? obterContextoAtual() : {};
                if (!window.ClimateContracts?.validarContextoRelatorio?.(contexto)) {
                    throw new TypeError("Contexto de exportação inválido.");
                }
                const relatorio = await exportador.buildReport(contexto, {
                    onProgress: informar,
                });
                if (controle.cancelado) return;

                if (formato === "json") {
                    exportador.exportJsonReport(relatorio);
                    atualizarProgresso("Download iniciado.", "success");
                    return;
                }

                atualizarProgresso("Montando PDF.", "loading");
                await exportador.carregarBibliotecasPdf?.();
                if (controle.cancelado) return;
                const raizRenderizacao = document.createElement("div");
                raizRenderizacao.className = "pdf-render-root";
                try {
                    raizRenderizacao.appendChild(relatorio.element);
                    document.body.appendChild(raizRenderizacao);
                    await window.ClimatePdfReportModules.pdf.generatePdf(relatorio.element, relatorio.fileNamePdf, {
                        deveCancelar: () => controle.cancelado,
                    });
                    if (controle.cancelado) return;
                    atualizarProgresso("Download iniciado.", "success");
                } finally {
                    raizRenderizacao.remove();
                }
            });
        } catch (erro) {
            window.ClimateDiagnostics?.depurar("Erro ao exportar dados.", erro);
            const mensagem = erro?.name === "TimeoutError"
                ? "A exportação demorou além do esperado. Verifique a conexão e tente novamente."
                : "Falha ao exportar. Verifique a conexão e tente novamente.";
            atualizarProgresso(mensagem, "error", true);
        } finally {
            botao.disabled = false;
            botao.innerText = textoOriginal || obterRotuloBotao(obterFormatoSelecionado());
        }
    }

    function executarComTimeout(acao) {
        const limite = Number(window.AppConfig?.exports?.timeoutMs) || 45000;
        let temporizador;
        const controle = { cancelado: false };
        return Promise.race([
            Promise.resolve().then(() => acao(controle)),
            new Promise((resolver, rejeitar) => {
                temporizador = setTimeout(() => {
                    controle.cancelado = true;
                    const erro = new Error("Tempo limite da exportação excedido.");
                    erro.name = "TimeoutError";
                    rejeitar(erro);
                }, limite);
            }),
        ]).finally(() => clearTimeout(temporizador));
    }

    function atualizarProgresso(mensagem, tipo, permitirNovaTentativa = false) {
        const retornoVisual = document.getElementById("exportFeedback");
        const estado = document.getElementById("exportStatus");
        const repetir = document.getElementById("btnRetryExport");
        if (!retornoVisual || !estado) return;
        retornoVisual.hidden = false;
        retornoVisual.classList.toggle("is-error", tipo === "error");
        retornoVisual.setAttribute("role", tipo === "error" ? "alert" : "status");
        estado.textContent = mensagem;
        if (repetir) repetir.hidden = !permitirNovaTentativa;
    }

    function configurarControlesFormato(botao, nomeFormato) {
        const entradasDados = Array.from(document.querySelectorAll(`input[name="${nomeFormato}"]`));
        if (!entradasDados.length) {
            botao.innerText = obterRotuloBotao(formatoSelecionado);
            return;
        }

        const sincronizar = () => {
            formatoSelecionado = obterFormatoSelecionado(nomeFormato);
            botao.innerText = obterRotuloBotao(formatoSelecionado);
        };

        entradasDados.forEach(entrada => entrada.addEventListener("change", sincronizar));
        sincronizar();
    }

    function obterFormatoSelecionado(nomeFormato = "exportFormat") {
        const marcado = document.querySelector(`input[name="${nomeFormato}"]:checked`);
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
        setup: configurarModulo,
    };
})();
