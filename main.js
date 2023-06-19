// Configura o Firebase
const firebaseConfig = {
    apiKey: "AIzaSyD5gYEvLzvZItMrXGRlNbhfOPgNMj756_I",
    authDomain: "estacaometereologicaesp32.firebaseapp.com",
    databaseURL: "https://estacaometereologicaesp32-default-rtdb.firebaseio.com",
    projectId: "estacaometereologicaesp32",
    storageBucket: "estacaometereologicaesp32.appspot.com",
    messagingSenderId: "589754957740",
    appId: "1:589754957740:web:6299b8ce6763127b600409",
    measurementId: "G-8GE5G3X1Y9"
};
firebase.initializeApp(firebaseConfig);

// Get the HTML canvas by its id 
plotsTemp = document.getElementById("plotsTemp");
plotsST = document.getElementById("plotsST");
plotsUmidade = document.getElementById("plotsUmidade");

const alturaGrafico = '250px';

let lastDate = '';
const currentDate = dataAtual();
const yesterdayDate = dataOntem();

const dbRef = firebase.database().ref("historico/Temperatura");
dbRef.on("value", snapshot => {
    const data = snapshot.val();
    const table = createTable(data);
    const temperatureChart = createTemperatureChart(data);
    const STChart = createSTChart(data);
    const umidadeChart = createUmidadeChart(data);

    // Adiciona a tabela e o gráfico ao elemento "data" da página HTML
    const dataElement = document.getElementById("data");
    dataElement.innerHTML = "";
    dataElement.appendChild(table);
});

function handleZoom(plot) {
    // Verifica se o gráfico já está maximizado
    if (plot.classList.contains('zoom')) {
        // Remove a classe de maximizado para voltar ao tamanho normal
        plot.classList.remove('zoom');
    } else {
        // Adiciona a classe de maximizado para aumentar o tamanho
        plot.classList.add('zoom');
        // Scroll para o gráfico
        const rect = plot.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        const x = rect.left + scrollLeft + rect.width / 2;
        const y = rect.top + scrollTop + rect.height / 2;
        window.scrollTo({ top: y, left: x, behavior: 'smooth' });
    }
}

// Seleciona todos os gráficos
const plots = document.querySelectorAll('.plot');

// Percorre cada gráfico
plots.forEach(plot => {
    // Adiciona um evento de clique em cada gráfico
    plot.addEventListener('click', () => handleZoom(plot));
});

function createTable(data) {
    const table = document.createElement("table");

    // Cria o cabeçalho da tabela
    const headerRow = table.insertRow();
    const headers = ["Data", "Hora", "Temperatura", "Sensação Térmica", "Umidade"];
    for (let i = 0; i < headers.length; i++) {
        const headerCell = document.createElement("th");
        headerCell.innerText = headers[i];
        headerRow.appendChild(headerCell);
    }

    const allDates = Object.keys(data).filter(
        (date) => date === currentDate || date === yesterdayDate
    );

    let count = 0; // Variável para controlar o número de registros inseridos na tabela
    let lastDate = null; // Variável para armazenar a última data exibida

    // Preenche a tabela com os dados
    for (const date of allDates.reverse()) {
        const dateData = data[date];
        const allTimes = Object.keys(dateData).sort().reverse();

        for (const time of allTimes) {
            const timeData = dateData[time];

            for (const key in timeData) {
                const item = timeData[key];
                const temperature = item.Temperatura.toFixed(2);
                const thermalSensation = item["Sensacao termica"].toFixed(2);
                const humidity = item.Umidade.toFixed(2);

                const row = table.insertRow();
                const dateCell = row.insertCell();
                const timeCell = row.insertCell();
                const temperatureCell = row.insertCell();
                const thermalSensationCell = row.insertCell();
                const humidityCell = row.insertCell();

                dateCell.innerText = date !== lastDate ? date : '';
                timeCell.innerText = time;
                temperatureCell.innerText = temperature;
                thermalSensationCell.innerText = thermalSensation;
                humidityCell.innerText = humidity;

                count++; // Incrementa o contador de registros inseridos

                if (count === 24) {
                    return table; // Retorna a tabela após inserir os 24 registros
                }
            }
            lastDate = date; // Atualiza a variável com a última data exibida
        }
    }

    return table;
}

function dataAtual() {
    var data = new Date();
    var dia = String(data.getDate()).padStart(2, '0');
    var mes = String(data.getMonth() + 1).padStart(2, '0');
    var ano = data.getFullYear();
    var dataAtual = dia + '-' + mes + '-' + ano;
    return dataAtual;
}

function dataOntem() {
    var data = new Date();
    data.setDate(data.getDate() - 1); // Obtém o dia anterior
    var dia = String(data.getDate()).padStart(2, '0');
    var mes = String(data.getMonth() + 1).padStart(2, '0');
    var ano = data.getFullYear();
    var dataAnterior = dia + '-' + mes + '-' + ano;
    return dataAnterior;
}

function hourAndData(data) {
    var hours = [];
    var dadostemp = [];
    var dadosST = [];
    var dadosUmidade = [];

    const allDates = Object.keys(data).filter(
        (date) => date === currentDate || date === yesterdayDate
    );

    for (const date of allDates) {
        const dateData = data[date];
        const allTimes = Object.keys(dateData).sort();

        for (const time of allTimes) {
            const timeData = dateData[time];
            const hour = time.split("-")[0]; // Pega somente a hora (segundo elemento do array)
            hours.push(hour);

            for (const key in timeData) {
                const item = timeData[key];
                dadostemp.push(item.Temperatura);
                dadosST.push(item["Sensacao termica"]);
                dadosUmidade.push(item.Umidade);
            }
        }
    }

    return { hours, dadostemp, dadosST, dadosUmidade };
}

function createTemperatureChart(data) {
    const { hours, dadostemp: temperatureData } = hourAndData(data);

    // Define a altura dos gráficos
    plotsTemp.style.height = alturaGrafico;

    new Chart(plotsTemp, {
        type: 'line',
        data: {
            labels: hours,
            datasets: [{
                label: 'Temperatura',
                data: temperatureData,
                borderColor: 'blue',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: true, title: { display: true } },
                y: { display: true, title: { display: true, text: 'Value' } }
            }
        },
    });
}

function createSTChart(data) {
    const { hours, dadosST: STData } = hourAndData(data);

    plotsST.style.height = alturaGrafico;

    new Chart(plotsST, {
        type: 'line',
        data: {
            labels: hours,
            datasets: [{
                label: 'Sensacao termica',
                data: STData,
                borderColor: 'green',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: true, title: { display: true } },
                y: { display: true, title: { display: true, text: 'Value' } }
            }
        },
    });
}

function createUmidadeChart(data) {
    const { hours, dadosUmidade: dadosUmidade } = hourAndData(data);

    plotsUmidade.style.height = alturaGrafico;

    new Chart(plotsUmidade, {
        type: 'line',
        data: {
            labels: hours,
            datasets: [{
                label: 'Umidade',
                data: dadosUmidade,
                borderColor: '#36A2EB',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: true, title: { display: true } },
                y: { display: true, title: { display: true, text: 'Value' } }
            }
        },
    });
}
