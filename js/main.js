//declare map variable globally so all functions have access
var map;
var metricLayers = {};
var activeMetricFilter = "both";
var baseZoom = 6;
var maxRadiusPx = 40;
var legendBreaks = [0, 10, 25, 50, 75, 100];
//calculate the radius of each proportional symbol
function getZoomScale(){
    return Math.pow(1.5, map.getZoom() - baseZoom);
}
//function to update the year in the legend
function showPanelMessage(message){
    var panel = document.querySelector("#panel");
    if (!panel){
        return;
    }
    panel.innerHTML = "<p>" + message + "</p>";
}
//function to convert markers to circle markers and add popups
function isDataAttribute(propertyName){
    return /^\d{4}_[IP]$/.test(propertyName);
}
// Helper function to construct attribute name for a given year and metric suffix
function getMetricAttribute(year, metricSuffix){
    return year + "_" + metricSuffix;
}
// Helper function to safely get percentage value from properties
function getPercentValue(properties, attribute){
    var value = Number(properties[attribute]);

    if (!isFinite(value) || value < 0){
        return 0;
    }

    return Math.min(value, 100);
}
// Function to extract list of years from GeoJSON data based on attribute naming convention
function getYearList(data){
    var internetYears = [];
    var phoneYears = [];
    // Check if data has features and properties before trying to access them
    if (!data.features || !data.features.length){
        return [];
    }
    // Assume all features have the same set of attributes, so we can just check the first one
    var properties = data.features[0].properties;
    for (var property in properties){
        if (/^\d{4}_I$/.test(property)){
            internetYears.push(property.split("_")[0]);
        } else if (/^\d{4}_P$/.test(property)){
            phoneYears.push(property.split("_")[0]);
        }
    }
    // Get the intersection of years that have both Internet and Phone data
    var phoneYearSet = new Set(phoneYears);
    var years = Array.from(new Set(internetYears)).filter(function(year){
        return phoneYearSet.has(year);
    });
    // Sort years in ascending order
    years.sort(function(a, b){
        return Number(a) - Number(b);
    });

    return years;
}
// Function to check if any of the specified fields have non-NA values for a given feature
function hasNonNAValues(properties){
    var fields = [
        "Use_Maturity",
        "Culture_and_Norms",
        "Renowned_For",
        "Digital_Fun_Fact",
        "Regional_Pattern"
    ];
    // return true if any field has a non-NA, non-empty value
    return fields.some(function(field){
        var value = properties[field];
        return value && value !== "N/A" && value.toString().trim() !== "";
    });
}
// Helper function to format field names into more readable labels
function formatFieldLabel(fieldName){
    return String(fieldName || "").replace(/_/g, " ");
}
// Function to generate HTML content for popups based on feature properties and selected year
function getPopupContent(properties, year){
    var fields = [
        "Use_Maturity",
        "Culture_and_Norms",
        "Renowned_For",
        "Digital_Fun_Fact",
        "Regional_Pattern"
    ];
    // Get country name, Internet users percentage, and mobile subscriptions per 100 people
    var countryName = properties["Country Name"] || "Unknown";
    var internetValue = getPercentValue(properties, getMetricAttribute(year, "I")).toFixed(2);
    var phoneValue = getPercentValue(properties, getMetricAttribute(year, "P")).toFixed(2);
    // Check if any of the additional fields have non-NA values to determine 
    // if we need to create multiple pages in the popup
    var hasValues = hasNonNAValues(properties);
    var pages = [];

    // First page: basic info
    var page1 = "<div class='popup-page popup-page-0' style='display:block;'>";
    page1 += "<h3>" + countryName + "</h3>";
    page1 += "<p><b>Year:</b> " + year + "</p>";
    page1 += "<p><b>Internet users:</b> " + internetValue + "%</p>";
    page1 += "<p><b>Mobile subscriptions:</b> " + phoneValue + " per 100 people</p>";
    page1 += "</div>";
    pages.push(page1);

    // Add pages for each field (only if they have non-NA value)
    if (hasValues){
        fields.forEach(function(field, index){
            var value = properties[field] || "N/A";
            if (value !== "N/A" && value.toString().trim() !== ""){
                var label = formatFieldLabel(field);
                var fieldPage = "<div class='popup-page popup-page-" + (pages.length) + "' style='display:none;'>";
                fieldPage += "<h3>" + countryName + "</h3>";
                fieldPage += "<p><b>" + label + ":</b></p>";
                fieldPage += "<p>" + value + "</p>";
                fieldPage += "</div>";
                pages.push(fieldPage);
            }
        });
    }
    // Combine pages into final popup content, adding slider controls if there are multiple pages
    var popupContent = "<div class='popup-container'>";
    popupContent += pages.join("");

    // Add slider controls only if more than one page
    if (pages.length > 1){
        popupContent += "<div class='popup-controls'>";
        popupContent += "<button class='popup-prev' type='button'>";
        popupContent += "<img src='img/noun-left-arrow.png' alt='Previous'>";
        popupContent += "</button>";
        popupContent += "<span class='popup-page-indicator'>1/" + pages.length + "</span>";
        popupContent += "<button class='popup-next' type='button'>";
        popupContent += "<img src='img/noun-right-arrow.png' alt='Next'>";
        popupContent += "</button>";
        popupContent += "</div>";
    }

    popupContent += "</div>";

    return popupContent;
}

