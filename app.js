const TARIFFS = {
  hcBlue: 0.1356,
  hpBlue: 0.1654,
  hcWhite: 0.1536,
  hpWhite: 0.1921,
  hcRed: 0.1615,
  hpRed: 0.7295,
};

const MONTH_NAMES = [
  "Janvier",
  "Fevrier",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Aout",
  "Septembre",
  "Octobre",
  "Novembre",
  "Decembre",
];

const money = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const numberFr = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
});

const els = {
  status: document.getElementById("status"),
  cards: document.getElementById("cards"),
  yearSelect: document.getElementById("yearSelect"),
  monthSelect: document.getElementById("monthSelect"),
  tableBody: document.getElementById("dailyTableBody"),
};

let dailyChart;
let monthlyChart;
let allRows = [];

async function loadData() {
  const manifestRes = await fetch("data/manifest.json");
  if (!manifestRes.ok) {
    throw new Error("Impossible de charger data/manifest.json");
  }

  const manifest = await manifestRes.json();
  const files = manifest.files || [];

  const rawRows = [];
  for (const file of files) {
    const res = await fetch(`data/raw/${file}`);
    if (!res.ok) {
      throw new Error(`Impossible de charger le fichier ${file}`);
    }
    const text = await res.text();
    rawRows.push(...parseCsv(text));
  }

  const merged = mergeAndRepairRows(rawRows);
  return merged.sort((a, b) => a.date - b.date);
}

function parseCsv(text) {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 3) {
    return [];
  }

  const records = [];
  for (let i = 2; i < lines.length; i += 1) {
    const cols = lines[i].split(";");
    if (cols.length < 14) {
      continue;
    }

    const date = parseFrenchDate(cols[0]);
    if (!date) {
      continue;
    }

    records.push({
      date,
      isoDate: toIsoDate(date),
      hcBlueKwh: parseMaybeNumber(cols[2]),
      hcBlueIndex: parseMaybeNumber(cols[3]),
      hpBlueKwh: parseMaybeNumber(cols[4]),
      hpBlueIndex: parseMaybeNumber(cols[5]),
      hcWhiteKwh: parseMaybeNumber(cols[6]),
      hcWhiteIndex: parseMaybeNumber(cols[7]),
      hpWhiteKwh: parseMaybeNumber(cols[8]),
      hpWhiteIndex: parseMaybeNumber(cols[9]),
      hcRedKwh: parseMaybeNumber(cols[10]),
      hcRedIndex: parseMaybeNumber(cols[11]),
      hpRedKwh: parseMaybeNumber(cols[12]),
      hpRedIndex: parseMaybeNumber(cols[13]),
    });
  }

  return records;
}

function mergeAndRepairRows(rows) {
  const map = new Map();

  for (const row of rows) {
    if (!map.has(row.isoDate)) {
      map.set(row.isoDate, { ...row });
      continue;
    }

    const existing = map.get(row.isoDate);
    for (const key of Object.keys(row)) {
      if (key === "date" || key === "isoDate") {
        continue;
      }

      const nextVal = row[key];
      const oldVal = existing[key];

      if (isFiniteNumber(oldVal) && isFiniteNumber(nextVal)) {
        // Sur une meme date, on garde la conso max si doublon.
        existing[key] = Math.max(oldVal, nextVal);
      } else if (!isFiniteNumber(oldVal) && isFiniteNumber(nextVal)) {
        existing[key] = nextVal;
      }
    }
  }

  const ordered = [...map.values()].sort((a, b) => a.date - b.date);
  const slots = [
    ["hcBlueKwh", "hcBlueIndex"],
    ["hpBlueKwh", "hpBlueIndex"],
    ["hcWhiteKwh", "hcWhiteIndex"],
    ["hpWhiteKwh", "hpWhiteIndex"],
    ["hcRedKwh", "hcRedIndex"],
    ["hpRedKwh", "hpRedIndex"],
  ];

  for (let i = 0; i < ordered.length; i += 1) {
    for (const [kwhKey, indexKey] of slots) {
      const row = ordered[i];
      const currentKwh = row[kwhKey];
      if (isFiniteNumber(currentKwh)) {
        continue;
      }

      const prev = ordered[i - 1];
      if (!prev) {
        continue;
      }

      const prevIndex = prev[indexKey];
      const currIndex = row[indexKey];
      if (!isFiniteNumber(prevIndex) || !isFiniteNumber(currIndex)) {
        continue;
      }

      const delta = currIndex - prevIndex;
      if (delta >= 0) {
        row[kwhKey] = delta;
      }
    }
  }

  return ordered.map((row) => enrichRow(row));
}

