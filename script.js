const buttons = document.querySelectorAll("nav button");
const sections = document.querySelectorAll("main section");

buttons.forEach(btn => {
  btn.addEventListener("click", () => {
    buttons.forEach(b => b.classList.remove("active"));
    sections.forEach(s => s.classList.remove("active"));

    btn.classList.add("active");
    const page = btn.getAttribute("data-page");
    document.getElementById(page).classList.add("active");
  });
});

// -----------------------------
// Trend of dog names chart
// -----------------------------
(function () {
  const CSV_PATH = "NYC_Dog_Licensing_Dataset_20251111.csv";
  const YEARS = d3.range(2000, 2026); // 2000..2025 inclusive
  const junkSet = new Set([
  "", "UNKNOWN", "N/A", "NA", "DOG", "NONE", "NULL", "UNNAMED",
  "NAME NOT PROVIDED", "NOT PROVIDED", "NO NAME", "NOTNAMED"
]);

  // Colors for the top 3
  const COLORS = ["#2f80ed", "#27ae60", "#f2994a"]; // blue, green, orange

  // Mount points
  const chartEl = d3.select("#trend-chart");
  if (chartEl.empty()) return; // bail if this page does not exist

  const legendEl = d3.select("#trend-legend");
  const summaryEl = d3.select("#trend-summary");
  // floating tooltip
const tooltip = d3.select("body").append("div")
  .attr("class", "trend-tooltip")
  .style("opacity", 0);


  // Responsive SVG
  const svg = chartEl
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", "0 0 900 420")
    .attr("preserveAspectRatio", "xMidYMid meet");

  const g = svg.append("g").attr("transform", "translate(60,20)");
  const innerW = 900 - 60 - 24;  // left, right
  const innerH = 420 - 20 - 40;  // top, bottom

  // clip path to stop anything beyond the chart from showing
// clip path to stop anything beyond the chart from showing
svg.select("#plot-clip").remove();   // in case it exists from a redraw
svg.append("clipPath")
  .attr("id", "plot-clip")
  .append("rect")
  .attr("x", 60)
  .attr("y", 14)                     // was 20, give a little extra room
  .attr("width", innerW)
  .attr("height", innerH + 12);      // a bit taller than innerH


// later, when you create the group for lines:
const lineG = g.append("g").attr("clip-path", "url(#plot-clip)");


  const x = d3.scaleLinear().domain([2000, 2025]).range([0, innerW]);
  const y = d3.scaleLinear().range([innerH, 0]);

  const xAxis = d3.axisBottom(x).tickFormat(d3.format("d")).ticks(9);
  const yAxis = d3.axisLeft(y).ticks(6);

  const gx = g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerH})`);
  const gy = g.append("g").attr("class", "axis");

  const line = d3
    .line()
    .x(d => x(d.year))
    .y(d => y(d.count))
    .curve(d3.curveLinear);

  // Load and draw
  d3.csv(CSV_PATH).then(rows => {
    // Parse and clean
    // Expect columns: AnimalName, LicenseIssuedDate
    const byNameYear = new Map(); // name -> Map(year->count)

    for (const r of rows) {
      let name = (r.AnimalName || "").trim().toUpperCase();
      if (!name || junkSet.has(name)) continue;

      // Parse year from LicenseIssuedDate
      const d = new Date(r.LicenseIssuedDate);
      const yr = d.getFullYear();
      if (!Number.isFinite(yr)) continue;
      if (yr < 2000 || yr > 2025) continue;

      if (!byNameYear.has(name)) byNameYear.set(name, new Map());
      const ym = byNameYear.get(name);
      ym.set(yr, (ym.get(yr) || 0) + 1);
    }

    // Compute totals and pick top 3 names across 2000-2025
    // from here
const totals = [];
for (const [name, ym] of byNameYear) {
  let sum = 0;
  for (const [yr, val] of ym.entries()) {
    if (yr >= 2000 && yr <= 2025) sum += val;
  }
  totals.push({ name, sum });
}
totals.sort((a, b) => (b.sum - a.sum) || a.name.localeCompare(b.name));
const top3 = totals.slice(0, 3).map(d => d.name);

// --- find the last year that actually has data among the top 3 ---
const lastYearWithData =
  d3.max(
    YEARS.filter(Y =>
      top3.some(n => (byNameYear.get(n)?.get(Y) || 0) > 0)
    )
  ) || 2000;

// --- build points trimmed to the last year with data ---
const YEARS_TRIM = d3.range(2000, lastYearWithData + 1);

const series = top3.map((name, i) => {
  const ym = byNameYear.get(name);
  const pts = YEARS_TRIM.map(Y => ({ year: Y, count: ym.get(Y) || 0 }));
  return { name, color: COLORS[i], points: pts, muted: false };
});

// --- axes domains after we know the trim ---

// --- axes domains after we know the trim ---
x.domain([2000, lastYearWithData]);
gx.call(xAxis);

const maxCount = d3.max(series.flatMap(s => s.points.map(p => p.count))) || 1;
y.domain([0, Math.ceil(maxCount * 1.1)]); // 10% headroom
gy.call(yAxis);


// draw lines (inside the clip path group created earlier)
lineG.selectAll(".series-line")
  .data(series)
  .join("path")
  .attr("class", "series-line")
  .attr("stroke", d => d.color)
  .attr("d", d => line(d.points));

// hover layer: guideline + dots
const hoverG = g.append("g").style("display", "none");
const guideline = hoverG.append("line")
  .attr("class", "guideline")
  .attr("y1", 0)
  .attr("y2", innerH);

const dots = hoverG.selectAll(".focus-dot")
  .data(series)
  .join("circle")
  .attr("class", "focus-dot")
  .attr("r", 5)
  .attr("fill", "#fff")
  .attr("stroke", d => d.color);

// update mouse overlay width to stop at lastYearWithData
svg.selectAll("rect.overlay").remove();
svg.append("rect")
  .attr("class", "overlay")
  .attr("x", 60)
  .attr("y", 20)
  .attr("width", x(lastYearWithData) - x(2000))
  .attr("height", innerH)
  .attr("fill", "transparent")
  .on("mouseenter", () => { hoverG.style("display", null); tooltip.style("opacity", 1); })
  .on("mouseleave", () => { hoverG.style("display", "none"); tooltip.style("opacity", 0); })
  .on("mousemove", (event) => {
    const [mx] = d3.pointer(event);
    const chartX = mx - 60;
    let year = Math.round(x.invert(chartX));
    year = Math.max(2000, Math.min(lastYearWithData, year));

    const gxPos = x(year);
    guideline.attr("x1", gxPos).attr("x2", gxPos);

    const rows = series.map(s => {
      const p = s.points.find(pt => pt.year === year);
      return { name: s.name, color: s.muted ? "#bdbdbd" : s.color, count: p ? p.count : 0, muted: s.muted };
    }).sort((a, b) => b.count - a.count);

    dots
      .attr("cx", gxPos)
      .attr("cy", d => {
        const v = d.points.find(pt => pt.year === year)?.count || 0;
        return y(v);
      })
      .attr("stroke", d => d.muted ? "#bdbdbd" : d.color);

    const [pageX, pageY] = d3.pointer(event, document.body);
    tooltip
      .html(renderTooltip(year, rows))
      .style("left", `${pageX + 14}px`)
      .style("top", `${pageY - 10}px`);
  });

function renderTooltip(year, rows) {
  const items = rows.map(r =>
    `<div class="row">
       <span class="sw" style="background:${r.color}"></span>
       <span style="opacity:${r.muted ? 0.6 : 1}">${toTitle(r.name)}: ${r.count.toLocaleString()}</span>
     </div>`
  ).join("");
  return `<div><strong>${year}</strong></div>${items}`;
}

       // Legend chips
    const chips = legendEl
      .selectAll(".legend-chip")
      .data(series)
      .join("div")
      .attr("class", "legend-chip")
      .on("click", (_, d) => {
        d.muted = !d.muted;
        chips.classed("muted", c => c.muted);
        // toggle line style
        lineG
          .selectAll(".series-line")
          .classed("muted", l => l.muted)
          .attr("stroke", l => (l.muted ? "#bdbdbd" : l.color));
      });

    chips
      .append("span")
      .attr("class", "swatch")
      .style("background", d => d.color);

    chips.append("span").text(d => toTitle(d.name));

    // Summary text
const topNames = series.map(s => toTitle(s.name));
const latest = series
  .map(s => ({ name: toTitle(s.name), count: s.points.find(p => p.year === lastYearWithData).count }))
  .sort((a, b) => b.count - a.count);

summaryEl.html(
  `Across 2000 to ${lastYearWithData}, the three most registered names are <b>${topNames.join(
    ", "
  )}</b>. Lines show yearly registrations. Peaks reflect short bursts in naming popularity, while flatter segments indicate stable adoption. In ${lastYearWithData}, totals rank <b>${latest
    .map(d => d.name)
    .join(", ")}</b> in that order.`
);
  });

  // helpers
  function toTitle(s) {
    return s.toLowerCase().replace(/\\b\\w/g, c => c.toUpperCase());
  }
})();

