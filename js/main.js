//declare map variable globally so all functions have access
var map;
var minValue;
var metricLayers = {};

function isDataAttribute(propertyName){
    return /^\d{4}_[IP]$/.test(propertyName);
}

function getMetricAttribute(year, metricSuffix){
    return year + "_" + metricSuffix;
}

function getYearList(data){
    var internetYears = [];
    var phoneYears = [];

    if (!data.features || !data.features.length){
        return [];
    }

    var properties = data.features[0].properties;
    for (var property in properties){
        if (/^\d{4}_I$/.test(property)){
            internetYears.push(property.split("_")[0]);
        } else if (/^\d{4}_P$/.test(property)){
            phoneYears.push(property.split("_")[0]);
        }
    }

    var phoneYearSet = new Set(phoneYears);
    var years = Array.from(new Set(internetYears)).filter(function(year){
        return phoneYearSet.has(year);
    });

    years.sort(function(a, b){
        return Number(a) - Number(b);
    });

    return years;
}

function getPopupContent(properties){
    var fields = [
        "Use_Maturity",
        "Culture_and_Norms",
        "Renowned_For",
        "Digital_Fun_Fact",
        "Regional_Pattern"
    ];

    var popupContent = "<ol>";
    fields.forEach(function(field){
        var value = properties[field] || "N/A";
        popupContent += "<li><b>" + field + ":</b> " + value + "</li>";
    });
    popupContent += "</ol>";

    return popupContent;
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

//function to update the year in the legend
function updateYearDisplay(year){
    document.querySelector("#selected-year").textContent = year;
}

//function to convert markers to circle markers and add popups
function pointToLayer(feature, latlng, year, metricSuffix){
    var attribute = getMetricAttribute(year, metricSuffix);
    var isInternet = metricSuffix === "I";

    var options = {
        fillColor: isInternet ? "#1f78b4" : "#e31a1c",
        color: isInternet ? "#1f78b4" : "#e31a1c",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.35
    };

    var attValue = Number(feature.properties[attribute]);
    options.radius = calcPropRadius(attValue);

    var layer = L.circleMarker(latlng, options);

    var popupContent = getPopupContent(feature.properties);

    layer.bindPopup(popupContent, {
        offset: new L.Point(0, -options.radius)
    });

    return layer;
};

//Step 3: Add circle markers for point features to the map
function createPropSymbols(data, year){
    metricLayers.I = L.geoJson(data, {
        filter: function(feature){
            return !!(feature && feature.geometry && feature.geometry.type === "Point");
        },
        pointToLayer: function(feature, latlng){
            return pointToLayer(feature, latlng, year, "I");
        }
    }).addTo(map);

    metricLayers.P = L.geoJson(data, {
        filter: function(feature){
            return !!(feature && feature.geometry && feature.geometry.type === "Point");
        },
        pointToLayer: function(feature, latlng){
            return pointToLayer(feature, latlng, year, "P");
        }
    }).addTo(map);
};

//Step 10: Resize proportional symbols according to new attribute values
function updatePropSymbols(year){
    updateYearDisplay(year);

    ["I", "P"].forEach(function(metricSuffix){
        var layerGroup = metricLayers[metricSuffix];
        var attribute = getMetricAttribute(year, metricSuffix);

        if (!layerGroup){
            return;
        }

        layerGroup.eachLayer(function(layer){
            if (!layer.feature){
                return;
            }

            var props = layer.feature.properties;
            var radius = calcPropRadius(Number(props[attribute]));
            layer.setRadius(radius);

            var popup = layer.getPopup();
            popup.setContent(getPopupContent(props));
            popup.options.offset = new L.Point(0, -radius);
            popup.update();
        });
    });
};

//Step 1: Create new sequence controls
function createSequenceControls(years){
    var slider = "<input class='range-slider' type='range'></input>";
    document.querySelector("#panel").insertAdjacentHTML('beforeend', slider);

    document.querySelector(".range-slider").max = years.length - 1;
    document.querySelector(".range-slider").min = 0;
    document.querySelector(".range-slider").value = 0;
    document.querySelector(".range-slider").step = 1;

    document.querySelector('#panel').insertAdjacentHTML('beforeend','<button class="step" id="reverse"></button>');
    document.querySelector('#panel').insertAdjacentHTML('beforeend','<button class="step" id="forward"></button>');

    document.querySelector('#reverse').insertAdjacentHTML('beforeend',"<img src='img/noun-left-arrow.png'>");
    document.querySelector('#forward').insertAdjacentHTML('beforeend',"<img src='img/noun-right-arrow.png'>");

    updateYearDisplay(years[0]);

    document.querySelectorAll('.step').forEach(function(step){
        step.addEventListener("click", function(){
            var index = Number(document.querySelector('.range-slider').value);

            if (step.id == 'forward'){
                index++;
                index = index > years.length - 1 ? 0 : index;
            } else if (step.id == 'reverse'){
                index--;
                index = index < 0 ? years.length - 1 : index;
            }

            document.querySelector('.range-slider').value = index;
            updatePropSymbols(years[index]);
        })
    })

    document.querySelector('.range-slider').addEventListener('input', function(){
        var index = Number(this.value);
        updatePropSymbols(years[index]);
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
            var years = getYearList(json);

            if (!years.length){
                throw new Error("No time-series attributes found in Digital_Country_Data.geojson");
            }

            minValue = calcMinValue(json);
            createPropSymbols(json, years[0]);
            createSequenceControls(years);
        })
        .catch(function(error){
            console.error("Error loading proportional symbol data:", error);
        });
};

document.addEventListener('DOMContentLoaded',createMap)