function enrichRow(row) {
  const dailyKwh =
    (row.hcBlueKwh || 0) +
    (row.hpBlueKwh || 0) +
    (row.hcWhiteKwh || 0) +
    (row.hpWhiteKwh || 0) +
    (row.hcRedKwh || 0) +
    (row.hpRedKwh || 0);

  const dailyCost =
    (row.hcBlueKwh || 0) * TARIFFS.hcBlue +
    (row.hpBlueKwh || 0) * TARIFFS.hpBlue +
    (row.hcWhiteKwh || 0) * TARIFFS.hcWhite +
    (row.hpWhiteKwh || 0) * TARIFFS.hpWhite +
    (row.hcRedKwh || 0) * TARIFFS.hcRed +
    (row.hpRedKwh || 0) * TARIFFS.hpRed;

  return {
    ...row,
    dailyKwh,
    dailyCost,
    year: row.date.getFullYear(),
    month: row.date.getMonth(),
  };
}

function parseMaybeNumber(value) {
  if (!value) {
    return null;
  }

  const clean = value.trim().replace(",", ".");
  if (!clean || clean.toUpperCase() === "NC") {
    return null;
  }

  const number = Number(clean);
  return Number.isFinite(number) ? number : null;
}

function parseFrenchDate(raw) {
  const normalized = raw.trim();
  const parts = normalized.includes("/") ? normalized.split("/") : normalized.split("-");
  if (parts.length !== 3) {
    return null;
  }

  const [dd, mm, yyyy] = parts.map((p) => Number(p));
  if (![dd, mm, yyyy].every(Number.isFinite)) {
    return null;
  }

  return new Date(yyyy, mm - 1, dd);
}

function toIsoDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function initSelectors(rows) {
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b);

  els.yearSelect.innerHTML = years
    .map((year) => `<option value="${year}">${year}</option>`)
    .join("");

  els.monthSelect.innerHTML = [
    '<option value="all">Tous</option>',
    ...MONTH_NAMES.map((name, month) => `<option value="${month}">${name}</option>`),
  ].join("");

  els.yearSelect.value = String(years[years.length - 1]);
  els.monthSelect.value = "all";

  els.yearSelect.addEventListener("change", render);
  els.monthSelect.addEventListener("change", render);
}

function getFilteredRows() {
  const year = Number(els.yearSelect.value);
  const monthRaw = els.monthSelect.value;

  return allRows.filter((row) => {
    if (row.year !== year) {
      return false;
    }

    if (monthRaw === "all") {
      return true;
    }

    return row.month === Number(monthRaw);
  });
}

function renderCards(rows) {
  const totalKwh = sumBy(rows, "dailyKwh");
  const totalCost = sumBy(rows, "dailyCost");
  const dayCount = rows.length;
  const avgCost = dayCount ? totalCost / dayCount : 0;
  const avgKwh = dayCount ? totalKwh / dayCount : 0;

  const cards = [
    ["Jours", `${dayCount}`],
    ["Conso totale", `${numberFr.format(totalKwh)} kWh`],
    ["Cout total", money.format(totalCost)],
    ["Conso moyenne/jour", `${numberFr.format(avgKwh)} kWh`],
    ["Cout moyen/jour", money.format(avgCost)],
  ];

  els.cards.innerHTML = cards
    .map(
      ([title, value]) =>
        `<article class="card"><h3>${title}</h3><p>${value}</p></article>`,
    )
    .join("");
}