//step 1 create map
function createMap(){

    //create the map
    map = L.map('map', {
        center: [0, 0],
        zoom: 2,
        minZoom: 2,
        maxZoom: 6,
        maxBounds: [[-85, -180], [85, 180]],
        maxBoundsViscosity: 1.0,
        worldCopyJump: false
    });

    //ensure bounds stay enforced on window resize
    window.addEventListener('resize', function() {
        if (map) {
            map.invalidateSize();
        }
    });

    //add OSM base tilelayer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
    }).addTo(map);

    //call getData function
    getData();
};

//calculate the radius of each proportional symbol
function calcPropRadius(attValue) {
    var minVisibleRadiusPx = 2;
    var value = Number(attValue);

    if (!isFinite(value) || value <= 0){
        return 0;
    }

    var normalizedValue = Math.min(value, 100) / 100;
    var baseRadius = Math.max(Math.sqrt(normalizedValue) * maxRadiusPx, minVisibleRadiusPx);
    var zoomScale = getZoomScale();
    return Math.min(baseRadius * zoomScale, maxRadiusPx);
};

//function to update the year in the legend
function updateYearDisplay(year){
    document.querySelector("#selected-year").textContent = year;
}
// Function to create size legend with filter controls
function createSizeLegend(){
    var legend = document.querySelector("#size-legend");
    if (!legend){
        return;
    }

    legend.innerHTML = "" +
        "<div id='filter-controls'></div>" +
        "<div id='legend-content'></div>";

    createFilterControls();
    updateSizeLegend();
}
// Function to create filter controls for toggling metric visibility
function createFilterControls(){
    var filterContainer = document.querySelector("#filter-controls");
    if (!filterContainer){
        return;
    }
    // Create radio buttons for filtering metrics
    var html = "" +
        "<h4 class='filter-title'>Filter Data</h4>" +
        "<div class='filter-box'>" +
            "<label class='filter-option'>" +
                "<input type='radio' name='data-filter' value='both' checked>" +
                "<span>Both</span>" +
            "</label>" +
            "<label class='filter-option'>" +
                "<input type='radio' name='data-filter' value='I'>" +
                "<span>Percentage of Internet Users</span>" +
            "</label>" +
            "<label class='filter-option'>" +
                "<input type='radio' name='data-filter' value='P'>" +
                "<span>Percentage of Mobile Phone Subscribers</span>" +
            "</label>" +
        "</div>";

    filterContainer.innerHTML = html;
    // Add event listeners to radio buttons to update metric visibility
    filterContainer.querySelectorAll("input[name='data-filter']").forEach(function(input){
        input.addEventListener("change", function(event){
            activeMetricFilter = event.target.value;
            setMetricVisibility(activeMetricFilter);
        });
    });
}
// Function to show/hide metric layers based on selected filter
function setMetricVisibility(filterValue){
    ["I", "P"].forEach(function(metricSuffix){
        var layerGroup = metricLayers[metricSuffix];
        if (!layerGroup){
            return;
        }
        // Determine if this metric should be shown based on filter value
        var shouldShow = filterValue === "both" || filterValue === metricSuffix;
        var isVisible = map.hasLayer(layerGroup);

        if (shouldShow && !isVisible){
            map.addLayer(layerGroup);
        } else if (!shouldShow && isVisible){
            map.removeLayer(layerGroup);
        }
    });
    // After changing visibility, update the legend to reflect the active metric
    updateSizeLegend();
}
// Function to get legend configuration based on active metric filter
function getLegendConfig(){
    // Return title and color configuration based on active metric filter
    if (activeMetricFilter === "I"){
        return {
            title: "Legend: Internet Users",
            color: "#1f78b4",
            fill: "rgba(31, 120, 180, 0.12)"
        };
    }
    // Default to phone subscribers if "P" is selected or if filter is "both"
    if (activeMetricFilter === "P"){
        return {
            title: "Legend: Mobile Phone Subscribers",
            color: "#e31a1c",
            fill: "rgba(227, 26, 28, 0.12)"
        };
    }
    // If both metrics are shown, use a neutral color and title
    return {
        title: "Legend: Internet + Mobile",
        color: "#1f78b4",
        fill: "rgba(31, 120, 180, 0.12)"
    };
}
// Function to update size legend based on active metric filter and current zoom level
function updateSizeLegend(){
    var legend = document.querySelector("#legend-content");
    if (!legend){
        return;
    }
    // Get legend configuration based on active metric filter
    var legendConfig = getLegendConfig();
    var title = "<h4>" + legendConfig.title + "</h4>";
    var items = legendBreaks.map(function(value){
        var radius = calcPropRadius(value);
        // For zero value, show a special symbol to indicate no data or zero percentage
        if (value === 0){
            return "<div class='size-legend-item'>" +
                "<div class='size-legend-symbol-wrap'><div class='size-legend-zero' style='background:" + legendConfig.color + ";'></div></div>" +
                "<span class='size-legend-label'>0%</span>" +
            "</div>";
        }
        // For non-zero values, show a circle with the appropriate radius
        var diameter = Math.round(radius * 2);

        return "<div class='size-legend-item'>" +
            "<div class='size-legend-symbol-wrap'>" +
                "<div class='size-legend-circle' style='width:" + diameter + "px;height:" + diameter + "px;border-color:" + legendConfig.color + ";background:" + legendConfig.fill + ";'></div>" +
            "</div>" +
            "<span class='size-legend-label'>" + value + "%</span>" +
        "</div>";
    }).join("");

    legend.innerHTML = title + items;
}

