function activateSensors() {
    if (!orientationInitialized) {
        initializeCompass();
        initializeDeviceOrientation();
        orientationInitialized = true;
    }
}

// Initialize compass with degree marks
function initializeCompass() {
    const compassRing = document.getElementById('compassRing');
    
    // Create degree marks
    for (let i = 0; i < 360; i += 6) {
        const mark = document.createElement('div');
        mark.className = i % 30 === 0 ? 'degree-mark major' : 'degree-mark minor';
        mark.style.transform = `translateX(-50%) rotate(${i}deg)`;
        compassRing.appendChild(mark);
    }
}

// Sensor variables
let absoluteOrientationSensor = null;
let relativeOrientationSensor = null;
let magnetometer = null;
let gyroscope = null;
let accelerometer = null;
let sensorType = 'none';
let useMotion = false;
let lastMotionTimestamp = null;
let orientationAlpha;
let smoothedOrientation = 0;


// Device detection
function detectDeviceType() {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const isTablet = /ipad|android(?!.*mobile)/i.test(userAgent);
    let deviceType;

    if (isMobile && !isTablet) {
        deviceType = 'mobile';
    } else if (isTablet) {
        deviceType = 'tablet';
    } else {
        deviceType = 'desktop';
    }
    
    return deviceType;
}

// Check if device likely has compass/gyro sensors
function hasCompassCapability() {
    const type = detectDeviceType();
    return type === 'mobile' || type === 'tablet';
}

function setDeviceOrientation(newOrientation) {
    deviceOrientation = newOrientation;

    const smoothingFactor = 0.1;
    let diff = deviceOrientation - smoothedOrientation;

    // Handle wrap-around for circular values
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    smoothedOrientation += diff * smoothingFactor;
    smoothedOrientation %= 360;
    if (smoothedOrientation < 0) smoothedOrientation += 360;

    updateCompassRotation();
}

// Device orientation handling with Generic Sensor API
function initializeDeviceOrientation() {
    detectDeviceType();
    
    if (!hasCompassCapability()) {
        updateSensorStatus(false, 'No compass sensors (Desktop/Laptop)', 'Compass sensors are not available on desktop/laptop devices. This feature works on smartphones and tablets.');
        return;
    }
    
    updateSensorStatus(false, 'Initializing sensors...', 'Detecting available sensors...');
    
    if (tryGenericSensorAPI()) {
        return;
    }
    
    // Fallback to legacy DeviceOrientation/DeviceMotionEvent
    if ('DeviceOrientationEvent' in window && typeof DeviceOrientationEvent.requestPermission === 'function') {
        Promise.all([
            DeviceOrientationEvent.requestPermission(),
            DeviceMotionEvent.requestPermission()
        ]).then(responses => {
            const orientationGranted = responses[0] === 'granted';
            const motionGranted = responses[1] === 'granted';

            if (orientationGranted) {
                startDeviceOrientationCompass(motionGranted);
            } else {
                updateSensorStatus(false, 'Permission denied', 'Compass permission was denied.');
            }
        }).catch(error => {
            updateSensorStatus(false, 'Permission error', `Failed to request sensor permission: ${error.message}`);
        });
    } else {
        // For Android and older iOS devices that don't need explicit permission requests
        startDeviceOrientationCompass(true);
    }
}

function tryGenericSensorAPI() {
    // Check if Generic Sensor API is supported
    if (!('AbsoluteOrientationSensor' in window)) {
        console.log('Generic Sensor API not supported');
        updateSensorStatus(false, 'Generic Sensor API not supported', 'Modern sensor APIs are not available in this browser. Trying legacy sensors...');
        return false;
    }

    try {
        // Try AbsoluteOrientationSensor first (most accurate)
        startAbsoluteOrientationSensor();
        return true;
    } catch (error) {
        console.log('AbsoluteOrientationSensor failed:', error);
        updateSensorStatus(false, 'AbsoluteOrientation failed', `AbsoluteOrientationSensor error: ${error.message}. Trying alternative sensors...`);
        
        try {
            // Try Magnetometer + Gyroscope combination
            startMagnetometerGyroscope();
            return true;
        } catch (error2) {
            console.log('Magnetometer/Gyroscope failed:', error2);
            updateSensorStatus(false, 'Magnetometer/Gyroscope failed', `Sensor combination failed: ${error2.message}. Trying legacy fallback...`);
            return false;
        }
    }
}