function renderDailyChart(rows) {
  const labels = rows.map((row) => formatDate(row.date));
  const kwh = rows.map((row) => round2(row.dailyKwh));
  const costs = rows.map((row) => round2(row.dailyCost));

  if (dailyChart) {
    dailyChart.destroy();
  }

  dailyChart = new Chart(document.getElementById("dailyChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "kWh",
          data: kwh,
          borderColor: "#1f9d77",
          backgroundColor: "rgba(31, 157, 119, 0.16)",
          yAxisID: "y",
          tension: 0.2,
          fill: true,
        },
        {
          label: "Cout €",
          data: costs,
          borderColor: "#d84315",
          backgroundColor: "rgba(216, 67, 21, 0.2)",
          yAxisID: "y1",
          tension: 0.2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          title: { display: true, text: "kWh" },
        },
        y1: {
          position: "right",
          title: { display: true, text: "EUR" },
          grid: { drawOnChartArea: false },
        },
      },
    },
  });
}

function renderMonthlyChart(rows) {
  const byMonth = groupByMonth(rows);
  const labels = Object.keys(byMonth).sort();
  const data = labels.map((key) => byMonth[key].cost);

  if (monthlyChart) {
    monthlyChart.destroy();
  }

  monthlyChart = new Chart(document.getElementById("monthlyChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Cout mensuel (EUR)",
          data,
          backgroundColor: "#1976d2",
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
}

function renderTable(rows) {
  const displayRows = [...rows].sort((a, b) => b.date - a.date).slice(0, 20);

  els.tableBody.innerHTML = displayRows
    .map((row) => {
      const split = describeSplit(row);
      return `
        <tr>
          <td>${formatDate(row.date)}</td>
          <td>${numberFr.format(row.dailyKwh)}</td>
          <td>${money.format(row.dailyCost)}</td>
          <td>${split}</td>
        </tr>
      `;
    })
    .join("");
}

function describeSplit(row) {
  const parts = [];

  const blue = (row.hcBlueKwh || 0) + (row.hpBlueKwh || 0);
  const white = (row.hcWhiteKwh || 0) + (row.hpWhiteKwh || 0);
  const red = (row.hcRedKwh || 0) + (row.hpRedKwh || 0);

  if (blue > 0) {
    parts.push(`Bleu ${numberFr.format(blue)} kWh`);
  }
  if (white > 0) {
    parts.push(`Blanc ${numberFr.format(white)} kWh`);
  }
  if (red > 0) {
    parts.push(`Rouge ${numberFr.format(red)} kWh`);
  }

  return parts.length ? parts.join(" | ") : "-";
}

function groupByMonth(rows) {
  const grouped = {};

  for (const row of rows) {
    const key = `${MONTH_NAMES[row.month]} ${row.year}`;
    if (!grouped[key]) {
      grouped[key] = { cost: 0 };
    }
    grouped[key].cost += row.dailyCost;
  }

  return grouped;
}

function sumBy(rows, field) {
  return rows.reduce((acc, row) => acc + (row[field] || 0), 0);
}

function formatDate(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function render() {
  const rows = getFilteredRows();
  renderCards(rows);
  renderDailyChart(rows);

  // Le graphe mensuel est pertinent quand on regarde l'annee complete.
  if (els.monthSelect.value === "all") {
    renderMonthlyChart(rows);
  } else {
    renderMonthlyChart(allRows.filter((r) => r.year === Number(els.yearSelect.value)));
  }

  renderTable(rows);
}

async function boot() {
  try {
    allRows = await loadData();
    initSelectors(allRows);
    render();

    const totalKwh = sumBy(allRows, "dailyKwh");
    const totalCost = sumBy(allRows, "dailyCost");
    els.status.textContent = `Donnees chargees: ${allRows.length} jours | ${numberFr.format(totalKwh)} kWh | ${money.format(totalCost)}`;
  } catch (error) {
    console.error(error);
    els.status.textContent = "Erreur de chargement des donnees.";
    els.status.style.background = "#ffe9e3";
    els.status.style.borderColor = "#ffc7b8";
    els.status.style.color = "#82240b";
  }
}

boot();
