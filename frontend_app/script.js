// config and constants
let CONFIG = {
  MAX_RECORDS: 400,
  PAGE_SIZE: 100,
  MAP_CENTER: [40.7128, -74.0060], //Centered on NYC
  MAP_ZOOM: 11,
  TILE_LAYER_URL: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  TILE_LAYER_ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  MARKER_ICONS: {
    red: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    green: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
    shadow: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
  }
};

let allVotingLocations = [];
let currentMarkers = [];

//Leaflet map initialization
const map = L.map('map').setView(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM);

L.tileLayer(CONFIG.TILE_LAYER_URL, {
  attribution: CONFIG.TILE_LAYER_ATTRIBUTION,
  subdomains: 'abcd',
  maxZoom: 20
}).addTo(map);

//Marker icons 
const redIcon = new L.Icon({
  iconUrl: CONFIG.MARKER_ICONS.red,
  shadowUrl: CONFIG.MARKER_ICONS.shadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const greenIcon = new L.Icon({
  iconUrl: CONFIG.MARKER_ICONS.green,
  shadowUrl: CONFIG.MARKER_ICONS.shadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

/**
 * Decodes the geocode cache string from Airtable to extract latitude and longitude.
 * @param {string} cacheStr - The base64 encoded geocode cache string.
 * @returns {number[]|null} An array [latitude, longitude] or null.
 */
function decodeGeocodeCache(cacheStr){
  try{
    const cleaned = cacheStr.trim().replace(/^[^\w\/+=]+/, '');
    const jsonStr = atob(cleaned);
    const parsed = JSON.parse(jsonStr);
    const { o: { lat, lng } = {} } = parsed;

    if(typeof lat == 'number' && typeof lng == 'number'){
      return [lat, lng];
    } else{
      console.warn("Latitude or longitude missing in geocode cache:", parsed);
      return null;
    }
  } catch(error){
    console.error(`Error decoding geocode cache: ${error}`);
    return null;
  }
}

/**
 * Geocodes an address via the backend proxy.
 * @param {string} address - The address string to geocode.
 * @returns {<{lat: number, lng: number}|null>} A promise that resolves to the coordinates or null on failure.
 */
async function geocodeAddress(address) {
  try {
    const response = await fetch(`/api/GeocodeAddress?address=${encodeURIComponent(address)}`);
    if (!response.ok) {
      throw new Error(`Geocoding proxy error: ${response.status}`);
    }
    const data = await response.json();
    console.log(`Input: (${data.lat},${data.lng})`);
    return data;
  } catch (error) {
    console.error("Error geocoding address:", error);
    return null;
  }
}

function normalizeHours(hours) {
  return hours
    .toLowerCase()
    .replace(/\s*/g, '')
    .split('-')
    .map(time => {
      const match = time.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
      if (!match) return time;
      let [_, hour, minute, period] = match;
      minute = minute || '00';
      return `${hour}:${minute}${period}`;
    })
    .join(' - ');
}



/**
 * Formats a comma separated string of hours for days of the week into a dictionary
 * where keys are hours and values are arrays of day names.
 * @param {string} hoursString - A comma-separated string of hours.
 * @returns {Object.<string, string[]>} A dictionary mapping hours to day names.
 */
function formatDaysOfWeekHours(hoursString){
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const hoursDict = {};
  hoursString.split(",").forEach((hours, index) => {
    const key = normalizeHours(hours);
    if(!hoursDict[key]) hoursDict[key] = [];
    hoursDict[key].push(index);
  });

  for(const hours in hoursDict){
    const days = hoursDict[hours];
    if(isConsecutiveArray(days)){
      hoursDict[hours] = [`${dayNames[days[0]]} - ${dayNames[days[days.length - 1]]}`];
    }else{
      hoursDict[hours] = days.map(day => dayNames[day]);
    }
  }
  return hoursDict;
}

/**
 * Helper function to check if an array of day indices are consecutive.
 * Used when grouping days of the week.
 * @param {number[]} arr - Array of integers representing days of the week
 * @returns {boolean} True if the days are consecutive and at least 3 in a row, false otherwise.
 */
function isConsecutiveArray(arr) {
  if (arr.length <= 2) return false;
  let first = arr[0];
  let last = arr[arr.length - 1];
  return (last - first + 1) == arr.length;
}

function renderLocations(records){
  const locationsDiv = document.getElementById('locations');
  const countDiv = document.getElementById('location-count');

  currentMarkers.forEach(marker => map.removeLayer(marker));
  currentMarkers = [];

  if(countDiv){
    const countText = (records.length == 1)
      ? `Found ${records.length} location`
      : `Found ${records.length} locations`; //ternary is a bit easier than replacing
    countDiv.textContent = countText;
    announceToScreenReader(countText);
  }

  //if no records are found
  if(records.length == 0){
    if(locationsDiv){
      locationsDiv.innerHTML = `<p class="p-4 text-center text-muted">No locations found matching your criteria.</p>`;
    }
    announceToScreenReader("No locations found matching your criteria.");
    return;
  }

  let htmlContent = '';

  //build the card content
  for(const record of records){
    const fields = record.fields;
    const isCommunityEvent = fields['Category'] == 'Community Event';


    const typeTag = isCommunityEvent
      ? `<span class="badge bg-danger text-white">Community Voting Event</span>`
      : `<span class="badge bg-success text-white">Voting Site</span>`;

    let dateInfo = '';
    if(isCommunityEvent && fields['Date and Time']){
      const startDate = new Date(fields['Date and Time']);
      const endDate = fields['End Time'] ? new Date(fields['End Time']) : null;

      const formattedDate = startDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
      const formattedStartTime = startDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
      const formattedEndTime = endDate ? endDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true }) : '';

      dateInfo = `<p><strong>Date:</strong> ${formattedDate}</p>
                  <p><strong>Time:</strong> ${formattedStartTime} ${formattedEndTime ? `- ${formattedEndTime}` : ''}</p>
                  <p class="text-sm text-muted">(One-time event)</p>`;      
    } else if (!isCommunityEvent) {
      let hoursContent = "";
      const csOpenHours = fields['CS Open Hours'] || "";
      const hoursDict = formatDaysOfWeekHours(csOpenHours);

      for(const hours in hoursDict){
        const days = hoursDict[hours].join(", ");
        const hoursHTML = (hours == "none") ? "Closed" : hours;
        hoursContent += `<p><strong>${days}</strong>: ${hoursHTML}</p>`;
      }

      dateInfo = `<p><strong>Open Hours:</strong></p>
                  <p>${hoursContent}</p>
                  <p class="text-sm text-muted">(Open during specified voting periods)</p>`;    
    }

    const locationName = fields['Name of Voting Location or Voting Event'] || "No name provided";
    const addressText = fields['Address Formatted'] || "No address provided";

    htmlContent += `<div class="location text-wrap text-break" role="region" tabindex="0" id="location-${record.id}">
      ${typeTag}
      <h3 class="notranslate">${locationName}</h3>
      <p><strong>Address: </strong><span class="notranslate">${addressText}</span></p>
      ${dateInfo}
    </div>`;

    //Add markers to the map
    const coords = decodeGeocodeCache(fields['Geocode Cache (For Maps Extension)']);
    if(coords){
      const iconToUse = isCommunityEvent ? redIcon : greenIcon;
      const marker = L.marker(coords, { icon: iconToUse }).addTo(map)
        .bindPopup(`<strong>${locationName}</strong><br>${addressText}`);

      currentMarkers.push(marker);

      marker.on('popupopen', () => {
        const card = document.getElementById(`location-${record.id}`);
        if(card){
          card.focus();
          card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
  }

  if(locationsDiv){
    locationsDiv.innerHTML = htmlContent;
  }
}

/**
 * Applies filters based on user input and re-renders the locations.
 */
async function filterAndDisplayLocations(){
  const boroughFilter = document.getElementById('borough-filter').value;
  const zipcodeFilter = document.getElementById('zipcode-filter').value;
  const addressFilter = document.getElementById('address-filter').value;
  const typeFilter = document.querySelector('input[name="type-filter"]:checked')?.value || "";
  const dateFilterStart = document.getElementById('date-filter-start').value;
  const dateFilterEnd = document.getElementById('date-filter-end').value;

  
  let filteredRecords = allVotingLocations; //copy all the voting locations

  //Apply all active filters to the records and pass the filtered results to renderLocations

  if(boroughFilter){
    filteredRecords = filteredRecords.filter(record => record.fields['Borough'] == boroughFilter);
  }

  if(typeFilter){
    filteredRecords = filteredRecords.filter(record => {
      return (typeFilter == 'dedicated') ? 
      (record.fields['Category'] != 'Community Event') : 
      (record.fields['Category'] == 'Community Event');
    });
  }

  if(dateFilterStart && dateFilterEnd){
    const startDateObj = new Date(dateFilterStart);
    startDateObj.setUTCHours(0, 0, 0, 0);

    const endDateObj = new Date(dateFilterEnd);
    endDateObj.setUTCHours(23, 59, 59, 999);

    filteredRecords = filteredRecords.filter(record => {
      if(record.fields['Category'] == 'Community Event' && record.fields['Date and Time']){
        const eventDateObj = new Date(record.fields['Date and Time']);
        eventDateObj.setUTCHours(0, 0, 0, 0);
        return eventDateObj >= startDateObj && eventDateObj <= endDateObj;
      }
      return record.fields['Category'] != 'Community Event';
    });
  }

  if(zipcodeFilter){
    const targetZip = parseInt(zipcodeFilter, 10);
    if(!isNaN(targetZip)){
      filteredRecords = filteredRecords.map(record => ({
        record,
        distance: Math.abs(targetZip - (record.fields['Zip Code'] || 0))
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10)
      .map(item => item.record);
    }
  }

  if(addressFilter){
    try {
      const inputCoor = await geocodeAddress(addressFilter);
      if(inputCoor){
        const recordsWithDistances = await Promise.all(
          filteredRecords.map(async record => {
            const recordCoor = decodeGeocodeCache(record.fields['Geocode Cache (For Maps Extension)']);
            if(recordCoor){
              const distance = haversineFunction(inputCoor.lng, recordCoor[1], inputCoor.lat, recordCoor[0]);
              return{ record, distance };
            }
            return { record, distance: Infinity }; // Handle records with no coordinates
          })
        );
        filteredRecords = recordsWithDistances
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 10)
          .map(item => item.record);
      }else{
        console.error("Could not geocode the input address.");
      }
    }catch(error){
      console.error("Error during address geocoding:", error);
    }
  }

  renderLocations(filteredRecords);
//  document.getElementById('locations').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function fetchAllLocations(){
  const locationsDiv = document.getElementById('locations');
  if(locationsDiv){
    locationsDiv.innerHTML = `
    <div class="d-flex justify-content-center">
  <div class="spinner-border text-primary" role="status">
    <span class="visually-hidden">Loading...</span>
  </div>
</div>
`;
  }
  try{
    const response = await fetch(`/api/GetAirtableData`);
    if(!response.ok){
      const errorData = await response.json();
      throw new Error(`Airtable API proxy error: ${response.status} - ${errorData.error.message || response.statusText}`);
    }

    const data = await response.json();
    allVotingLocations = data;
    filterAndDisplayLocations();
  } catch(error){
    console.error("Failed to fetch locations via backend:", error);
    if(locationsDiv){
      locationsDiv.innerHTML = `<p role="alert" class="text-danger p-4">Failed to load voting locations. Please check your network connection or try again later.</p>`;
    }
  }
}

function announceToScreenReader(message) {
  const statusDiv = document.getElementById("statusMessage");
  statusDiv.textContent = "";
  statusDiv.textContent = message;
}

document.addEventListener('DOMContentLoaded', () => {
  const locationFilterType = document.getElementById('location-filter-type');
  const boroughInput = document.getElementById('borough-input');
  const zipInput = document.getElementById('zip-input');
  const addressInput = document.getElementById('address-input');
  const boroughFilter = document.getElementById('borough-filter');
  const zipcodeFilter = document.getElementById('zipcode-filter');
  const addressFilter = document.getElementById('address-filter');
  const dateFilterStart = document.getElementById('date-filter-start');
  const dateFilterEnd = document.getElementById('date-filter-end');

  function toggleLocationFilter(){
    const selected = locationFilterType.value;
    boroughFilter.value = ''; 
    zipcodeFilter.value = '';
    addressFilter.value = '';

    boroughInput.style.display = (selected == 'borough') ? 'block' : 'none';
    zipInput.style.display = (selected == 'zip') ? 'block' : 'none';
    addressInput.style.display = (selected == 'address') ? 'block' : 'none';
  }

  locationFilterType.addEventListener('change', toggleLocationFilter);
  toggleLocationFilter(); 

  const today = new Date();
  const todayISO = today.toISOString().split('T')[0];
  dateFilterStart.value = todayISO;
  dateFilterEnd.value = todayISO;

  fetchAllLocations();

  document.getElementById('apply-filters-btn').addEventListener('click', filterAndDisplayLocations);
  document.getElementById('select-language').addEventListener('click',toggleTranslate)
  googleTranslateElementInit();
});

function googleTranslateElementInit() {
  new google.translate.TranslateElement({
    pageLanguage: 'en', 
    includedLanguages: 'es,zh-CN,ar,ru,en', 
    layout: google.translate.TranslateElement.InlineLayout.SIMPLE
  }, 'google_translate_element');

  document.getElementById('google_translate_element').style.display = 'none';
}

function toggleTranslate(){
  const translate_elem = document.getElementById('google_translate_element');
  if(translate_elem.style.display == 'none'){
    translate_elem.style.display = 'block';
  }else{
    translate_elem.style.display = 'none';
  }
}

/**
 * @param {Number} lambda1 longitude of first coordinate 
 * @param {Number} lambda2 longitude of second coordinate  
 * @param {Number} phi1 latidude of first coodrinate
 * @param {Number} phi2 latidude of the second coordinate
 * 
 * @returns {Number} Distance between the two coordinates on a sphere of raidus 6378 units
 */
function haversineFunction(lambda1, lambda2, phi1, phi2){
  const undefinedVars = [];
  if (lambda1 == undefined) undefinedVars.push('lambda1');
  if (lambda2 == undefined) undefinedVars.push('lambda2');
  if (phi1 == undefined) undefinedVars.push('phi1');
  if (phi2 == undefined) undefinedVars.push('phi2');

  if (undefinedVars.length > 0) {
    console.error("Undefined input(s):", undefinedVars.join(', '));
    throw new Error("All input coordinates must be defined");
  }

  const deltaLambda = lambda2 - lambda1;
  const deltaPhi = phi2 - phi1;
  const r = 6378; // radius of the earth in km

  const num = 1 - Math.cos(deltaPhi) + (Math.cos(phi1) * Math.cos(phi2) * (1 - Math.cos(deltaLambda)));
  const den = 2;
  const asin = Math.sqrt(num / den);
  let d = 2 * Math.asin(asin);
  return d;
}