//function to convert markers to circle markers and add popups
function pointToLayer(feature, latlng, year, metricSuffix){
    var attribute = getMetricAttribute(year, metricSuffix);
    var isInternet = metricSuffix === "I";
    var shouldHighlight = hasNonNAValues(feature.properties);
    // Define styling options for the circle marker based on metric type and whether it has additional info
    var options = {
        fillColor: isInternet ? "#1f78b4" : "#e31a1c",
        color: isInternet ? "#1f78b4" : "#e31a1c",
        weight: shouldHighlight ? 4 : 1,
        opacity: shouldHighlight ? 0.9 : 0.5,
        dashArray: shouldHighlight ? "6 4" : null,
        fillOpacity: 0.12
    };
    // Calculate radius based on attribute value and current zoom level
    var attValue = getPercentValue(feature.properties, attribute);
    options.radius = calcPropRadius(attValue);
    // Create the circle marker layer and bind popup content
    var layer = L.circleMarker(latlng, options);
    layer.attribute = attribute;
    layer.feature = feature;
    // Generate popup content based on feature properties and selected year
    var popupContent = getPopupContent(feature.properties, year);
    // Bind popup to the layer with an offset to position it above the circle marker
    layer.bindPopup(popupContent, {
        offset: new L.Point(0, -options.radius)
    });

    // Install popup event handler for slider navigation
    layer.on('popupopen', function(){
        setupPopupSlider(layer.getPopup());
    });

    return layer;
};
// Function to set up slider controls within popups for navigating multiple pages of content
function setupPopupSlider(popup){
    var container = popup.getElement();
    if (!container){
        return;
    }
    // Find slider controls and page elements within the popup
    var prevBtn = container.querySelector('.popup-prev');
    var nextBtn = container.querySelector('.popup-next');
    var pages = container.querySelectorAll('.popup-page');
    var indicator = container.querySelector('.popup-page-indicator');
    //  If there are no slider controls or pages, we don't need to set up the slider functionality
    if (!prevBtn || !nextBtn || pages.length === 0){
        return;
    }
    // Initialize current page index and show the first page
    var currentPage = 0;
    // Function to show a specific page in the popup and update the page indicator
    function showPage(pageNum){
        pages.forEach(function(page){
            page.style.display = 'none';
        });
        pages[pageNum].style.display = 'block';
        if (indicator){
            indicator.textContent = (pageNum + 1) + "/" + pages.length;
        }
        currentPage = pageNum;
    }
    // Add event listeners to the previous and next buttons to navigate through pages
    prevBtn.addEventListener('click', function(e){
        e.stopPropagation();
        var newPage = currentPage - 1;
        if (newPage < 0){
            newPage = pages.length - 1;
        }
        showPage(newPage);
    });
    // Add event listener to the next button to navigate to the next page, 
    // wrapping around to the first page if at the end
    nextBtn.addEventListener('click', function(e){
        e.stopPropagation();
        var newPage = currentPage + 1;
        if (newPage >= pages.length){
            newPage = 0;
        }
        showPage(newPage);
    });
}