function startAbsoluteOrientationSensor() {
    absoluteOrientationSensor = new AbsoluteOrientationSensor({ 
        frequency: 60,
        referenceFrame: 'screen' // Use screen coordinates
    });

    absoluteOrientationSensor.onerror = (event) => {
        console.log('AbsoluteOrientationSensor error:', event.error);
        const errorMsg = event.error.name === 'NotAllowedError' ? 
            'Sensor permission denied' : 
            event.error.name === 'NotReadableError' ? 
            'Sensor not readable (may not exist)' : 
            `Sensor error: ${event.error.name}`;
        
        updateSensorStatus(false, 'Orientation sensor error', `${errorMsg}. Trying fallback sensors...`);
        
        // Try fallback
        tryMagnetometerGyroscope();
    };

    absoluteOrientationSensor.onreading = () => {
        // Get rotation matrix
        let rotationMatrix = new Float32Array(16);
        absoluteOrientationSensor.populateMatrix(rotationMatrix);
        
        // Extract yaw (rotation around Z-axis) for compass heading
        const yaw = Math.atan2(rotationMatrix[1], rotationMatrix[0]) * 180 / Math.PI;
        const newOrientation = (360 - yaw) % 360;
        setDeviceOrientation(newOrientation);

        Object.assign(debugInfo, {
            source: 'AbsoluteOrientationSensor',
            yaw: yaw,
            deviceOrientation: newOrientation,
            quaternion: absoluteOrientationSensor.quaternion
        });
        updateDebugInfo();
    };

    absoluteOrientationSensor.start();
    sensorType = 'AbsoluteOrientation';
    updateSensorStatus(true, 'AbsoluteOrientation sensor active', `High precision orientation sensor is working. Device: ${detectDeviceType()}`);
}

function startMagnetometerGyroscope() {
    let magHeading;
    let lastTimestamp = null;

    // Initialize magnetometer for compass heading
    if ('Magnetometer' in window) {
        magnetometer = new Magnetometer({
            frequency: 60,
            referenceFrame: 'screen'
        });

        magnetometer.onerror = (event) => {
            console.log('Magnetometer error:', event.error);
            const errorMsg = event.error.name === 'NotAllowedError' ?
                'Magnetometer permission denied' :
                event.error.name === 'NotReadableError' ?
                'Magnetometer not available' :
                `Magnetometer error: ${event.error.name}`;
            
            updateSensorStatus(false, 'Magnetometer error', `${errorMsg}. Trying legacy fallback...`);
        };

        magnetometer.onreading = () => {
            // Calculate compass heading from magnetometer
            magHeading = Math.atan2(magnetometer.y, magnetometer.x) * 180 / Math.PI;
            magHeading = (360 + magHeading) % 360;

            // If not using gyro, or if gyro hasn't started, update directly
            if (!gyroscope || lastTimestamp === null) {
                setDeviceOrientation(magHeading);
            }

            Object.assign(debugInfo, {
                source_mag: 'Magnetometer',
                mag_x: magnetometer.x,
                mag_y: magnetometer.y,
                mag_z: magnetometer.z,
                magHeading: magHeading
            });
            updateDebugInfo();
        };

        magnetometer.start();
        sensorType = 'Magnetometer';
        updateSensorStatus(true, 'Magnetometer active', `Digital compass sensor working. Device: ${detectDeviceType()}`);
    }

    // Initialize gyroscope for smooth rotation
    if ('Gyroscope' in window) {
        gyroscope = new Gyroscope({
            frequency: 60,
            referenceFrame: 'screen'
        });

        gyroscope.onerror = (event) => {
            console.log('Gyroscope error:', event.error);
            // Don't update status here as magnetometer might still work
        };

        gyroscope.onreading = () => {
            if (lastTimestamp) {
                const dt = (gyroscope.timestamp - lastTimestamp) / 1000; // Convert to seconds
                
                // Gyroscope's z-axis gives rotation in rad/s
                const gyroRotation = gyroscope.z * dt * 180 / Math.PI; // Convert to degrees
                
                let newOrientation;
                if (typeof magHeading === 'number') {
                    const A = 0.95; // Complementary filter coefficient
                    newOrientation = A * (deviceOrientation + gyroRotation) + (1 - A) * magHeading;
                    newOrientation %= 360;
                    if (newOrientation < 0) newOrientation += 360;
                } else {
                    // No magnetometer reading yet, just use gyro (will drift)
                    newOrientation = (deviceOrientation + gyroRotation) % 360;
                }
                setDeviceOrientation(newOrientation);

                Object.assign(debugInfo, {
                    source_gyro: 'Gyroscope',
                    gyro_x: gyroscope.x,
                    gyro_y: gyroscope.y,
                    gyro_z: gyroscope.z,
                    deviceOrientation: newOrientation
                });
                updateDebugInfo();
            }
            lastTimestamp = gyroscope.timestamp;
        };

        gyroscope.start();
        
        if (sensorType === 'Magnetometer') {
            sensorType = 'Magnetometer + Gyroscope';
            updateSensorStatus(true, 'Magnetometer + Gyroscope active', `High precision compass with gyroscope smoothing. Device: ${detectDeviceType()}`);
        }
    }
}
function tryMagnetometerGyroscope() {
    try {
        startMagnetometerGyroscope();
    } catch (error) {
        console.log('Magnetometer/Gyroscope fallback failed:', error);
        // Final fallback to DeviceOrientation
        startDeviceOrientationCompass(false);
    }
}

