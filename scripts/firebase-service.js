'use strict';

(function () {
    let aplicacao = null;
    let bancoDados = null;
    let criarReferencia = null;
    let observarValor = null;
    let carregamentoApp = null;
    let carregamentoDatabase = null;
    let carregamentosPendentes = 0;
    let appCheckInicializado = false;

    function definirCarregamento(estaCarregando) {
        const elementoDom = document.getElementById("loadingBar");
        if (!elementoDom) return;
        elementoDom.classList.toggle("is-active", estaCarregando);
    }

    function registrarInicioCarregamento() {
        carregamentosPendentes++;
        definirCarregamento(true);
    }

    function registrarFimCarregamento() {
        carregamentosPendentes = Math.max(0, carregamentosPendentes - 1);
        definirCarregamento(carregamentosPendentes > 0);
    }

    function tratarErro(caminho, erro) {
        window.ClimateDiagnostics?.erro(`Erro ao carregar ${caminho}.`, erro);
    }

    async function inicializarServico() {
        if (aplicacao) return aplicacao;
        if (carregamentoApp) return carregamentoApp;

        carregamentoApp = (async () => {
            const configuracao = window.AppConfig.firebase;
            const { initializeApp } = await import(configuracao.appUrl);
            aplicacao = initializeApp(configuracao.options);
            return aplicacao;
        })();

        return carregamentoApp;
    }

    async function inicializarBancoDados() {
        if (bancoDados) return bancoDados;
        if (carregamentoDatabase) return carregamentoDatabase;

        carregamentoDatabase = (async () => {
            await inicializarServico();
            const { getDatabase, onValue, ref } = await import(window.AppConfig.firebase.databaseUrl);
            bancoDados = getDatabase(aplicacao);
            criarReferencia = ref;
            observarValor = onValue;
            return bancoDados;
        })();

        return carregamentoDatabase;
    }

    async function garantirAppCheckInicializado() {
        await inicializarServico();
        return inicializarAppCheckSeConfigurado();
    }

    async function inicializarAppCheckSeConfigurado() {
        const configuracao = window.AppConfig.firebase;
        // App Check fica sob demanda para evitar carregar reCAPTCHA antes de recursos protegidos, como a IA.
        if (appCheckInicializado || !configuracao.recaptchaEnterpriseSiteKey || !configuracao.appCheckUrl || ehHostLocal()) return;

        try {
            const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import(configuracao.appCheckUrl);
            initializeAppCheck(aplicacao, {
                provider: new ReCaptchaEnterpriseProvider(configuracao.recaptchaEnterpriseSiteKey),
                isTokenAutoRefreshEnabled: true,
            });
            appCheckInicializado = true;
        } catch (erro) {
            window.ClimateDiagnostics?.depurar("App Check não foi inicializado.", erro);
        }
    }

    function ehHostLocal() {
        const nomeHost = window.location.hostname;
        return nomeHost === "localhost" || nomeHost === "127.0.0.1" || nomeHost === "::1";
    }

    function escutarCaminho(caminho, aoReceberDados, aoOcorrerErro) {
        if (!bancoDados || !criarReferencia || !observarValor) {
            throw new Error("Firebase Database ainda não foi inicializado.");
        }
        let primeiroCarregamento = true;
        registrarInicioCarregamento();

        return observarValor(criarReferencia(bancoDados, caminho), retratoDados => {
            if (primeiroCarregamento) {
                registrarFimCarregamento();
                primeiroCarregamento = false;
            }
            const dados = retratoDados.val();
            if (!window.ClimateContracts?.validarColecaoFirebase?.(dados)) {
                const erro = new TypeError(`Estrutura Firebase inválida em ${caminho}.`);
                tratarErro(caminho, erro);
                if (aoOcorrerErro) aoOcorrerErro(erro);
                return;
            }
            aoReceberDados(dados);
        }, erro => {
            if (primeiroCarregamento) {
                registrarFimCarregamento();
                primeiroCarregamento = false;
            }
            tratarErro(caminho, erro);
            if (aoOcorrerErro) aoOcorrerErro(erro);
        });
    }

    window.FirebaseService = {
        initialize: inicializarServico,
        initializeDatabase: inicializarBancoDados,
        ensureAppCheckInitialized: garantirAppCheckInicializado,
        listenToPath: escutarCaminho,
        getApp: () => aplicacao,
        setLoading: definirCarregamento,
        trackLoadStart: registrarInicioCarregamento,
        trackLoadEnd: registrarFimCarregamento,
        handleError: tratarErro,
    };
})();
