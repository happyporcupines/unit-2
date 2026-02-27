//declare map variable globally so all functions have access
var map;
var minValue;

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
    //create empty array to store all data values
    var allValues = [];
    //loop through each city
    for(var city of data.features){
        //loop through each internet-use attribute
        for(var property in city.properties){
            if(property.indexOf("use_") === 0){
                var value = Number(city.properties[property]);
                if(value > 0){
                    allValues.push(value);
                }
            }
        }
    }
    //get minimum non-zero value of our array
    var minValue = Math.min(...allValues)

    return minValue;
}

//calculate the radius of each proportional symbol
function calcPropRadius(attValue) {
    //constant factor adjusts symbol sizes evenly
    var minRadius = 5;
    //Flannery Appearance Compensation formula
    var radius = 1.0083 * Math.pow(attValue/minValue,0.5715) * minRadius

    return radius;
};

function processData(data){
    //empty array to hold attributes
    var attributes = [];
    var attributePrefix = "use_";

    //properties of the first feature in the dataset
    var properties = data.features[0].properties;

    //push each matching attribute name into attributes array
    for (var attribute in properties){
        if (attribute.indexOf(attributePrefix) > -1){
            attributes.push(attribute);
        }
    }

    //sort attributes chronologically (use_1990, use_1995, ...)
    attributes.sort(function(a, b){
        return Number(a.split("_")[1]) - Number(b.split("_")[1]);
    });

    //check result
    console.log(attributes);

    return attributes;
}

//function to convert markers to circle markers and add popups
function pointToLayer(feature, latlng, attributes){
    //Step 4: Assign the current attribute based on the first index of the attributes array
    var attribute = attributes[0];
    //check
    console.log(attribute);

    //create marker options
    var options = {
        fillColor: "#ff7800",
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
    };

    //For each feature, determine its value for the selected attribute
    var attValue = Number(feature.properties[attribute]);

    //Give each feature's circle marker a radius based on its attribute value
    options.radius = calcPropRadius(attValue);

    //create circle marker layer
    var layer = L.circleMarker(latlng, options);

    //build popup content string starting with country
    var popupContent = "<p><b>Country:</b> " + feature.properties.Country + "</p>";

    //add formatted attribute to popup content string
    var year = attribute.split("_")[1];
    popupContent += "<p><b>Internet use in " + year + ":</b> " + feature.properties[attribute] + "%</p>";

    //bind the popup to the circle marker
    layer.bindPopup(popupContent, {
        offset: new L.Point(0, -options.radius)
    });

    //return the circle marker to the L.geoJson pointToLayer option
    return layer;
};

//Step 3: Add circle markers for point features to the map
function createPropSymbols(data, attributes){
    L.geoJson(data, {
        pointToLayer: function(feature, latlng){
            return pointToLayer(feature, latlng, attributes);
        }
    }).addTo(map);
};

//Step 10: Resize proportional symbols according to new attribute values
function updatePropSymbols(attribute){
    map.eachLayer(function(layer){
        if (layer.feature && layer.feature.properties[attribute]){
            //access feature properties
            var props = layer.feature.properties;

            //update each feature's radius based on new attribute values
            var radius = calcPropRadius(props[attribute]);
            layer.setRadius(radius);

            //build updated popup content
            var popupContent = "<p><b>Country:</b> " + props.Country + "</p>";
            var year = attribute.split("_")[1];
            popupContent += "<p><b>Internet use in " + year + ":</b> " + props[attribute] + "%</p>";

            //update popup with new content and offset
            var popup = layer.getPopup();
            popup.setContent(popupContent);
            popup.options.offset = new L.Point(0, -radius);
            popup.update();
        };
    });
};

//Step 1: Create new sequence controls
function createSequenceControls(attributes){
    //create range input element (slider)
    var slider = "<input class='range-slider' type='range'></input>";
    document.querySelector("#panel").insertAdjacentHTML('beforeend', slider);

    //set slider attributes
    document.querySelector(".range-slider").max = attributes.length - 1;
    document.querySelector(".range-slider").min = 0;
    document.querySelector(".range-slider").value = 0;
    document.querySelector(".range-slider").step = 1;

    //add step buttons
    document.querySelector('#panel').insertAdjacentHTML('beforeend','<button class="step" id="reverse"></button>');
    document.querySelector('#panel').insertAdjacentHTML('beforeend','<button class="step" id="forward"></button>');

    //replace button content with images
    document.querySelector('#reverse').insertAdjacentHTML('beforeend',"<img src='img/noun-left-arrow.png'>");
    document.querySelector('#forward').insertAdjacentHTML('beforeend',"<img src='img/noun-right-arrow.png'>");

    //Step 5: click listener for buttons
    document.querySelectorAll('.step').forEach(function(step){
        step.addEventListener("click", function(){
            var index = Number(document.querySelector('.range-slider').value);

            //Step 6: increment or decrement depending on button clicked
            if (step.id == 'forward'){
                index++;
                //Step 7: if past the last attribute, wrap around to first attribute
                index = index > attributes.length - 1 ? 0 : index;
            } else if (step.id == 'reverse'){
                index--;
                //Step 7: if past the first attribute, wrap around to last attribute
                index = index < 0 ? attributes.length - 1 : index;
            };

            //Step 8: update slider
            document.querySelector('.range-slider').value = index;
            console.log(index);

            //Step 9: pass new attribute to update symbols
            updatePropSymbols(attributes[index]);
        })
    })

    //Step 5: input listener for slider
    document.querySelector('.range-slider').addEventListener('input', function(){
        //Step 6: get the new index value
        var index = Number(this.value);
        console.log(index);

        //Step 9: pass new attribute to update symbols
        updatePropSymbols(attributes[index]);
    });
};


//Step 2: Import GeoJSON data
function getData(){
    //load the data
    fetch("data/internetUse.geojson")
        .then(function(response){
            return response.json();
        })
        .then(function(json){
            //create an attributes array
            var attributes = processData(json);
            //calculate minimum data value
            minValue = calcMinValue(json);
            //call function to create proportional symbols
            createPropSymbols(json, attributes);
            createSequenceControls(attributes);
        })
};

document.addEventListener('DOMContentLoaded',createMap)

