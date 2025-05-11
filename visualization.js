// 映射表
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

let cnProjection = d3.geoIdentity().reflectY(true);
let usProjection = d3.geoAlbersUsa().scale(1400).translate([1650, 400]);

let usPath = d3.geoPath().projection(usProjection);
let cnPath = d3.geoPath().projection(cnProjection);

let attribute = "TAVG";
let monthIndex = 0;
let months = [];
let temperatureData = {};

// 修改存储选中区域的变量
let selectedRegions = []; // 存储多个选中的区域
let usStates = []; // 存储美国州数据
let cnProvinces = []; // 存储中国省数据

// 为面板拖动功能添加变量
let isDragging = false;
let offsetX, offsetY;

const colorScales = {
    TMIN: d3.scaleSequential(d3.interpolateBlues),
    TMAX: d3.scaleSequential(d3.interpolateReds),
    TAVG: d3.scaleSequential(d3.interpolateGreens)
};

// 为每个属性定义动态的最小/最大范围
const attributeRanges = {
    TAVG: [Infinity, -Infinity],
    TMAX: [Infinity, -Infinity],
    TMIN: [Infinity, -Infinity]
};

// 设置随机颜色数组，用于多个区域的线条颜色
const regionColors = [
    "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", 
    "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
    "#aec7e8", "#ffbb78", "#98df8a", "#ff9896", "#c5b0d5",
    "#c49c94", "#f7b6d2", "#c7c7c7", "#dbdb8d", "#9edae5"
];

// 为面板添加拖动功能
document.addEventListener('DOMContentLoaded', function() {
    const detailPanel = document.getElementById('detail-panel');
    const panelHeader = document.querySelector('#detail-panel .panel-header');
    
    panelHeader.addEventListener('mousedown', function(e) {
        isDragging = true;
        
        // 计算鼠标在面板内的相对位置
        const rect = detailPanel.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        
        // 移除transform，使面板可以使用top和left属性定位
        detailPanel.style.transform = 'none';
    });
    
    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        
        // 计算新位置并移动面板
        detailPanel.style.left = (e.clientX - offsetX) + 'px';
        detailPanel.style.top = (e.clientY - offsetY) + 'px';
    });
    
    document.addEventListener('mouseup', function() {
        isDragging = false;
    });
});

