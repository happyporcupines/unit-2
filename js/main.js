//initialize map variable globally
var map;

//function to instantiate the Leaflet map
function createMap(){

    //create the map
    map = L.map('map', {
        center: [0, 0],
        zoom: 2
    });

    //add OSM base tilelayer
    L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
    }).addTo(map);

    //call getData function
    getData(map);
};

//builds popup HTML with a country title and inline line chart
function createPopupContent(properties) {
    //fallback title if Country is missing
    var country = properties.Country || "Unknown";

    //find all internet-use fields (use_1990 ... use_2023) and sort by year
    var keys = Object.keys(properties)
        .filter(function (k) { return k.indexOf("use_") === 0; })
        .sort(function (a, b) { return Number(a.split("_")[1]) - Number(b.split("_")[1]); });

    //split sorted keys into chart values and x-axis year labels
    var values = keys.map(function (k) { return Number(properties[k]); });
    var years = keys.map(function (k) { return k.split("_")[1]; });

    //chart size and inner plot margins
    var width = 240, height = 120;
    var chartLeft = 38, chartRight = 12, chartTop = 10, chartBottom = 20;

    //horizontal spacing between year points
    var xStep = (width - chartLeft - chartRight) / (values.length - 1 || 1);

    function valueToY(value) {
        return height - chartBottom - (value / 100) * (height - chartTop - chartBottom);
    }

    //convert each value (0-100%) into SVG x,y coordinates for the line path
    var points = values.map(function (v, i) {
        var x = chartLeft + i * xStep;
        var y = valueToY(v); // 0–100%
        return x + "," + y;
    }).join(" ");

    //draw visible point markers on each line vertex
    var circles = values.map(function (v, i) {
        var x = chartLeft + i * xStep;
        var y = valueToY(v);
        return '<circle cx="' + x + '" cy="' + y + '" r="3" fill="#ff7800"></circle>';
    }).join("");

    //draw year labels along the bottom axis
    var labels = years.map(function (yr, i) {
        var x = chartLeft + i * xStep;
        return '<text x="' + x + '" y="' + (height - 5) + '" font-size="8" text-anchor="middle">' + yr + '</text>';
    }).join("");

    //draw y-axis tick marks and labels for percentages
    var yTickValues = [0, 25, 50, 75, 100];
    var yGridLines = yTickValues.map(function (tick) {
        var y = valueToY(tick);
        return '<line x1="' + chartLeft + '" y1="' + y + '" x2="' + (width - chartRight) + '" y2="' + y + '" stroke="#bdbdbd" stroke-width="1" stroke-dasharray="2,2"/>';
    }).join("");

    var yTicks = yTickValues.map(function (tick) {
        var y = valueToY(tick);
        return '<line x1="' + (chartLeft - 4) + '" y1="' + y + '" x2="' + chartLeft + '" y2="' + y + '" stroke="#666"/>' +
            '<text x="' + (chartLeft - 7) + '" y="' + (y + 3) + '" font-size="8" text-anchor="end" fill="#333">' + tick + '%</text>';
    }).join("");

    //return popup title + chart markup
    return `
        <h3 style="margin:0 0 6px 0;">${country}</h3>
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            ${yGridLines}
            <line x1="${chartLeft}" y1="${height - chartBottom}" x2="${width - chartRight}" y2="${height - chartBottom}" stroke="#777"/>
            <line x1="${chartLeft}" y1="${chartTop}" x2="${chartLeft}" y2="${height - chartBottom}" stroke="#777"/>
            ${yTicks}
            <polyline fill="none" stroke="#ff7800" stroke-width="2" points="${points}"></polyline>
            ${circles}
            ${labels}
        </svg>
    `;
}

//bind one popup per feature using the feature's properties
function onEachFeature(feature, layer) {
    layer.bindPopup(createPopupContent(feature.properties));
}

//function to retrieve the data and place it on the map
function getData(map){
    fetch("data/internetUse.geojson")
        .then(function(response){
            return response.json();
        })
        .then(function(json){
            var geojsonMarkerOptions = {
                radius: 8,
                fillColor: "#ff7800",
                color: "#000",
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8,
                interactive: true
            };

            //create a Leaflet GeoJSON layer and add it to the map
            L.geoJson(json, {
                onEachFeature: onEachFeature,
                pointToLayer: function (feature, latlng){
                    return L.circleMarker(latlng, geojsonMarkerOptions);
                }
            }).addTo(map);
        })
        .catch(function(error) {
            console.error("Error loading GeoJSON:", error);
        });
};

document.addEventListener('DOMContentLoaded',createMap)

