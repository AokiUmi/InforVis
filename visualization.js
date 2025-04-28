// Mapping tables (same as yours)
const usStateAbbrToName = {
    "AK": "Alaska", "AL": "Alabama", "AR": "Arkansas", "AZ": "Arizona",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "IA": "Iowa",
    "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "MA": "Massachusetts", "MD": "Maryland",
    "ME": "Maine", "MI": "Michigan", "MN": "Minnesota", "MO": "Missouri",
    "MS": "Mississippi", "MT": "Montana", "NC": "North Carolina", "ND": "North Dakota",
    "NE": "Nebraska", "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico",
    "NV": "Nevada", "NY": "New York", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
    "VA": "Virginia", "VT": "Vermont", "WA": "Washington", "WI": "Wisconsin",
    "WV": "West Virginia", "WY": "Wyoming"
};
const cnProvinceAbbrToName = {
    "AH": "Anhui", "BJ": "Beijing", "CQ": "Chongqing", "FJ": "Fujian",
    "GD": "Guangdong", "GS": "Gansu", "GX": "Guangxi", "GZ": "Guizhou",
    "HA": "Henan", "HB": "Hubei", "HE": "Hebei", "HI": "Hainan",
    "HL": "Heilongjiang", "HN": "Hunan", "JL": "Jilin", "JS": "Jiangsu",
    "JX": "Jiangxi", "LN": "Liaoning", "NM": "Inner Mongolia", "NX": "Ningxia",
    "QH": "Qinghai", "SC": "Sichuan", "SD": "Shandong", "SH": "Shanghai",
    "SN": "Shaanxi", "SX": "Shanxi", "TJ": "Tianjin", "XJ": "Xinjiang",
    "XZ": "Tibet", "YN": "Yunnan", "ZJ": "Zhejiang", "TW": "Taiwan",
    "HK": "Hong Kong", "MO": "Macau"
};
let scatterSvg = d3.select("#scatter");

let xScale = d3.scaleLinear().range([60, 940]); // margins
let yScale = d3.scaleLinear().range([940, 60]); // invert y-axis


let width = 2400, height = 800;
let svg = d3.select("#map")
    .attr("width", width)
    .attr("height", height);

let cnProjection = d3.geoIdentity().reflectY(true); // Make China 1.3x bigger;
let usProjection = d3.geoAlbersUsa().scale(1400).translate([1650, 400]);

let usPath = d3.geoPath().projection(usProjection);
let cnPath = d3.geoPath().projection(cnProjection);

let attribute = "TAVG";
let monthIndex = 0;
let months = [];
let temperatureData = {};

const colorScales = {
    TMIN: d3.scaleSequential(d3.interpolateBlues),
    TMAX: d3.scaleSequential(d3.interpolateReds),
    TAVG: d3.scaleSequential(d3.interpolateGreens)
};

// Dynamic min/max range for each attribute
const attributeRanges = {
    TAVG: [Infinity, -Infinity],
    TMAX: [Infinity, -Infinity],
    TMIN: [Infinity, -Infinity]
};