function startDeviceOrientationCompass(motionGranted) {
    compassSupported = true;
    window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    window.addEventListener('deviceorientation', handleOrientation, true);

    if (motionGranted && 'DeviceMotionEvent' in window) {
        useMotion = true;
        window.addEventListener('devicemotion', handleMotion, true);
        sensorType = 'DeviceOrientation + Motion';
        updateSensorStatus(true, 'Legacy sensor with Gyro', `Using DeviceOrientation and DeviceMotion for smoothing. Device: ${detectDeviceType()}`);
    } else {
        useMotion = false;
        sensorType = 'DeviceOrientation';
        updateSensorStatus(true, 'Legacy orientation sensor', `Using DeviceOrientation API fallback. Device: ${detectDeviceType()}`);
    }
}

function handleMotion(event) {
    if (event.rotationRate && typeof event.rotationRate.alpha === 'number') {
        if (lastMotionTimestamp) {
            const dt = (event.timeStamp - lastMotionTimestamp) / 1000; // seconds
            // rotationRate.alpha is in degrees per second
            const gyroRotation = event.rotationRate.alpha * dt;

            let newOrientation;
            if (typeof orientationAlpha === 'number') {
                const A = 0.95; // Complementary filter coefficient
                newOrientation = A * (deviceOrientation + gyroRotation) + (1 - A) * orientationAlpha;
                newOrientation %= 360;
                if (newOrientation < 0) newOrientation += 360;
            } else {
                // If no absolute orientation, just integrate gyro (will drift)
                newOrientation = (deviceOrientation + gyroRotation) % 360;
            }
            setDeviceOrientation(newOrientation);

            Object.assign(debugInfo, {
                source_motion: 'DeviceMotionEvent',
                rotationRate: event.rotationRate,
                deviceOrientation: newOrientation
            });
            updateDebugInfo();
        }
        lastMotionTimestamp = event.timeStamp;
    }
}

function updateOrientationDisplay(alpha, beta, gamma) {
    const alphaEl = document.getElementById('orientation-alpha');
    const betaEl = document.getElementById('orientation-beta');
    const gammaEl = document.getElementById('orientation-gamma');

    if (alphaEl && typeof alpha === 'number') {
        alphaEl.textContent = `${alpha.toFixed(1)}°`;
    }
    if (betaEl && typeof beta === 'number') {
        betaEl.textContent = `${beta.toFixed(1)}°`;
    }
    if (gammaEl && typeof gamma === 'number') {
        gammaEl.textContent = `${gamma.toFixed(1)}°`;
    }
}

function handleOrientation(event) {
    let compass = event.webkitCompassHeading || event.alpha;
    
    if (compass !== null && compass !== undefined) {
        if (event.webkitCompassHeading) {
            // iOS returns absolute compass heading
            orientationAlpha = compass;
        } else {
            // Android returns alpha relative to device orientation
            orientationAlpha = 360 - compass;
        }
        
        // If not using motion fusion, or if motion hasn't started, set orientation directly
        if (!useMotion || lastMotionTimestamp === null) {
             setDeviceOrientation(orientationAlpha);
        }

        updateOrientationDisplay(event.alpha, event.beta, event.gamma);

        Object.assign(debugInfo, {
            source_orientation: 'DeviceOrientationEvent',
            webkitCompassHeading: event.webkitCompassHeading,
            alpha: event.alpha,
            beta: event.beta,
            gamma: event.gamma,
            orientationAlpha: orientationAlpha
        });
        updateDebugInfo();
    }
}

function stopAllSensors() {
    if (absoluteOrientationSensor) {
        absoluteOrientationSensor.stop();
        absoluteOrientationSensor = null;
    }
    if (magnetometer) {
        magnetometer.stop();
        magnetometer = null;
    }
    if (gyroscope) {
        gyroscope.stop();
        gyroscope = null;
    }
    if (accelerometer) {
        accelerometer.stop();
        accelerometer = null;
    }
    
    // Remove DeviceOrientation listeners
    window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
    window.removeEventListener('deviceorientation', handleOrientation, true);
    window.removeEventListener('devicemotion', handleMotion, true);

    debugInfo = {};
    updateDebugInfo();
}

