// initialize the view set at London at an appropriate zoom level
var map = L.map('map').setView([51.505, -0.09], 13);
// L.map creates a new map object based on the input parameters
// adding open street map tile layer
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);
// the addTo method is self-explanatory, it adds the layer to the map or layer group
// adding a marker
var marker = L.marker([51.5, -0.09]).addTo(map);
// adding a circle
var circle = L.circle([51.508, -0.11], {
    color: 'red',
    fillColor: '#f03',
    fillOpacity: 0.5,
    radius: 500
}).addTo(map);
// the addTo method is self-explanatory, it adds the layer to the map or layer group
// adding a polygon
var polygon = L.polygon([
    [51.509, -0.08],
    [51.503, -0.06],
    [51.51, -0.047]
]).addTo(map);
// the addTo method is self-explanatory, it adds the layer to the map or layer group
// adding a popup
marker.bindPopup("<b>Hello world!</b><br>I am a popup.").openPopup()
// openPopup makes sure that only one popup opens at a time
// bindPopup attaches a popup message to a feature
circle.bindPopup("I am a circle.");
polygon.bindPopup("I am a polygon.");
// adding a popup layer
var popup = L.popup()
    .setLatLng([51.513, -0.09])
    // setLatLng puts the marker at a particular lat/long point
    .setContent("I am a standalone popup.")
    // setContent lets you put HTML content within a popup or tooltip
    .openOn(map);
    //openOn specifies where the HTML content overlay should be displayed (AKA the map)
// add user interaction alert
var popup = L.popup();

function onMapClick(e) {
    popup
        .setLatLng(e.latlng)
        // setLatLng puts the marker at a particular lat/long point
        .setContent("You clicked the map at " + e.latlng.toString())
        // setContent lets you put HTML content within a popup or tooltip
        .openOn(map);
        //openOn specifies where the HTML content overlay should be displayed (AKA the map)
}

map.on('click', onMapClick);