Promise.all([
    d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"),
    d3.json("/dataset/cn-provinces-english.json"),
    d3.csv("/dataset/CN-complete-temp-celsius-23-24.csv"),
    d3.csv("/dataset/US-complete-temp-celsius-23-24.csv")
]).then(([usMap, cnMap, cnData, usData]) => {

    // Prepare temperature data and compute attribute ranges
    function updateRanges(d) {
        ["TAVG", "TMAX", "TMIN"].forEach(attr => {
            const value = +d[attr];
            if (!isNaN(value)) {
                attributeRanges[attr][0] = Math.min(attributeRanges[attr][0], value);
                attributeRanges[attr][1] = Math.max(attributeRanges[attr][1], value);
            }
        });
    }

    cnData.forEach(d => {
        let key = `${cnProvinceAbbrToName[d.Province]}_${d.MONTH}`;
        temperatureData[key] = { TAVG: +d.TAVG, TMAX: +d.TMAX, TMIN: +d.TMIN };
        updateRanges(d);
        if (!months.includes(d.MONTH)) months.push(d.MONTH);
    });

    usData.forEach(d => {
        let key = `${usStateAbbrToName[d.STATE]}_${d.MONTH}`;
        temperatureData[key] = { TAVG: +d.TAVG, TMAX: +d.TMAX, TMIN: +d.TMIN };
        updateRanges(d);
        if (!months.includes(d.MONTH)) months.push(d.MONTH);
    });

    months.sort();

    let usStates = topojson.feature(usMap, usMap.objects.states).features;

    usStates.forEach(d => d.properties.region = "US");

    let cnProvinces = cnMap.features;
    cnProvinces.forEach(d => d.properties.region = "CN");

    // Fit CN projection
    cnProjection.fitSize([1300, 800], { type: "FeatureCollection", features: cnProvinces });
    

    let combined = usStates.concat(cnProvinces);

    svg.append("g")
        .selectAll("path")
        .data(combined)
        .join("path")
        .attr("d", d => d.properties.region === "US" ? usPath(d) : cnPath(d))
        .attr("transform", d => 
            d.properties.region === "CN" ? "translate(0,50) scale(1,1.3)" : null
        )
        .attr("fill", d => getColor(d))
        .attr("stroke", "#333")
        .attr("stroke-width", 0.5);

    svg.append("g")
        .selectAll("text")
        .data(combined)
        .join("text")
        .attr("x", d => {
            const centroid = d.properties.region === "US" ? usPath.centroid(d) : cnPath.centroid(d);
            if (isNaN(centroid[0]) || isNaN(centroid[1])) return null; // Ignore bad points
            return centroid[0];
        })
        .attr("y", d => {
            const centroid = d.properties.region === "US" ? usPath.centroid(d) : cnPath.centroid(d);
            if (isNaN(centroid[0]) || isNaN(centroid[1])) return null;
            let y = centroid[1];
            if (d.properties.region === "CN") {
                y = y * 1.3 + 50; // Stretch and move down
            }
            let name = d.properties.name || d.properties.NAME;
            let abbr = getAbbreviation(name, d.properties.region);
            if (abbr === "HE") {
                return y + 20;
            }
            else if (abbr === "HI") {
                return y - 22;
            }
            else if (abbr === "GS") {
                return y - 15;
            }
            return y;
        })
        .text(d => {
            let name = d.properties.name || d.properties.NAME;
            let abbr = getAbbreviation(name, d.properties.region);
            return abbr || "";
        })
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "central")
        .attr("font-size", "14px")
        .attr("fill", "#222");

    

    updateMonth(0);
});

function getColor(d) {
    let name = d.properties.name || d.properties.NAME;
    if (!name) return "#ccc";

    let month = months[monthIndex];
    let record = temperatureData[`${name}_${month}`];
    if (record) {
        let value = record[attribute];
        let scale = colorScales[attribute];
        scale.domain(attributeRanges[attribute]);  // Dynamic domain based on real data
        return scale(value);
    }
    return "#eee";
}

function changeAttribute(attr) {
    attribute = attr;
    redraw();
}

function updateMonth(index) {
    monthIndex = +index;
    document.getElementById("month-label").textContent = `Month: ${months[monthIndex]}`;
    redraw();
}

