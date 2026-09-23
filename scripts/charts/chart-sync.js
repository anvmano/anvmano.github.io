'use strict';

(function () {
    const graficosPorGrupo = new Map();
    const indiceAtivoPorGrupo = new Map();

    function registrar(grafico, grupo) {
        if (!grafico || !grupo) return;
        desregistrar(grafico);

        const graficos = graficosPorGrupo.get(grupo) || new Set();
        graficos.add(grafico);
        graficosPorGrupo.set(grupo, graficos);
        indiceAtivoPorGrupo.delete(grupo);
        grafico.$grupoSincronizacao = grupo;
    }

    function desregistrar(grafico) {
        const grupo = grafico?.$grupoSincronizacao;
        if (!grupo) return;

        const graficos = graficosPorGrupo.get(grupo);
        graficos?.delete(grafico);
        if (!graficos?.size) {
            graficosPorGrupo.delete(grupo);
            indiceAtivoPorGrupo.delete(grupo);
        }
        delete grafico.$grupoSincronizacao;
    }

    function tratarInteracao(graficoOrigem, evento, elementosAtivos) {
        const grupo = graficoOrigem?.$grupoSincronizacao;
        if (!grupo) return;

        if (evento?.type === "mouseout" || !elementosAtivos?.length) {
            limparGrupo(grupo);
            return;
        }

        const indice = elementosAtivos[0].index;
        const chaveTemporal = graficoOrigem.$chavesSincronizacao?.[indice] || null;
        sincronizarIndice(grupo, indice, chaveTemporal, graficoOrigem);
    }

    function sincronizarIndice(grupo, indice, chaveTemporal = null, graficoOrigem = null) {
        const assinatura = chaveTemporal || indice;
        if (!Number.isInteger(indice) || indiceAtivoPorGrupo.get(grupo) === assinatura) return;

        const graficos = graficosPorGrupo.get(grupo);
        if (!graficos?.size) return;
        indiceAtivoPorGrupo.set(grupo, assinatura);

        for (const grafico of [...graficos]) {
            if (!grafico?.canvas?.isConnected) {
                desregistrar(grafico);
                continue;
            }
            if (grafico === graficoOrigem) continue;
            const indiceGrafico = localizarIndiceTemporal(grafico, indice, chaveTemporal);
            ativarIndice(grafico, indiceGrafico);
        }
    }

    function localizarIndiceTemporal(grafico, indiceOriginal, chaveTemporal) {
        const chaves = grafico.$chavesSincronizacao;
        if (!chaveTemporal || !Array.isArray(chaves) || !chaves.length) return indiceOriginal;

        const indiceExato = chaves.indexOf(chaveTemporal);
        if (indiceExato >= 0) return indiceExato;

        const instanteAlvo = converterInstante(chaveTemporal);
        if (instanteAlvo === null) return indiceOriginal;

        let melhorIndice = -1;
        let menorDiferenca = Number.POSITIVE_INFINITY;
        chaves.forEach((chave, indice) => {
            const instante = converterInstante(chave);
            if (instante === null) return;
            const diferenca = Math.abs(instante - instanteAlvo);
            if (diferenca < menorDiferenca) {
                menorDiferenca = diferenca;
                melhorIndice = indice;
            }
        });

        return menorDiferenca <= 45 * 60 * 1000 ? melhorIndice : -1;
    }

    function converterInstante(valor) {
        const texto = String(valor || "").replace(" ", "T");
        const instante = new Date(texto).getTime();
        return Number.isFinite(instante) ? instante : null;
    }

    function ativarIndice(grafico, indice) {
        if (!Number.isInteger(indice) || indice < 0) {
            grafico.setActiveElements?.([]);
            grafico.tooltip?.setActiveElements?.([], { x: 0, y: 0 });
            grafico.update?.("none");
            return;
        }
        const elementos = obterElementosAtivos(grafico, indice);
        const posicao = obterPosicaoTooltip(grafico, elementos, indice);
        grafico.setActiveElements?.(elementos);
        grafico.tooltip?.setActiveElements?.(elementos, posicao);
        grafico.update?.("none");
    }

    function obterElementosAtivos(grafico, indice) {
        return (grafico.data?.datasets || []).flatMap((serie, indiceSerie) => {
            const valor = obterValorPonto(serie.data?.[indice]);
            return Number.isFinite(valor) ? [{ datasetIndex: indiceSerie, index: indice }] : [];
        });
    }

    function obterValorPonto(ponto) {
        if (ponto === null || ponto === undefined || ponto === "") return null;
        if (ponto && typeof ponto === "object") return Number(ponto.y);
        return Number(ponto);
    }

    function obterPosicaoTooltip(grafico, elementos, indice) {
        const elemento = elementos.length
            ? grafico.getDatasetMeta?.(elementos[0].datasetIndex)?.data?.[indice]
            : null;
        const posicaoElemento = elemento?.tooltipPosition?.();
        if (posicaoElemento) return posicaoElemento;

        const area = grafico.chartArea || {};
        const escalaX = grafico.scales?.x;
        return {
            x: escalaX?.getPixelForValue?.(indice) ?? area.left ?? 0,
            y: area.top ?? 0,
        };
    }

    function limparGrupo(grupo) {
        const graficos = graficosPorGrupo.get(grupo);
        if (!graficos?.size || !indiceAtivoPorGrupo.has(grupo)) return;
        indiceAtivoPorGrupo.delete(grupo);

        for (const grafico of [...graficos]) {
            if (!grafico?.canvas?.isConnected) {
                desregistrar(grafico);
                continue;
            }
            grafico.setActiveElements?.([]);
            grafico.tooltip?.setActiveElements?.([], { x: 0, y: 0 });
            grafico.update?.("none");
        }
    }

    window.ClimateChartSync = {
        registrar,
        desregistrar,
        tratarInteracao,
        limparGrupo,
    };
})();