//Step 3: Add circle markers for point features to the map
function createPropSymbols(data, year){
    // Create separate layer groups for Internet and Phone metrics
    metricLayers.I = L.geoJson(data, {
        filter: function(feature){
            return !!(feature && feature.geometry && feature.geometry.type === "Point");
        },
        pointToLayer: function(feature, latlng){
            return pointToLayer(feature, latlng, year, "I");
        }
    }).addTo(map);
    // Create separate layer groups for Internet and Phone metrics
    metricLayers.P = L.geoJson(data, {
        filter: function(feature){
            return !!(feature && feature.geometry && feature.geometry.type === "Point");
        },
        pointToLayer: function(feature, latlng){
            return pointToLayer(feature, latlng, year, "P");
        }
    }).addTo(map);
    // Initially set visibility of layers based on active metric filter
    setMetricVisibility(activeMetricFilter);
    // Add event listener to resize circles when zooming the map
    map.on('zoomend', function(){
        resizeCirclesForZoom();
        updateSizeLegend();
    });
};
// Function to resize circle markers based on current zoom level to maintain proportional appearance
function resizeCirclesForZoom(){
    // Loop through each metric layer group and update the radius of each circle marker 
    // based on the current zoom level
    ["I", "P"].forEach(function(metricSuffix){
        var layerGroup = metricLayers[metricSuffix];
        if (!layerGroup){
            return;
        }
        // For each layer in the group, recalculate the radius based on the attribute value
        // and current zoom scale
        layerGroup.eachLayer(function(layer){
            if (!layer.feature){
                return;
            }
            // Get the attribute value for the current layer and calculate the new radius
            var attValue = getPercentValue(layer.feature.properties, layer.attribute);
            var newRadius = calcPropRadius(attValue);
            layer.setRadius(newRadius);
            // Update the popup offset to match the new radius so that it stays positioned 
            // above the circle marker
            var popup = layer.getPopup();
            if (popup && popup.options){
                popup.options.offset = new L.Point(0, -newRadius);
            }
        });
    });
}

//Step 10: Resize proportional symbols according to new attribute values
function updatePropSymbols(year){
    updateYearDisplay(year);
    // Loop through each metric layer group and update the radius and popup content 
    // for each circle marker
    ["I", "P"].forEach(function(metricSuffix){
        var layerGroup = metricLayers[metricSuffix];
        var attribute = getMetricAttribute(year, metricSuffix);
        // If the layer group doesn't exist (which shouldn't happen), skip to the next one
        if (!layerGroup){
            return;
        }
        // For each layer in the group, update the radius based on the new attribute value and
        // update the popup content to reflect the new year and metric values
        layerGroup.eachLayer(function(layer){
            if (!layer.feature){
                return;
            }
            // Get the properties of the feature associated with this layer and calculate the new radius
            var props = layer.feature.properties;
            layer.attribute = attribute;
            var radius = calcPropRadius(getPercentValue(props, attribute));
            layer.setRadius(radius);
            // Update the popup content with the new year and metric values
            var popup = layer.getPopup();
            var newContent = getPopupContent(props, year);
            popup.setContent(newContent);
            popup.options.offset = new L.Point(0, -radius);
            
            // If popup is open, re-setup the slider controls
            if (popup._map){
                setTimeout(function(){
                    setupPopupSlider(popup);
                }, 0);
            }
        });
    });
};

