// Utility functions for journey data processing

// Determine status based on speed and RPM
export const determinePointStatus = (rpm, speed) => {
    if (rpm === 0 && speed < 1) return 'PARKED';
    if (rpm > 0 && speed < 1) return 'STOPPED';
    return 'RUNNING';
};

// Calculate distance between two lat/lng coordinates in km (Haversine formula)
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const p = 0.017453292519943295;    // Math.PI / 180
    const c = Math.cos;
    const a = 0.5 - c((lat2 - lat1) * p)/2 + 
            c(lat1 * p) * c(lat2 * p) * 
            (1 - c((lon2 - lon1) * p))/2;
    return 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
};

// Process raw historical logs into aggregated timeline segments and calculation metrics
export const aggregateJourneyData = (logs) => {
    if (!logs || logs.length === 0) {
        return { segments: [], stats: { totalKm: 0, runningMin: 0, stoppedMin: 0, parkedMin: 0, engineOnMin: 0 }};
    }

    const segments = [];
    let currentSegment = null;
    let totalKm = 0;
    
    // Stats accumulators (in milliseconds)
    const statsMs = { RUNNING: 0, STOPPED: 0, PARKED: 0 };
    
    let lastValidPoint = null;

    for (let i = 0; i < logs.length; i++) {
        let point = logs[i];
        
        // Ensure numbers
        const pLat = Number(point.lat);
        const pLng = Number(point.lng);

        // Handle Null Island / Zero Coordinates strictly (filter anything near 0,0)
        const isInvalidGPS = isNaN(pLat) || isNaN(pLng) || (Math.abs(pLat) < 0.1 && Math.abs(pLng) < 0.1);
        
        // Setup fallback point if GPS is invalid but we have a previous known good location
        if (isInvalidGPS && lastValidPoint) {
           point = { ...point, lat: lastValidPoint.lat, lng: lastValidPoint.lng, isFallback: true };
        } else if (!isInvalidGPS) {
           lastValidPoint = point; // Update last known good location
        }

        const pointStatus = determinePointStatus(point.rpm, point.speed);
        
        // Calculate distance from previous point (only if both are valid GPS points)
        if (i > 0 && lastValidPoint && !isInvalidGPS) {
            const prevPoint = logs[i-1];
            const prevLat = Number(prevPoint.lat);
            const prevLng = Number(prevPoint.lng);
            if (!isNaN(prevLat) && !isNaN(prevLng) && !(Math.abs(prevLat) < 0.1 && Math.abs(prevLng) < 0.1)) {
                const dist = calculateDistance(prevLat, prevLng, pLat, pLng);
                totalKm += dist;
            }
        }

        // Segment grouping logic
        if (!currentSegment) {
            currentSegment = {
                status: pointStatus,
                startTime: new Date(point.timestamp),
                endTime: new Date(point.timestamp),
                startPoint: point,
                endPoint: point,
                points: [point],
                avgSpeed: point.speed,
                fuel: point.fuel
            };
        } else if (currentSegment.status === pointStatus) {
            // Continuation of same status
            currentSegment.endTime = new Date(point.timestamp);
            currentSegment.endPoint = point;
            currentSegment.points.push(point);
            currentSegment.fuel = point.fuel;
            
            // Running average speed for RUNNING segments
            if (pointStatus === 'RUNNING') {
                const totalSpeed = currentSegment.points.reduce((sum, p) => sum + p.speed, 0);
                currentSegment.avgSpeed = totalSpeed / currentSegment.points.length;
            }
        } else {
            // Status changed, close current segment and start new
            
            // Calculate duration in minutes for the closed segment
            const durationMs = currentSegment.endTime.getTime() - currentSegment.startTime.getTime();
            currentSegment.durationMin = Math.round(durationMs / 60000);
            
            // Add to stats
            statsMs[currentSegment.status] += durationMs;
            
            segments.push(currentSegment);
            
            // Start new segment
            currentSegment = {
                status: pointStatus,
                startTime: new Date(point.timestamp),
                endTime: new Date(point.timestamp),
                startPoint: point,
                endPoint: point,
                points: [point],
                avgSpeed: point.speed,
                fuel: point.fuel
            };
        }
    }
    
    // Push the very last segment
    if (currentSegment) {
        const durationMs = currentSegment.endTime.getTime() - currentSegment.startTime.getTime();
        currentSegment.durationMin = Math.round(durationMs / 60000);
        statsMs[currentSegment.status] += durationMs;
        segments.push(currentSegment);
    }
    
    // Sort segments descending (newest first) for the UI timeline
    segments.sort((a, b) => b.startTime - a.startTime);

    return {
        segments,
        stats: {
            totalKm: Math.round(totalKm),
            runningMin: Math.round(statsMs.RUNNING / 60000),
            stoppedMin: Math.round(statsMs.STOPPED / 60000),
            parkedMin: Math.round(statsMs.PARKED / 60000),
            engineOnMin: Math.round((statsMs.RUNNING + statsMs.STOPPED) / 60000)
        }
    };
};

// Caching reverse geocoder
const geocodeCache = new Map();

export const reverseGeocode = async (lat, lng) => {
    // Round to 4 decimal places for caching (approx 11m accuracy)
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    
    if (geocodeCache.has(cacheKey)) {
        return geocodeCache.get(cacheKey);
    }

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
        const data = await response.json();
        
        // Try to construct a readable short address "Street, District, City"
        const address = data.address;
        if (!address) return "Lat/Lng Coordinate";
        
        const street = address.road || address.pedestrian || "";
        const district = address.suburb || address.county || address.city_district || "";
        const city = address.city || address.state || address.province || "";
        
        const parts = [street, district, city].filter(Boolean);
        const readableAddress = parts.join(', ') || data.display_name.split(',').slice(0, 3).join(',');
        
        geocodeCache.set(cacheKey, readableAddress);
        return readableAddress;
    } catch (error) {
        console.error("Geocoding failed", error);
        return "Unknown Location";
    }
};
