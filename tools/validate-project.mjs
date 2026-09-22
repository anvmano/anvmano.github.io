import arquivos from "node:fs";
import caminho from "node:path";
import maquinaVirtual from "node:vm";
import { fileURLToPath } from "node:url";

const raiz = caminho.resolve(caminho.dirname(fileURLToPath(import.meta.url)), "..");

function lerArquivo(arquivo) {
    return arquivos.readFileSync(caminho.join(raiz, arquivo), "utf8");
}

function verificar(condicao, mensagem) {
    if (!condicao) {
        throw new Error(mensagem);
    }
}

function listarArquivos(diretorio, extensao) {
    return arquivos.readdirSync(diretorio, { withFileTypes: true }).flatMap(entrada => {
        const caminhoCompleto = caminho.join(diretorio, entrada.name);
        if (entrada.isDirectory()) {
            return ["node_modules", "legacy"].includes(entrada.name) ? [] : listarArquivos(caminhoCompleto, extensao);
        }
        return entrada.isFile() && entrada.name.endsWith(extensao) ? [caminhoCompleto] : [];
    });
}

function validarSintaxeJavaScript() {
    const arquivosJavaScript = listarArquivos(raiz, ".js");
    arquivosJavaScript.forEach(arquivo => {
        const caminhoRelativo = caminho.relative(raiz, arquivo);
        new maquinaVirtual.Script(arquivos.readFileSync(arquivo, "utf8"), { filename: caminhoRelativo });
    });
    return arquivosJavaScript.length;
}

function obterIdsHtml(html) {
    return [...html.matchAll(/\bid="([^"]+)"/g)].map(correspondencia => correspondencia[1]);
}

function obterReferenciasLocais(html) {
    return [...html.matchAll(/(?:src|href)="(?!https?:\/\/)([^"]+)"/g)]
        .map(correspondencia => correspondencia[1].split("?")[0]);
}

function obterImportsCss(textoCss) {
    return [...textoCss.matchAll(/@import\s+url\(["']?([^"')]+)["']?\)/g)]
        .map(correspondencia => correspondencia[1].split("?")[0]);
}

function obterBlocoConfiguracao(textoConfiguracao, chaveInicial, proximaChave) {
    const padrao = new RegExp(`${chaveInicial}:\\s*{([\\s\\S]*?)\\n\\s*},\\n\\s*${proximaChave}:`);
    return textoConfiguracao.match(padrao)?.[1] || "";
}

function obterValoresTextoObjeto(bloco) {
    return [...bloco.matchAll(/:\s*"([^"]+)"/g)].map(correspondencia => correspondencia[1]);
}

function validarContratosHtml() {
    const html = lerArquivo("index.html");
    const ids = obterIdsHtml(html);
    const idsDuplicados = [...new Set(ids.filter((id, indice) => ids.indexOf(id) !== indice))];
    verificar(!idsDuplicados.length, `IDs duplicados no HTML: ${idsDuplicados.join(", ")}`);

    const referenciasAusentes = obterReferenciasLocais(html).filter(ref => !arquivos.existsSync(caminho.join(raiz, ref)));
    verificar(!referenciasAusentes.length, `Arquivos referenciados ausentes: ${referenciasAusentes.join(", ")}`);

    const importsCss = obterImportsCss(lerArquivo("style.css"));
    const importsCssAusentes = importsCss.filter(ref => !arquivos.existsSync(caminho.join(raiz, ref)));
    verificar(!importsCssAusentes.length, `CSS imports ausentes: ${importsCssAusentes.join(", ")}`);

    const textoConfiguracao = lerArquivo("scripts/config.js");
    const idsRecipientesGraficos = obterValoresTextoObjeto(obterBlocoConfiguracao(textoConfiguracao, "chartContainers", "charts"));
    const recipientesGraficosAusentes = idsRecipientesGraficos.filter(id => !ids.includes(id));
    verificar(!recipientesGraficosAusentes.length, `chartContainers sem id no HTML: ${recipientesGraficosAusentes.join(", ")}`);

    const idsGraficos = obterValoresTextoObjeto(obterBlocoConfiguracao(textoConfiguracao, "charts", "advancedViews"));
    const idsGraficosAusentes = idsGraficos.filter(id => !ids.includes(id));
    verificar(!idsGraficosAusentes.length, `charts sem canvas no HTML: ${idsGraficosAusentes.join(", ")}`);

    const cartaoChuvaOculto = /id="chart-container-rain"[^>]*\bhidden\b/.test(html);
    verificar(cartaoChuvaOculto, "O gráfico privado de chuva deve iniciar oculto até a localização ser consultada.");

    const estilosGraficos = lerArquivo("styles/charts.css");
    const atributoOcultoRespeitado = /\.chart-card\[hidden\]\s*\{[^}]*display\s*:\s*none\s*;/s.test(estilosGraficos);
    verificar(atributoOcultoRespeitado, "O CSS deve preservar o atributo hidden nos cards de gráfico.");
}

const arquivosAnalisados = validarSintaxeJavaScript();
validarContratosHtml();

console.log(`OK: ${arquivosAnalisados} arquivos JS validados; contratos HTML/config e imports CSS conferidos.`);
