function changeLanguage(lang) {
    currentLanguage = lang;
    
    // Update active language button
    document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    updateUIText();
}

function updateUIText() {
    const t = translations[currentLanguage];
    
    document.getElementById('title').textContent = t.title;
    document.getElementById('label-destination').textContent = t.destination;
    document.getElementById('label-distance').textContent = t.distance;
    document.getElementById('label-direction').textContent = t.direction;
    document.getElementById('locationBtn').textContent = t.getLocation;
    document.getElementById('sensorsBtn').textContent = t.activateSensors;
    document.getElementById('status').textContent = t.statusInitial;
    document.getElementById('addCustomBtn').textContent = t.addCustom;
    document.getElementById('customLat').placeholder = t.latPlaceholder;
    document.getElementById('customLng').placeholder = t.lngPlaceholder;
    
    // Update compass directions
    document.getElementById('compass-n').textContent = t.directions[0];
    document.getElementById('compass-e').textContent = t.directions[4];
    document.getElementById('compass-s').textContent = t.directions[8];
    document.getElementById('compass-w').textContent = t.directions[12];
    
    // Update sensor status
    updateSensorStatus(compassSupported);
    
    // Update selects
    updateCountryOptions();
    
    if (!document.getElementById('countrySelect').value) {
        document.getElementById('targetCity').textContent = t.selectCityPrompt;
    }
}

function updateCountryOptions() {
    const t = translations[currentLanguage];
    const countrySelect = document.getElementById('countrySelect');
    const currentValue = countrySelect.value;
    
    countrySelect.innerHTML = `<option value="">${t.selectCountry}</option>`;
    
    Object.keys(countries).forEach(country => {
        const option = document.createElement('option');
        option.value = country;
        option.textContent = country;
        countrySelect.appendChild(option);
    });
    
    // Add custom location option
    const customOption = document.createElement('option');
    customOption.value = 'custom';
    customOption.textContent = '📍 Custom Location';
    countrySelect.appendChild(customOption);
    
    if (currentValue) {
        countrySelect.value = currentValue;
        updateCityOptions();
    }
}

function updateCityOptions() {
    const countrySelect = document.getElementById('countrySelect');
    const citySelect = document.getElementById('citySelect');
    const customLocation = document.getElementById('customLocation');
    const t = translations[currentLanguage];
    
    citySelect.innerHTML = `<option value="">${t.selectCity}</option>`;
    citySelect.disabled = true;
    customLocation.classList.remove('show');
    
    if (countrySelect.value === 'custom') {
        customLocation.classList.add('show');
        return;
    }
    
    if (countrySelect.value && countries[countrySelect.value]) {
        citySelect.disabled = false;
        const cities = countries[countrySelect.value];
        
        Object.keys(cities).forEach(city => {
            const option = document.createElement('option');
            option.value = `${cities[city][0]},${cities[city][1]}`;
            option.textContent = city;
            citySelect.appendChild(option);
        });
    }
}

function getDirectionText(bearing) {
    const t = translations[currentLanguage];
    const index = Math.round(bearing / 22.5) % 16;
    return t.directionsText[index];
}

function toggleDebugPanel() {
    const debugPanel = document.getElementById('debug-panel');
    if (debugPanel.style.display === 'none') {
        debugPanel.style.display = 'block';
    } else {
        debugPanel.style.display = 'none';
    }
}