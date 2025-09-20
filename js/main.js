let userLocation = null;
let currentLanguage = 'en';
let targetBearing = null;
let deviceOrientation = 0;
let compassSupported = false;
let debugInfo = {};
let orientationInitialized = false;

// Event listeners
document.getElementById('countrySelect').addEventListener('change', updateCityOptions);
document.getElementById('citySelect').addEventListener('change', handleCitySelection);

// Initialize
window.addEventListener('load', () => {
    updateUIText();
});

// Clean up sensors when page unloads
window.addEventListener('beforeunload', () => {
    stopAllSensors();
});

// Handle visibility change to pause/resume sensors
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopAllSensors();
    } else {
        // Reinitialize sensors when page becomes visible
        setTimeout(() => {
            initializeDeviceOrientation();
        }, 500);
    }
});