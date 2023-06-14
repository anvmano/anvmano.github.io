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
let lastDate = '';

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

// Seleciona todos os gráficos
const plots = document.querySelectorAll('.plot');

// Percorre cada gráfico
plots.forEach(plot => {
    // Adiciona um evento de clique em cada gráfico
    plot.addEventListener('click', () => {
        // Verifica se o gráfico já está maximizado
        if (plot.classList.contains('zoom')) {
            // Remove a classe de maximizado para voltar ao tamanho normal
            plot.classList.remove('zoom');
        } else {
            // Adiciona a classe de maximizado para aumentar o tamanho
            plot.classList.add('zoom');
            // scroll para o gráfico
            const rect = plot.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
            const x = rect.left + scrollLeft + rect.width / 2;
            const y = rect.top + scrollTop + rect.height / 2;
            window.scrollTo({ top: y, left: x, behavior: 'smooth' });
        }
    });
});

function formatDateKey(dateKey) {
  return new Date(dateKey.split("-").reverse().join("-"));
}

function createDataRow(date, time, item, table) {
  const { Temperatura, "Sensacao termica": SensacaoTermica, Umidade } = item;
  const temperature = formatDecimal(Temperatura, 2);
  const thermalSensation = formatDecimal(SensacaoTermica, 2);
  const humidity = formatDecimal(Umidade, 2);

  const row = table.insertRow();
  const dateCell = row.insertCell();
  const timeCell = row.insertCell();
  const temperatureCell = row.insertCell();
  const thermalSensationCell = row.insertCell();
  const humidityCell = row.insertCell();

  dateCell.innerText = date;
  timeCell.innerText = time;
  temperatureCell.innerText = temperature;
  thermalSensationCell.innerText = thermalSensation;
  humidityCell.innerText = humidity;
}

function flattenData(data) {
  return Object.entries(data).flatMap(([date, dateData]) => {
    return Object.entries(dateData).map(([time, item]) => {
      return { date, time, ...item };
    });
  });
}

function createTable(data) {
  const table = document.createElement("table");
  
  // Cria o cabeçalho da tabela
  createTableHeader(table);

  const flattenedData = flattenData(data);

  // Ordenar os dados por data em ordem cronológica descendente
  flattenedData.sort((a, b) => {
    return formatDateKey(b.date) - formatDateKey(a.date);
  });

  // Preenche a tabela com os dados ordenados cronologicamente
  flattenedData.forEach(({ date, time, ...item }) => {
    createDataRow(date, time, item, table);
  });

  return table;
}

function createTableHeader(table) {
  const headers = ["Data", "Hora", "Temperatura", "Sensação Térmica", "Umidade"];
  const headerRow = table.insertRow();
  headers.forEach(headerText => {
    const headerCell = document.createElement("th");
    headerCell.innerText = headerText;
    headerRow.appendChild(headerCell);
  });
}

function formatDecimal(number, decimalPlaces) {
  return number.toFixed(decimalPlaces);
}

function hourAndData(data) {
    var hours = []
    var dadostemp = [];
    var dadosST = [];
    var dadosUmidade = [];
    for (const date in data) {
        const dateData = data[date];
        for (const time in dateData) {
            const timeData = dateData[time];
            const hour = time.split('-')[0]; // Pega somente a hora (segundo elemento do array)
            hours.push(hour);
            for (const key in timeData) {
                const item = timeData[key];
                console.log(item);
                dadostemp.push(item.Temperatura);
                dadosST.push(item['Sensacao termica']);
                dadosUmidade.push(item.Umidade);
            }
        }
    }
    return { hours, dadostemp, dadosST, dadosUmidade };
}

function createTemperatureChart(data) {
    const { hours, dadostemp: temperatureData } = hourAndData(data);

    // Create an instance of Chart object:
    new Chart(plotsTemp, {
        type: 'line', //Declare the chart type 
        data: {
            labels: hours, //X-axis data 
            datasets: [{
                label: 'Temperatura',
                data: temperatureData, //Y-axis data 
                borderColor: 'blue',
                fill: false, //Fills the curve under the line with the babckground color. It's true by default 
            }]
        },
    });
}

function createSTChart(data) {
    const { hours, dadosST: STData } = hourAndData(data);

    // Create an instance of Chart object:
    new Chart(plotsST, {
        type: 'line', //Declare the chart type 
        data: {
            labels: hours, //X-axis data 
            datasets: [{
                label: 'Sensacao termica',
                data: STData,
                borderColor: 'green',
                fill: false, //Fills the curve under the line with the babckground color. It's true by default 
            }]
        },
    });
}

function createUmidadeChart(data) {
    const { hours, dadosUmidade: dadosUmidade } = hourAndData(data);

    // Create an instance of Chart object:
    new Chart(plotsUmidade, {
        type: 'line', //Declare the chart type 
        data: {
            labels: hours, //X-axis data 
            datasets: [{
                label: 'Umidade',
                data: dadosUmidade, //Y-axis data 
                borderColor: '#36A2EB',
                fill: false, //Fills the curve under the line with the babckground color. It's true by default 
            }]
        },
    });
}