function updateCompassRotation() {
    const compass = document.getElementById('compass');
    const needle = document.getElementById('compassNeedle');
    
    // Rotate the entire compass face to match device orientation
    compass.style.transform = `rotate(${-smoothedOrientation}deg)`;
    
    // Keep the needle pointing north (compensate for compass rotation)
    needle.style.transform = `translate(-50%, -100%) rotate(${smoothedOrientation}deg)`;
    
    // Update target indicator if we have a target
    if (targetBearing !== null) {
        updateTargetIndicator();
    }
}

function updateTargetIndicator() {
    const targetIndicator = document.getElementById('targetIndicator');
    
    if (targetBearing !== null) {
        targetIndicator.classList.add('active');
        // Calculate relative bearing considering device orientation
        const relativeBearing = targetBearing + smoothedOrientation;
        targetIndicator.style.transform = `translate(-50%, -100%) rotate(${relativeBearing}deg)`;
    } else {
        targetIndicator.classList.remove('active');
    }
}

function updateSensorStatus(active, statusText = '', detailText = '') {
    const sensorStatus = document.getElementById('sensorStatus');
    const sensorTextElement = document.getElementById('sensorText');
    const sensorInfo = document.getElementById('sensorInfo');
    const t = translations[currentLanguage];
    
    sensorStatus.className = `sensor-status ${active ? 'active' : 'inactive'}`;
    
    // Update main sensor text
    sensorTextElement.textContent = t.sensorText;
    
    // Update sensor info with status and details
    if (statusText) {
        sensorInfo.textContent = statusText;
        sensorInfo.style.color = active ? '#2ecc71' : '#e74c3c';
    } else {
        sensorInfo.textContent = active ? 'Sensor active' : 'Sensor inactive';
        sensorInfo.style.color = active ? '#2ecc71' : '#e74c3c';
    }
    
    // Store error for detailed view
    let sensorError = detailText;
    
    // Add click handler for detailed error info
    if (detailText && !active) {
        sensorInfo.style.cursor = 'pointer';
        sensorInfo.title = detailText;
        sensorInfo.onclick = () => {
            alert(`Sensor Details:

${detailText}`);
        };
    } else {
        sensorInfo.style.cursor = 'default';
        sensorInfo.title = '';
        sensorInfo.onclick = null;
    }
    
    compassSupported = active;

    Object.assign(debugInfo, {
        sensorStatus: {
            active: active,
            status: statusText,
            details: detailText,
            type: sensorType
        }
    });
    updateDebugInfo();
}

function updateFieldIfNotNull(fieldName, value, precision = 2) {
    const field = document.getElementById(fieldName);
    if (field && value !== null && value !== undefined) {
        field.innerHTML = value.toFixed(precision);
    }
}

function updateDebugInfo() {
    if (document.getElementById('debug-panel').style.display === 'none') return;

    // From DeviceOrientationEvent
    if (debugInfo.source_orientation) {
        updateFieldIfNotNull('Orientation_a', debugInfo.alpha);
        updateFieldIfNotNull('Orientation_b', debugInfo.beta);
        updateFieldIfNotNull('Orientation_g', debugInfo.gamma);
    }

    // From DeviceMotionEvent
    if (debugInfo.source_motion && debugInfo.rotationRate) {
        updateFieldIfNotNull('Gyroscope_z', debugInfo.rotationRate.alpha);
        updateFieldIfNotNull('Gyroscope_x', debugInfo.rotationRate.beta);
        updateFieldIfNotNull('Gyroscope_y', debugInfo.rotationRate.gamma);
    }

    // From Generic Gyroscope Sensor
    if (debugInfo.source_gyro) {
        updateFieldIfNotNull('Gyroscope_x', debugInfo.gyro_x);
        updateFieldIfNotNull('Gyroscope_y', debugInfo.gyro_y);
        updateFieldIfNotNull('Gyroscope_z', debugInfo.gyro_z);
    }

    // Status
    if (debugInfo.sensorStatus) {
        const sensorTypeEl = document.getElementById('sensor_type');
        if (sensorTypeEl) sensorTypeEl.textContent = debugInfo.sensorStatus.type;
        
        const sensorStatusEl = document.getElementById('sensor_status');
        if (sensorStatusEl) sensorStatusEl.textContent = debugInfo.sensorStatus.status;
    }

    // Orientation Status
    const sourceEl = document.getElementById('orientation_source');
    if (sourceEl) {
        sourceEl.textContent = sensorType;
    }
    updateFieldIfNotNull('orientation_heading', deviceOrientation);
}