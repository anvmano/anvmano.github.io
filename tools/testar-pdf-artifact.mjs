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
verificar.ok(executavel, "Chrome ou Edge não encontrado para testar o PDF.");

const servidor = servidorHttp.createServer((requisicao, resposta) => {
    const relativo = decodeURIComponent(new URL(requisicao.url, "http://localhost").pathname.slice(1));
    const arquivo = caminho.resolve(raiz, relativo);
    if (!arquivo.startsWith(raiz) || !arquivos.existsSync(arquivo)) return resposta.writeHead(404).end();
    arquivos.createReadStream(arquivo).pipe(resposta);
});
await new Promise(resolver => servidor.listen(0, "127.0.0.1", resolver));
const porta = servidor.address().port;
const navegador = await chromium.launch({ executablePath: executavel, headless: true });
const destino = caminho.join(sistemaOperacional.tmpdir(), `relatorio-estacao-teste-${Date.now()}.pdf`);

try {
    const pagina = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
    await pagina.setContent(`<!doctype html><html><body style="margin:0;background:#0b1120;color:#fff;font-family:Arial">
        <article id="report" style="width:980px">
            <header class="pdf-report__header" style="height:100px"><h1>Estação Climática</h1><p>Relatório de teste</p></header>
            <section class="pdf-report__summary-section" style="height:500px"><h2>Resumo geral</h2><p>Temperatura 26°C</p></section>
            <section class="pdf-report__charts-section"><div class="pdf-chart-card" style="height:260px"><h3>Temperatura</h3><canvas width="800" height="180"></canvas></div><div class="pdf-chart-card" style="height:260px"><h3>Umidade</h3><canvas width="800" height="180"></canvas></div><div class="pdf-chart-card" style="height:260px"><h3>Pressão</h3><canvas width="800" height="180"></canvas></div></section>
            <section class="pdf-report__table-section"><table class="pdf-table" style="width:100%;height:1400px"><tbody>${Array.from({ length: 48 }, (_, i) => `<tr><td>${String(i % 24).padStart(2, "0")}:00</td><td>${20 + i / 10}°C</td></tr>`).join("")}</tbody></table></section>
        </article></body></html>`);
    await pagina.addScriptTag({ url: `http://127.0.0.1:${porta}/node_modules/html2canvas/dist/html2canvas.min.js` });
    await pagina.addScriptTag({ url: `http://127.0.0.1:${porta}/node_modules/jspdf/dist/jspdf.umd.min.js` });
    await pagina.addScriptTag({ content: "window.ClimatePdfReportModules={format:{formatDateTime:()=>\"16/08/2026 12:00\"}}" });
    await pagina.addScriptTag({ url: `http://127.0.0.1:${porta}/scripts/reports/pdf-report-pdf.js` });

    const arquivoBaixado = pagina.waitForEvent("download");
    await pagina.evaluate(() => window.ClimatePdfReportModules.pdf.generatePdf(document.getElementById("report"), "teste.pdf"));
    await (await arquivoBaixado).saveAs(destino);

    const bytes = new Uint8Array(arquivos.readFileSync(destino));
    const documento = await obterDocumento({ data: bytes, disableWorker: true, useSystemFonts: true, verbosity: 0 }).promise;
    verificar.ok(documento.numPages >= 4, "O relatório deve separar resumo, gráficos e tabela em páginas.");

    let textoCompleto = "";
    let imagens = 0;
    for (let indice = 1; indice <= documento.numPages; indice += 1) {
        const paginaPdf = await documento.getPage(indice);
        verificar.deepEqual(paginaPdf.view.slice(0, 2), [0, 0]);
        textoCompleto += (await paginaPdf.getTextContent()).items.map(item => item.str).join(" ");
        const operadores = await paginaPdf.getOperatorList();
        imagens += operadores.fnArray.filter(codigo => [OPS.paintImageXObject, OPS.paintInlineImageXObject].includes(codigo)).length;
    }
    verificar.match(textoCompleto, /Estação Climática/);
    verificar.match(textoCompleto, /Página 1/);
    verificar.ok(imagens >= 5, "Cabeçalho, resumo, gráficos e tabela devem ser capturados no PDF.");
    console.log(`PDF validado: ${documento.numPages} páginas e ${imagens} blocos visuais.`);
} finally {
    await navegador.close();
    await new Promise(resolver => servidor.close(resolver));
    if (arquivos.existsSync(destino)) arquivos.unlinkSync(destino);
}
