import verificar from "node:assert/strict";
import arquivos from "node:fs";
import caminho from "node:path";
import maquinaVirtual from "node:vm";

class ListaClasses {
    constructor(...classes) {
        this.classes = new Set(classes);
    }

    add(classe) { this.classes.add(classe); }
    remove(classe) { this.classes.delete(classe); }
    contains(classe) { return this.classes.has(classe); }
}

class BotaoAba {
    constructor(alvo, ativo = false) {
        this.dataset = { tabTarget: alvo };
        this.classList = new ListaClasses("tablink", ...(ativo ? ["active"] : []));
        this.atributos = new Map();
        this.listeners = new Map();
    }

    addEventListener(tipo, aoConcluir) { this.listeners.set(tipo, aoConcluir); }
    setAttribute(nome, valor) { this.atributos.set(nome, String(valor)); }
    getAttribute(nome) { return this.atributos.get(nome); }
    focus() { documento.activeElement = this; }
    dispararTecla(tecla, shiftKey = false) {
        let prevenido = false;
        this.listeners.get("keydown")?.({
            key: tecla,
            shiftKey,
            currentTarget: this,
            preventDefault() { prevenido = true; },
        });
        return prevenido;
    }
}

class PainelAba {
    constructor(id) {
        this.id = id;
        this.style = {};
        this.atributos = new Set();
    }

    setAttribute(nome) { this.atributos.add(nome); }
    removeAttribute(nome) { this.atributos.delete(nome); }
    hasAttribute(nome) { return this.atributos.has(nome); }
}

const botoes = ["Tab0", "Tab1", "Tab2", "Tab3"].map((alvo, indice) => new BotaoAba(alvo, indice === 0));
const paineis = Object.fromEntries(["Tab0", "Tab1", "Tab2", "Tab3"].map(id => [id, new PainelAba(id)]));
const documento = {
    activeElement: null,
    querySelectorAll(seletor) {
        if (seletor === ".tabcontent") return Object.values(paineis);
        if (seletor === ".tablink" || seletor === ".tablink[data-tab-target]") return botoes;
        return [];
    },
    querySelector(seletor) {
        const alvo = seletor.match(/data-tab-target="([^"]+)"/)?.[1];
        if (seletor.includes(".active")) return botoes.find(botao => botao.classList.contains("active")) || null;
        return alvo ? botoes.find(botao => botao.dataset.tabTarget === alvo) || null : null;
    },
    getElementById(id) { return paineis[id] || null; },
};

const armazenamento = new Map();
const contexto = {
    window: null,
    document: documento,
    localStorage: {
        getItem(chave) { return armazenamento.get(chave) || null; },
        setItem(chave, valor) { armazenamento.set(chave, valor); },
    },
    Element: class {},
    CustomEvent: class {},
};
contexto.window = contexto;
maquinaVirtual.createContext(contexto);
maquinaVirtual.runInContext(
    arquivos.readFileSync(caminho.join(process.cwd(), "scripts/ui/ui.js"), "utf8"),
    contexto,
    { filename: "scripts/ui/ui.js" }
);

contexto.ClimateUI.setupTabs("Tab0");
verificar.equal(botoes[0].getAttribute("tabindex"), "0");
verificar.deepEqual(botoes.slice(1).map(botao => botao.getAttribute("tabindex")), ["-1", "-1", "-1"]);

verificar.equal(botoes[0].dispararTecla("ArrowLeft"), true);
verificar.equal(botoes[3].classList.contains("active"), true);
verificar.equal(documento.activeElement, botoes[3]);

verificar.equal(botoes[3].dispararTecla("ArrowRight"), true);
verificar.equal(botoes[0].classList.contains("active"), true);

botoes[2].dispararTecla("Home");
verificar.equal(botoes[0].classList.contains("active"), true);
botoes[0].dispararTecla("End");
verificar.equal(botoes[3].classList.contains("active"), true);
verificar.equal(botoes.filter(botao => botao.getAttribute("tabindex") === "0").length, 1);

const codigoZoom = arquivos.readFileSync(caminho.join(process.cwd(), "scripts/charts/zoom.js"), "utf8");
verificar.match(codigoZoom, /setAttribute\("role", "dialog"\)/);
verificar.match(codigoZoom, /setAttribute\("aria-modal", "true"\)/);
verificar.match(codigoZoom, /aria-labelledby/);
verificar.match(codigoZoom, /conterFocoNoDialogo/);
verificar.match(codigoZoom, /botaoFechar\.focus/);
verificar.match(codigoZoom, /disparadorAnterior\.focus/);
verificar.match(codigoZoom, /await garantirEstilosZoom\(\)/);
verificar.doesNotMatch(codigoZoom, /window\.scrollTo/);

console.log("Testes de acessibilidade de abas e zoom concluídos com sucesso.");