Promise.all([
    d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"),
    d3.json("/dataset/cn-provinces-english.json"),
    d3.csv("/dataset/CN-complete-temp-celsius-23-24.csv"),
    d3.csv("/dataset/US-complete-temp-celsius-23-24.csv")
]).then(([usMap, cnMap, cnData, usData]) => {

    // 准备温度数据并计算属性范围
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

    usStates = topojson.feature(usMap, usMap.objects.states).features;
    usStates.forEach(d => d.properties.region = "US");

    cnProvinces = cnMap.features;
    cnProvinces.forEach(d => d.properties.region = "CN");

    // 适应中国地图投影
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
        .attr("stroke-width", 0.5)
        .attr("class", "region")
        .on("click", function(event, d) {
            // 当点击一个地区时
            const name = d.properties.name || d.properties.NAME;
            
            // 检查是否已经选择过这个区域
            const existingIndex = selectedRegions.findIndex(r => r.name === name && r.region === d.properties.region);
            
            if (existingIndex !== -1) {
                // 如果已经选择过，则移除该区域的选择
                d3.select(this).classed("selected-region", false);
                selectedRegions.splice(existingIndex, 1);
            } else {
                // 新选择的区域，添加到选择列表中
                d3.select(this).classed("selected-region", true);
                
                // 存储新选中的区域及其数据
                const newRegion = {
                    name: name,
                    region: d.properties.region,
                    data: getRegionData(name),
                    // 分配一个颜色
                    color: regionColors[selectedRegions.length % regionColors.length]
                };
                
                selectedRegions.push(newRegion);
            }
            
            // 更新区域列表和图表
            updateSelectedRegionsList();
            
            // 如果有选中的区域，显示详细信息面板
            if (selectedRegions.length > 0) {
                showDetailPanel();
            } else {
                closeDetailPanel();
            }
        });

    svg.append("g")
        .selectAll("text")
        .data(combined)
        .join("text")
        .attr("x", d => {
            const centroid = d.properties.region === "US" ? usPath.centroid(d) : cnPath.centroid(d);
            if (isNaN(centroid[0]) || isNaN(centroid[1])) return null; // 忽略错误点
            return centroid[0];
        })
        .attr("y", d => {
            const centroid = d.properties.region === "US" ? usPath.centroid(d) : cnPath.centroid(d);
            if (isNaN(centroid[0]) || isNaN(centroid[1])) return null;
            let y = centroid[1];
            if (d.properties.region === "CN") {
                y = y * 1.3 + 50; // 拉伸并下移
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

// 获取指定地区的所有月份数据
function getRegionData(name) {
    let result = [];
    for (let i = 0; i < months.length; i++) {
        const month = months[i];
        const key = `${name}_${month}`;
        
        if (temperatureData[key]) {
            result.push({
                month: month,
                TAVG: temperatureData[key].TAVG,
                TMAX: temperatureData[key].TMAX,
                TMIN: temperatureData[key].TMIN
            });
        }
    }
    return result;
}

function getColor(d) {
    let name = d.properties.name || d.properties.NAME;
    if (!name) return "#ccc";

    let month = months[monthIndex];
    let record = temperatureData[`${name}_${month}`];
    if (record) {
        let value = record[attribute];
        let scale = colorScales[attribute];
        scale.domain(attributeRanges[attribute]);  // 基于实际数据的动态域
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

// 更新选中区域列表
function updateSelectedRegionsList() {
    const listElement = document.getElementById("selected-regions-list");
    
    // 清空现有列表
    listElement.innerHTML = "";
    
    // 为每个选中的区域创建一个列表项
    selectedRegions.forEach((region, index) => {
        const listItem = document.createElement("li");
        listItem.className = "region-item";
        listItem.innerHTML = `
            <span style="color: ${region.color}">■</span> 
            ${region.name} (${region.region === "CN" ? "China" : "USA"})
            <span class="remove-btn" onclick="removeRegion(${index})">×</span>
        `;
        listElement.appendChild(listItem);
    });
}

// 从选中列表中移除区域
function removeRegion(index) {
    if (index >= 0 && index < selectedRegions.length) {
        const region = selectedRegions[index];
        
        // 移除地图上的选中样式
        svg.selectAll(".region").each(function(d) {
            const name = d.properties.name || d.properties.NAME;
            if (name === region.name && d.properties.region === region.region) {
                d3.select(this).classed("selected-region", false);
            }
        });
        
        // 从数组中移除
        selectedRegions.splice(index, 1);
        
        // 更新列表和图表
        updateSelectedRegionsList();
        updateDetailChart();
        
        // 如果没有选中的区域，关闭面板
        if (selectedRegions.length === 0) {
            closeDetailPanel();
        }
    }
}

// 显示详细信息面板
function showDetailPanel() {
    // 确保详细面板可见
    document.getElementById("detail-panel").style.display = "block";
    
    // 更新图表
    updateDetailChart();
}

// 关闭详细信息面板
function closeDetailPanel() {
    document.getElementById("detail-panel").style.display = "none";
    
    // 清除所有选中状态
    svg.selectAll(".region").classed("selected-region", false);
    selectedRegions = [];
    updateSelectedRegionsList();
}

// 更新详细图表 - 显示多个区域的数据
function updateDetailChart() {
    if (selectedRegions.length === 0) return;
    
    // 获取选中的属性
    const selectedAttributes = [];
    document.querySelectorAll("#detail-panel .attribute-selector input:checked").forEach(input => {
        selectedAttributes.push(input.value);
    });
    
    if (selectedAttributes.length === 0) return;
    
    // 设置图表尺寸和边距
    const margin = {top: 30, right: 100, bottom: 50, left: 60};
    const chartWidth = 800 - margin.left - margin.right;
    const chartHeight = 400 - margin.top - margin.bottom;
    
    // 清除旧图表
    d3.select("#detail-chart").selectAll("*").remove();
    
    // 创建SVG
    const detailSvg = d3.select("#detail-chart")
        .attr("width", chartWidth + margin.left + margin.right)
        .attr("height", chartHeight + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // 创建X轴比例尺（月份）
    const xScale = d3.scaleBand()
        .domain(months)
        .range([0, chartWidth])
        .padding(0.1);
    
    // 收集所有区域的数据以确定Y轴范围
    let allData = [];
    selectedRegions.forEach(region => {
        allData = allData.concat(region.data);
    });
    
    // 创建Y轴比例尺（温度）
    const yScale = d3.scaleLinear()
        .domain([
            d3.min(allData, d => Math.min(...selectedAttributes.map(attr => d[attr]))) - 2,
            d3.max(allData, d => Math.max(...selectedAttributes.map(attr => d[attr]))) + 2
        ])
        .nice()
        .range([chartHeight, 0]);
    
    // 添加X轴
    detailSvg.append("g")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(d3.axisBottom(xScale))
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-45)");
    
    // 添加Y轴
    detailSvg.append("g")
        .call(d3.axisLeft(yScale));
    
    // 添加Y轴标签
    detailSvg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -40)
        .attr("x", -chartHeight / 2)
        .attr("text-anchor", "middle")
        .text("Temperature (°C)");
    
    // 添加X轴标签
    detailSvg.append("text")
        .attr("x", chartWidth / 2)
        .attr("y", chartHeight + margin.bottom - 5)
        .attr("text-anchor", "middle")
        .text("Month");
    
    // 为每个属性和区域创建线条
    const attributeStyles = {
        "TAVG": { dasharray: "none" },
        "TMAX": { dasharray: "5,5" },
        "TMIN": { dasharray: "2,2" }
    };
    
    // 创建线条生成器
    const line = d3.line()
        .x(d => xScale(d.month) + xScale.bandwidth() / 2)
        .y(d => yScale(d.value))
        .defined(d => !isNaN(d.value)); // 跳过NaN值
    
    // 绘制每个区域的每个属性的线条
    selectedRegions.forEach(region => {
        selectedAttributes.forEach(attr => {
            // 准备该区域该属性的数据
            const data = region.data.map(d => ({
                month: d.month,
                value: d[attr]
            }));
            
            // 绘制线条
            detailSvg.append("path")
                .datum(data)
                .attr("fill", "none")
                .attr("stroke", region.color)
                .attr("stroke-width", 2)
                .attr("stroke-dasharray", attributeStyles[attr].dasharray)
                .attr("d", line);
            
            // 为每条线添加数据点
            detailSvg.selectAll(`.dot-${attr}-${region.name.replace(/\s+/g, "-")}`)
                .data(data)
                .join("circle")
                .attr("class", `dot-${attr}-${region.name.replace(/\s+/g, "-")}`)
                .attr("cx", d => xScale(d.month) + xScale.bandwidth() / 2)
                .attr("cy", d => yScale(d.value))
                .attr("r", 4)
                .attr("fill", region.color)
                .on("mouseover", function(event, d) {
                    const tooltip = d3.select("#tooltip");
                    tooltip.style("visibility", "visible")
                        .html(`
                            <strong>${region.name} (${region.region === "CN" ? "China" : "USA"})</strong><br/>
                            ${attr}: ${d.value.toFixed(1)} °C<br/>
                            Month: ${d.month}
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
        });
    });
    
    // 添加图例
    const legend = detailSvg.append("g")
        .attr("transform", `translate(${chartWidth + 10}, 0)`);
    
    // 区域图例
    legend.append("text")
        .attr("x", 0)
        .attr("y", 0)
        .text("Regions")
        .style("font-weight", "bold")
        .style("font-size", "12px");
    
    // 为每个区域添加图例项
    selectedRegions.forEach((region, i) => {
        legend.append("rect")
            .attr("x", 0)
            .attr("y", i * 20 + 10)
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", region.color);
        
        legend.append("text")
            .attr("x", 20)
            .attr("y", i * 20 + 22)
            .text(region.name + (region.region === "CN" ? " (CN)" : " (US)"))
            .style("font-size", "11px");
    });
    
    // 属性图例
    legend.append("text")
        .attr("x", 0)
        .attr("y", selectedRegions.length * 20 + 40)
        .text("Attributes")
        .style("font-weight", "bold")
        .style("font-size", "12px");
    
    // 为每个属性添加图例项
    selectedAttributes.forEach((attr, i) => {
        // 添加线条样式示例
        legend.append("line")
            .attr("x1", 0)
            .attr("y1", selectedRegions.length * 20 + 50 + i * 20 + 7)
            .attr("x2", 15)
            .attr("y2", selectedRegions.length * 20 + 50 + i * 20 + 7)
            .attr("stroke", "#333")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", attributeStyles[attr].dasharray);
        
        legend.append("text")
            .attr("x", 20)
            .attr("y", selectedRegions.length * 20 + 50 + i * 20 + 12)
            .text(attr)
            .style("font-size", "11px");
    });
}

function redraw() {
    // 更新地图的颜色
    svg.selectAll("path")
        .attr("fill", d => getColor(d));

    // --- 更新散点图 ---
    scatterSvg.selectAll("*").remove(); // 清除以前的点

    let scatterData = [];

    // 准备当前选择月份的散点数据
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

    // 更新xScale和yScale域
    xScale.domain(d3.extent(scatterData, d => d.TMIN)).nice();
    yScale.domain(d3.extent(scatterData, d => d.TMAX)).nice();

    // 绘制X和Y轴
    scatterSvg.append("g")
        .attr("transform", "translate(0,940)")
        .call(d3.axisBottom(xScale));
    
    scatterSvg.append("g")
        .attr("transform", "translate(60,0)")
        .call(d3.axisLeft(yScale));

    // 绘制点
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

    // X轴标签
    scatterSvg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", 500) // 散点图中间 (1000宽度)
        .attr("y", 990) // 底部附近
        .attr("font-size", "16px")
        .attr("fill", "#333")
        .text("Min Temperature (°C)");

    // Y轴标签
    scatterSvg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("x", -500) // 旋转后的中间位置
        .attr("y", 20) // 左侧外部
        .attr("font-size", "16px")
        .attr("fill", "#333")
        .text("Max Temperature (°C)");
        
    // --- 添加散点图图例 ---
    const legendData = [
        { color: "red", label: "China Provinces" },
        { color: "blue", label: "US States" }
    ];

    // 移除旧图例
    scatterSvg.selectAll(".legend").remove();

    // 绘制新图例
    const legend = scatterSvg.append("g")
        .attr("class", "legend")
        .attr("transform", "translate(800,800)"); // 位置：根据需要调整x, y

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
    
    // 如果有选中的区域，更新图表
    if (selectedRegions.length > 0) {
        updateDetailChart();
    }
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
        // 台湾特殊情况
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
    if (name === "Taiwan") return "CN"; // 特殊情况
    return null;
}