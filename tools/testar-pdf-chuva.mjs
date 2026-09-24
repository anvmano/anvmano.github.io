import verificar from "node:assert/strict";
import arquivos from "node:fs";
import servidorHttp from "node:http";
import sistemaOperacional from "node:os";
import caminho from "node:path";
import { chromium } from "playwright-core";
import { getDocument as obterDocumento, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";

const raiz = process.cwd();
const executavel = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(arquivos.existsSync);
verificar.ok(executavel, "Chrome ou Edge não encontrado para testar o gráfico de chuva do PDF.");

const servidor = servidorHttp.createServer((requisicao, resposta) => {
    const url = new URL(requisicao.url, "http://localhost");
    const relativo = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
    const arquivo = caminho.resolve(raiz, relativo);
    if (!arquivo.startsWith(raiz) || !arquivos.existsSync(arquivo) || arquivos.statSync(arquivo).isDirectory()) {
        resposta.writeHead(404).end();
        return;
    }
    const tipos = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png" };
    resposta.setHeader("Content-Type", tipos[caminho.extname(arquivo)] || "application/octet-stream");
    arquivos.createReadStream(arquivo).pipe(resposta);
});

await new Promise(resolver => servidor.listen(0, "127.0.0.1", resolver));
const porta = servidor.address().port;
const navegador = await chromium.launch({ executablePath: executavel, headless: true });
const destino = caminho.join(sistemaOperacional.tmpdir(), `relatorio-chuva-teste-${Date.now()}.pdf`);

try {
    for (const largura of [390, 1440]) {
    const pagina = await navegador.newPage({ viewport: { width: largura, height: 900 } });
    await pagina.goto(`http://127.0.0.1:${porta}/`, { waitUntil: "domcontentloaded" });
    await pagina.evaluate(async () => {
        await window.ClimateAssets.carregarChart();
        await window.ClimateAssets.carregarRelatorio();
    });

    const resultado = await pagina.evaluate(async () => {
        let escalasChuva = null;
        window.Chart.register({
            id: "auditoriaChuvaPdf",
            afterDraw(grafico) {
                if (grafico.options.responsive || !grafico.scales.yProbabilidade) return;
                escalasChuva = {
                    legenda: grafico.options.plugins.legend.display,
                    milimetros: grafico.scales.yMilimetros.width,
                    porcentagem: grafico.scales.yProbabilidade.width,
                    limite: grafico.scales.yProbabilidade.max,
                    series: grafico.data.datasets.filter((_, indice) => grafico.isDatasetVisible(indice)).length,
                    ticks: grafico.options.scales.x.ticks.maxTicksLimit,
                };
            },
        });
        const previsao = [];
        const inicio = new Date("2026-09-21T12:00:00");
        for (let indice = 0; indice < 38; indice += 1) {
            const horario = new Date(inicio.getTime() + indice * 60 * 60 * 1000);
            previsao.push({
                horario: `${horario.getFullYear()}-${String(horario.getMonth() + 1).padStart(2, "0")}-${String(horario.getDate()).padStart(2, "0")}T${String(horario.getHours()).padStart(2, "0")}:00`,
                precipitacao: indice >= 25 ? 0.6 : indice === 20 ? 1.4 : 0,
                probabilidadeChuva: indice >= 25 ? 72 : 8,
            });
        }

        const relatorio = await window.ClimatePdfReportModules.exporter.buildReport({
            activeTab: "Tab0",
            selectedDate: "22-09-2026",
            latestData: { livingRoom: {}, room: {}, aquarium: {}, solar: {} },
            dadosClimaExterno: {
                atualizadoEm: new Date("2026-09-22T12:00:00"),
                origem: { rotulo: "Campinas - São Paulo" },
                climaAtual: { precipitacao: 0.4, chuva: 0.4, codigoTempo: 61 },
                previsaoCurtoPrazo: previsao,
            },
        });
        const cardResumo = relatorio.summaryCards.find(card => card.label === "Chuva externa");
        const cardGrafico = relatorio.chartCards.find(card => card.label.startsWith("Chuva"));
        window.__relatorioChuvaTeste = relatorio;
        return {
            escalasChuva,
            imagemChuva: cardGrafico?.image,
            resumo: cardResumo ? { atual: cardResumo.current, origem: cardResumo.details.at(-1)?.value } : null,
            grafico: cardGrafico ? {
                imagem: cardGrafico.image?.startsWith("data:image/png") || false,
                largo: cardGrafico.wide,
                estatisticas: cardGrafico.stats,
            } : null,
        };
    });

    verificar.deepEqual(resultado.resumo, { atual: "Chovendo agora", origem: "Campinas - São Paulo" });
    verificar.equal(resultado.escalasChuva.legenda, true);
    verificar.ok(resultado.escalasChuva.milimetros > 0);
    verificar.ok(resultado.escalasChuva.porcentagem > 0);
    verificar.equal(resultado.escalasChuva.limite, 100);
    verificar.equal(resultado.escalasChuva.series, 3);
    verificar.equal(resultado.escalasChuva.ticks, 13);
    const pastaEvidencias = caminho.join(raiz, "ui-ux-evidence/2026-09-23-etapa-1");
    arquivos.mkdirSync(pastaEvidencias, { recursive: true });
    arquivos.writeFileSync(caminho.join(pastaEvidencias, `chuva-pdf-${largura}.png`), Buffer.from(resultado.imagemChuva.split(",")[1], "base64"));
    verificar.equal(resultado.grafico?.imagem, true);
    verificar.equal(resultado.grafico?.largo, true);
    verificar.match(resultado.grafico?.estatisticas?.[0] || "", /Registrado 24h:/);
    verificar.match(resultado.grafico?.estatisticas?.[1] || "", /Previsto 12h:/);
    verificar.match(resultado.grafico?.estatisticas?.[2] || "", /72%/);

    await pagina.evaluate(async () => {
        await window.ClimateAssets.carregarCssRelatorio();
        await window.ClimatePdfReportModules.exporter.carregarBibliotecasPdf();
        const raiz = document.createElement("div");
        raiz.className = "pdf-render-root";
        raiz.appendChild(window.__relatorioChuvaTeste.element);
        document.body.appendChild(raiz);
    });
    const arquivoBaixado = pagina.waitForEvent("download");
    await pagina.evaluate(() => window.ClimatePdfReportModules.pdf.generatePdf(
        window.__relatorioChuvaTeste.element,
        "relatorio-chuva-teste.pdf"
    ));
    await (await arquivoBaixado).saveAs(destino);
    const pastaPaginacao = caminho.join(raiz, "ui-ux-evidence/2026-09-23-etapa-6");
    arquivos.mkdirSync(pastaPaginacao, { recursive: true });
    arquivos.copyFileSync(destino, caminho.join(pastaPaginacao, `relatorio-${largura}.pdf`));

    const bytes = new Uint8Array(arquivos.readFileSync(destino));
    const documento = await obterDocumento({ data: bytes, disableWorker: true, useSystemFonts: true, verbosity: 0 }).promise;
    verificar.ok(documento.numPages >= 2, "O PDF com chuva deve conter resumo e gráficos.");
    let imagens = 0;
    for (let indice = 1; indice <= documento.numPages; indice += 1) {
        const paginaPdf = await documento.getPage(indice);
        const operadores = await paginaPdf.getOperatorList();
        if (indice === 1) {
            const imagensPrimeiraPagina = operadores.fnArray.filter(codigo => [OPS.paintImageXObject, OPS.paintInlineImageXObject].includes(codigo)).length;
            verificar.ok(imagensPrimeiraPagina >= 2, "A primeira pagina deve conter cabecalho e indicadores, nao apenas o cabecalho.");
        }
        imagens += operadores.fnArray.filter(codigo => [OPS.paintImageXObject, OPS.paintInlineImageXObject].includes(codigo)).length;
    }
    verificar.ok(imagens >= 3, "O PDF deve conter os blocos visuais, incluindo o gráfico de chuva.");
    console.log("Card e gráfico de chuva do relatório PDF concluídos com sucesso.");
    await pagina.close();
    }
} finally {
    await navegador.close();
    await new Promise(resolver => servidor.close(resolver));
    if (arquivos.existsSync(destino)) arquivos.unlinkSync(destino);
}