function redraw() {
    // Update the choropleth map
    svg.selectAll("path")
        .attr("fill", d => getColor(d));

    // --- Scatterplot update ---
    scatterSvg.selectAll("*").remove(); // Clear previous points

    let scatterData = [];

    // Prepare scatter data for the selected month
    for (const key in temperatureData) {
        const [name, month] = key.split("_");
        if (month === months[monthIndex]) {
            scatterData.push({
                name: name,
                region: getRegion(name),
                TMIN: temperatureData[key].TMIN,
                TMAX: temperatureData[key].TMAX
            });
        }
    }

    // Update xScale and yScale domain
    xScale.domain(d3.extent(scatterData, d => d.TMIN)).nice();
    yScale.domain(d3.extent(scatterData, d => d.TMAX)).nice();

    // Draw X and Y axes
    scatterSvg.append("g")
        .attr("transform", "translate(0,940)")
        .call(d3.axisBottom(xScale));
    
    scatterSvg.append("g")
        .attr("transform", "translate(60,0)")
        .call(d3.axisLeft(yScale));

    // Draw points
    scatterSvg.selectAll("circle")
    .data(scatterData)
    .join("circle")
    .attr("cx", d => xScale(d.TMIN))
    .attr("cy", d => yScale(d.TMAX))
    .attr("r", 8)
    .attr("fill", d => d.region === "CN" ? "red" : "blue")
    .attr("opacity", 0.5)
    .on("mouseover", function(event, d) {
        const tooltip = d3.select("#tooltip");
        tooltip.style("visibility", "visible")
            .html(`
                <strong>${d.name}</strong><br/>
                Country: ${d.region === "CN" ? "China" : "US"}<br/>
                TMIN: ${d.TMIN} °C<br/>
                TMAX: ${d.TMAX} °C<br/>
            `);
    })
    .on("mousemove", function(event) {
        const tooltip = d3.select("#tooltip");
        tooltip.style("top", (event.pageY - 40) + "px")
               .style("left", (event.pageX + 20) + "px");
    })
    .on("mouseout", function() {
        d3.select("#tooltip").style("visibility", "hidden");
    });

    // Optional: Add text abbreviation above points
    // scatterSvg.selectAll("text.label")
    //     .data(scatterData)
    //     .join("text")
    //     .attr("class", "label")
    //     .attr("x", d => xScale(d.TMIN))
    //     .attr("y", d => yScale(d.TMAX) - 8)
    //     .attr("text-anchor", "middle")
    //     .attr("font-size", "12px")
    //     .attr("fill", "#333")
    //     .text(d => getAbbreviation(d.name, d.region));

    // X-axis label
        scatterSvg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", 500) // middle of scatter plot (1000 width)
        .attr("y", 990) // near bottom
        .attr("font-size", "16px")
        .attr("fill", "#333")
        .text("Min Temperature (°C)");

        // Y-axis label
        scatterSvg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("x", -500) // middle after rotation
        .attr("y", 20) // a bit outside left
        .attr("font-size", "16px")
        .attr("fill", "#333")
        .text("Max Temperature (°C)");
    // --- Add scatter plot legend ---
        const legendData = [
            { color: "red", label: "China Provinces" },
            { color: "blue", label: "US States" }
        ];

        // Remove old legend
        scatterSvg.selectAll(".legend").remove();

        // Draw new legend
        const legend = scatterSvg.append("g")
            .attr("class", "legend")
            .attr("transform", "translate(800,800)"); // Position: adjust x, y if needed

        legend.selectAll("circle")
            .data(legendData)
            .join("circle")
            .attr("cx", 0)
            .attr("cy", (d, i) => i * 25)
            .attr("r", 7)
            .attr("fill", d => d.color)
            .attr("opacity", 0.5);

        legend.selectAll("text")
            .data(legendData)
            .join("text")
            .attr("x", 20)
            .attr("y", (d, i) => i * 25 + 5)
            .text(d => d.label)
            .attr("font-size", "14px")
            .attr("fill", "#333");
}

function getAbbreviation(name, region) {
    if (region === "US") {
        for (const [abbr, fullname] of Object.entries(usStateAbbrToName)) {
            if (fullname === name) return abbr;
        }
    } else if (region === "CN") {
        for (const [abbr, fullname] of Object.entries(cnProvinceAbbrToName)) {
            if (fullname === name) return abbr;
        }
        // Special case for Taiwan after merge
        if (name === "Taiwan") return "TW";
    }
    return null;
}

function getRegion(name) {
    for (const [abbr, fullname] of Object.entries(usStateAbbrToName)) {
        if (fullname === name) return "US";
    }
    for (const [abbr, fullname] of Object.entries(cnProvinceAbbrToName)) {
        if (fullname === name) return "CN";
    }
    if (name === "Taiwan") return "CN"; // special case
    return null;
}