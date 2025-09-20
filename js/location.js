function getLocation() {
    const btn = document.getElementById('locationBtn');
    const status = document.getElementById('status');
    const t = translations[currentLanguage];
    
    btn.disabled = true;
    btn.innerHTML = `<span class="loading"></span> ${t.gettingLocation}`;
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                
                btn.disabled = false;
                btn.innerHTML = t.locationUpdated;
                status.textContent = t.statusLocationConfirmed;
                
                // Auto calculate if city is selected
                const citySelect = document.getElementById('citySelect');
                const countrySelect = document.getElementById('countrySelect');
                
                if (citySelect.value) {
                    const [lat, lng] = citySelect.value.split(',').map(Number);
                    const cityName = citySelect.options[citySelect.selectedIndex].textContent;
                    calculateDirection(lat, lng, cityName);
                } else if (countrySelect.value === 'custom') {
                    addCustomLocation();
                }
                
                setTimeout(() => {
                    btn.innerHTML = t.getLocation;
                }, 2000);
            },
            error => {
                btn.disabled = false;
                btn.innerHTML = t.getLocation;
                
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        status.textContent = t.statusLocationDenied;
                        break;
                    case error.POSITION_UNAVAILABLE:
                        status.textContent = t.statusLocationUnavailable;
                        break;
                    case error.TIMEOUT:
                        status.textContent = t.statusLocationTimeout;
                        break;
                    default:
                        status.textContent = t.statusLocationError;
                        break;
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    } else {
        btn.disabled = false;
        btn.innerHTML = t.getLocation;
        status.textContent = t.statusBrowserNotSupported;
    }
}

function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function calculateBearing(lat1, lng1, lat2, lng2) {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
             Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
    
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
}

function calculateDirection(targetLat, targetLng, cityName) {
    if (!userLocation) return;

    const distance = calculateDistance(
        userLocation.lat, userLocation.lng,
        targetLat, targetLng
    );

    const bearing = calculateBearing(
        userLocation.lat, userLocation.lng,
        targetLat, targetLng
    );

    // Store target bearing for compass
    targetBearing = bearing;

    const t = translations[currentLanguage];

    // Update UI
    document.getElementById('targetCity').textContent = cityName;
    document.getElementById('distance').textContent = `${distance.toFixed(0)} km`;
    document.getElementById('bearing').textContent = `${bearing.toFixed(0)}°`;

    // Update target indicator
    updateTargetIndicator();

    const directionText = getDirectionText(bearing);
    document.getElementById('status').textContent = 
        t.statusDirectionInfo(cityName, directionText, distance.toFixed(0));
}

function handleCitySelection() {
    const citySelect = document.getElementById('citySelect');
    const countrySelect = document.getElementById('countrySelect');
    
    if (countrySelect.value === 'custom') {
        return;
    }
    
    if (citySelect.value && userLocation) {
        const [lat, lng] = citySelect.value.split(',').map(Number);
        const cityName = citySelect.options[citySelect.selectedIndex].textContent;
        calculateDirection(lat, lng, cityName);
    }
}

function addCustomLocation() {
    const lat = parseFloat(document.getElementById('customLat').value);
    const lng = parseFloat(document.getElementById('customLng').value);
    const t = translations[currentLanguage];
    
    if (isNaN(lat) || isNaN(lng)) {
        alert('Please enter valid coordinates');
        return;
    }
    
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        alert('Invalid coordinates range');
        return;
    }
    
    // Set custom location as target
    const customName = `Custom (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    document.getElementById('targetCity').textContent = customName;
    
    if (userLocation) {
        calculateDirection(lat, lng, customName);
    }
}