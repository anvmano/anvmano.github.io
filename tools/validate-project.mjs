import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(file) {
    return fs.readFileSync(path.join(root, file), "utf8");
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function listFiles(dir, extension) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            return entry.name === "node_modules" ? [] : listFiles(fullPath, extension);
        }
        return entry.isFile() && entry.name.endsWith(extension) ? [fullPath] : [];
    });
}

function validateJavaScriptSyntax() {
    const jsFiles = listFiles(root, ".js");
    jsFiles.forEach(file => {
        const relativePath = path.relative(root, file);
        new vm.Script(fs.readFileSync(file, "utf8"), { filename: relativePath });
    });
    return jsFiles.length;
}

function getHtmlIds(html) {
    return [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
}

function getLocalRefs(html) {
    return [...html.matchAll(/(?:src|href)="(?!https?:\/\/)([^"]+)"/g)]
        .map(match => match[1].split("?")[0]);
}

function getCssImports(cssText) {
    return [...cssText.matchAll(/@import\s+url\(["']?([^"')]+)["']?\)/g)]
        .map(match => match[1].split("?")[0]);
}

function getConfigBlock(configText, startKey, nextKey) {
    const pattern = new RegExp(`${startKey}:\\s*{([\\s\\S]*?)\\n\\s*},\\n\\s*${nextKey}:`);
    return configText.match(pattern)?.[1] || "";
}

function getObjectStringValues(block) {
    return [...block.matchAll(/:\s*"([^"]+)"/g)].map(match => match[1]);
}

function validateHtmlContracts() {
    const html = read("index.html");
    const ids = getHtmlIds(html);
    const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
    assert(!duplicateIds.length, `IDs duplicados no HTML: ${duplicateIds.join(", ")}`);

    const missingRefs = getLocalRefs(html).filter(ref => !fs.existsSync(path.join(root, ref)));
    assert(!missingRefs.length, `Arquivos referenciados ausentes: ${missingRefs.join(", ")}`);

    const cssImports = getCssImports(read("style.css"));
    const missingCssImports = cssImports.filter(ref => !fs.existsSync(path.join(root, ref)));
    assert(!missingCssImports.length, `CSS imports ausentes: ${missingCssImports.join(", ")}`);

    const configText = read("scripts/config.js");
    const chartContainerIds = getObjectStringValues(getConfigBlock(configText, "chartContainers", "charts"));
    const missingChartContainers = chartContainerIds.filter(id => !ids.includes(id));
    assert(!missingChartContainers.length, `chartContainers sem id no HTML: ${missingChartContainers.join(", ")}`);

    const chartIds = getObjectStringValues(getConfigBlock(configText, "charts", "advancedViews"));
    const missingChartIds = chartIds.filter(id => !ids.includes(id));
    assert(!missingChartIds.length, `charts sem canvas no HTML: ${missingChartIds.join(", ")}`);
}

const parsedFiles = validateJavaScriptSyntax();
validateHtmlContracts();

console.log(`OK: ${parsedFiles} arquivos JS validados; contratos HTML/config e imports CSS conferidos.`);