//Step 1: Create new sequence controls
function createSequenceControls(years){
    document.querySelector("#panel").innerHTML = "";
    // Create HTML for slider controls and insert it into the panel
    var controls = "<div class='slider-controls-row'>" +
        "<div class='slider-main-controls'>" +
            "<button class='step' id='reverse'></button>" +
            "<input class='range-slider' type='range'></input>" +
            "<button class='step' id='forward'></button>" +
        "</div>" +
        "<p class='slider-note'>Zoom in to explore a region you're interested in!</p>" +
    "</div>";
    document.querySelector("#panel").insertAdjacentHTML('beforeend', controls);
    // Configure the range slider with min, max, step, and initial value based on the 
    // number of years available
    document.querySelector(".range-slider").max = years.length - 1;
    document.querySelector(".range-slider").min = 0;
    document.querySelector(".range-slider").value = 0;
    document.querySelector(".range-slider").step = 1;
    // Add arrow icons to the forward and reverse buttons
    document.querySelector('#reverse').insertAdjacentHTML('beforeend',"<img src='img/noun-left-arrow.png'>");
    document.querySelector('#forward').insertAdjacentHTML('beforeend',"<img src='img/noun-right-arrow.png'>");
    // Initially display the first year in the legend
    updateYearDisplay(years[0]);
    // Add event listeners to the forward and reverse buttons to update the slider value and
    // update the proportional symbols when clicked
    document.querySelectorAll('.step').forEach(function(step){
        step.addEventListener("click", function(){
            var index = Number(document.querySelector('.range-slider').value);
            // Update the index based on which button was clicked, wrapping around if necessary
            if (step.id == 'forward'){
                index++;
                index = index > years.length - 1 ? 0 : index;
            } else if (step.id == 'reverse'){
                index--;
                index = index < 0 ? years.length - 1 : index;
            }
            // Update the slider value to match the new index and update the proportional symbols for the new year
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
    showPanelMessage("Loading data...");
    // Use fetch API to load the GeoJSON data, with error handling for network issues and data parsing
    fetch("data/Digital_Country_Data.geojson")
        // Check if the response is OK (status code 200-299), and throw an error if not
        .then(function(response){
            if (!response.ok){
                throw new Error("HTTP " + response.status + " loading Digital_Country_Data.geojson");
            }
            return response.text();
        })
        // Sanitize the raw text to replace any occurrences of NaN or Infinity with null before parsing as JSON
        .then(function(rawText){
            var sanitizedText = rawText
                .replace(/\bNaN\b/g, "null")
                .replace(/\bInfinity\b/g, "null")
                .replace(/\b-Infinity\b/g, "null");

            return JSON.parse(sanitizedText);
        })
        // After successfully loading and parsing the data, extract the list of years available in the dataset and initialize
        //  the proportional symbols and controls
        .then(function(json){
            var years = getYearList(json);

            if (!years.length){
                throw new Error("No time-series attributes found in Digital_Country_Data.geojson");
            }

            createPropSymbols(json, years[0]);
            createSequenceControls(years);
            createSizeLegend();
        })
        // Catch any errors that occur during the fetch, parsing, or initialization process and display 
        // an appropriate error message to the user
        .catch(function(error){
            console.error("Error loading proportional symbol data:", error);

            if (window.location.protocol === "file:"){
                showPanelMessage("Data load failed on file://. Run a local server and open http://127.0.0.1:8000/index.html");
            } else {
                showPanelMessage("Data load failed: " + error.message);
            }
        });
};
// Call the createMap function once the DOM content has fully loaded to ensure that the map container is available
document.addEventListener('DOMContentLoaded',createMap)

