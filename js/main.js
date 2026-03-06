//declare map variable globally so all functions have access
var map;
var minValue;
var symbolsLayer;

function isDataAttribute(propertyName){
    return propertyName.indexOf("use_") === 0 || /^\d{4}_I$/.test(propertyName);
}

function getAttributeYear(attribute){
    if (!attribute){
        return "";
    }

    var yearMatch = String(attribute).match(/\d{4}/);
    return yearMatch ? yearMatch[0] : attribute;
}

function getCountryLabel(properties){
    return properties.Country || properties["Country Name"] || "Unknown";
}

//step 1 create map
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
    getData();
};

function calcMinValue(data){
    var allValues = [];

    for (var city of data.features){
        for (var property in city.properties){
            if (isDataAttribute(property)){
                var value = Number(city.properties[property]);
                if (value > 0){
                    allValues.push(value);
                }
            }
        }
    }

    if (!allValues.length){
        return 1;
    }

    return Math.min(...allValues);
}

//calculate the radius of each proportional symbol
function calcPropRadius(attValue) {
    var minRadius = 5;

    if (!isFinite(attValue) || attValue <= 0){
        return minRadius;
    }

    var radius = 1.0083 * Math.pow(attValue / minValue, 0.5715) * minRadius;
    return radius;
};

function processData(data){
    var attributes = [];

    if (!data.features || !data.features.length){
        return attributes;
    }

    var properties = data.features[0].properties;

    for (var attribute in properties){
        if (isDataAttribute(attribute)){
            attributes.push(attribute);
        }
    }

    attributes.sort(function(a, b){
        return Number(getAttributeYear(a)) - Number(getAttributeYear(b));
    });

    return attributes;
}

//function to update the year in the legend
function updateYearDisplay(attribute){
    var year = getAttributeYear(attribute);
    document.querySelector("#selected-year").textContent = year;
}

//function to convert markers to circle markers and add popups
function pointToLayer(feature, latlng, attributes){
    var attribute = attributes[0];

    var options = {
        fillColor: "#ff7800",
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
    };

    var attValue = Number(feature.properties[attribute]);
    options.radius = calcPropRadius(attValue);

    var layer = L.circleMarker(latlng, options);

    var popupContent = "<p><b>Country:</b> " + getCountryLabel(feature.properties) + "</p>";
    var year = getAttributeYear(attribute);
    popupContent += "<p><b>Internet use in " + year + ":</b> " + feature.properties[attribute] + "%</p>";

    layer.bindPopup(popupContent, {
        offset: new L.Point(0, -options.radius)
    });

    return layer;
};

//Step 3: Add circle markers for point features to the map
function createPropSymbols(data, attributes){
    symbolsLayer = L.geoJson(data, {
        filter: function(feature){
            return !!(feature && feature.geometry && feature.geometry.type === "Point");
        },
        pointToLayer: function(feature, latlng){
            return pointToLayer(feature, latlng, attributes);
        }
    }).addTo(map);
};

//Step 10: Resize proportional symbols according to new attribute values
function updatePropSymbols(attribute){
    updateYearDisplay(attribute);

    symbolsLayer.eachLayer(function(layer){
        if (layer.feature && Object.prototype.hasOwnProperty.call(layer.feature.properties, attribute)){
            var props = layer.feature.properties;
            var radius = calcPropRadius(props[attribute]);
            layer.setRadius(radius);

            var popupContent = "<p><b>Country:</b> " + getCountryLabel(props) + "</p>";
            var year = getAttributeYear(attribute);
            popupContent += "<p><b>Internet use in " + year + ":</b> " + props[attribute] + "%</p>";

            var popup = layer.getPopup();
            popup.setContent(popupContent);
            popup.options.offset = new L.Point(0, -radius);
            popup.update();
        }
    });
};

//Step 1: Create new sequence controls
function createSequenceControls(attributes){
    var slider = "<input class='range-slider' type='range'></input>";
    document.querySelector("#panel").insertAdjacentHTML('beforeend', slider);

    document.querySelector(".range-slider").max = attributes.length - 1;
    document.querySelector(".range-slider").min = 0;
    document.querySelector(".range-slider").value = 0;
    document.querySelector(".range-slider").step = 1;

    document.querySelector('#panel').insertAdjacentHTML('beforeend','<button class="step" id="reverse"></button>');
    document.querySelector('#panel').insertAdjacentHTML('beforeend','<button class="step" id="forward"></button>');

    document.querySelector('#reverse').insertAdjacentHTML('beforeend',"<img src='img/noun-left-arrow.png'>");
    document.querySelector('#forward').insertAdjacentHTML('beforeend',"<img src='img/noun-right-arrow.png'>");

    updateYearDisplay(attributes[0]);

    document.querySelectorAll('.step').forEach(function(step){
        step.addEventListener("click", function(){
            var index = Number(document.querySelector('.range-slider').value);

            if (step.id == 'forward'){
                index++;
                index = index > attributes.length - 1 ? 0 : index;
            } else if (step.id == 'reverse'){
                index--;
                index = index < 0 ? attributes.length - 1 : index;
            }

            document.querySelector('.range-slider').value = index;
            updatePropSymbols(attributes[index]);
        })
    })

    document.querySelector('.range-slider').addEventListener('input', function(){
        var index = Number(this.value);
        updatePropSymbols(attributes[index]);
    });
};

//Step 2: Import GeoJSON data
function getData(){
    fetch("data/Digital_Country_Data.geojson")
        .then(function(response){
            if (!response.ok){
                throw new Error("HTTP " + response.status + " loading Digital_Country_Data.geojson");
            }
            return response.json();
        })
        .then(function(json){
            var attributes = processData(json);

            if (!attributes.length){
                throw new Error("No time-series attributes found in Digital_Country_Data.geojson");
            }

            minValue = calcMinValue(json);
            createPropSymbols(json, attributes);
            createSequenceControls(attributes);
        })
        .catch(function(error){
            console.error("Error loading proportional symbol data:", error);
        });
};

document.addEventListener('DOMContentLoaded',createMap)

