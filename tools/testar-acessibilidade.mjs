import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

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

    addEventListener(tipo, callback) { this.listeners.set(tipo, callback); }
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
vm.createContext(contexto);
vm.runInContext(
    fs.readFileSync(path.join(process.cwd(), "scripts/ui/ui.js"), "utf8"),
    contexto,
    { filename: "scripts/ui/ui.js" }
);

contexto.ClimateUI.setupTabs("Tab0");
assert.equal(botoes[0].getAttribute("tabindex"), "0");
assert.deepEqual(botoes.slice(1).map(botao => botao.getAttribute("tabindex")), ["-1", "-1", "-1"]);

assert.equal(botoes[0].dispararTecla("ArrowLeft"), true);
assert.equal(botoes[3].classList.contains("active"), true);
assert.equal(documento.activeElement, botoes[3]);

assert.equal(botoes[3].dispararTecla("ArrowRight"), true);
assert.equal(botoes[0].classList.contains("active"), true);

botoes[2].dispararTecla("Home");
assert.equal(botoes[0].classList.contains("active"), true);
botoes[0].dispararTecla("End");
assert.equal(botoes[3].classList.contains("active"), true);
assert.equal(botoes.filter(botao => botao.getAttribute("tabindex") === "0").length, 1);

const codigoZoom = fs.readFileSync(path.join(process.cwd(), "scripts/charts/zoom.js"), "utf8");
assert.match(codigoZoom, /setAttribute\("role", "dialog"\)/);
assert.match(codigoZoom, /setAttribute\("aria-modal", "true"\)/);
assert.match(codigoZoom, /aria-labelledby/);
assert.match(codigoZoom, /conterFocoNoDialogo/);
assert.match(codigoZoom, /closeButton\.focus/);
assert.match(codigoZoom, /disparadorAnterior\.focus/);

console.log("Testes de acessibilidade de abas e zoom concluídos com sucesso.");
