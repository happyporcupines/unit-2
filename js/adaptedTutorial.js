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
function createPopupContent(properties) {
    var popupContent = "";
    if (properties) {
        for (var property in properties) {
            popupContent += "<p>" + property + ": " + properties[property] + "</p>";
        }
    }
    return popupContent;
}

//function to retrieve the data and place it on the map
function getData(map){
    fetch("data/MegaCities.geojson")
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
                fillOpacity: 0.8
            };

            //create a Leaflet GeoJSON layer and add it to the map
            L.geoJson(json, {
                pointToLayer: function (feature, latlng){
                    var layer = L.circleMarker(latlng, geojsonMarkerOptions);
                    layer.bindPopup(createPopupContent(feature.properties));
                    return layer;
                }
            }).addTo(map);
        })
};

document.addEventListener('DOMContentLoaded',createMap)

