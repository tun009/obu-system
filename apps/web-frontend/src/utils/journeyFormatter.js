export function formatJourneyData(rawLogs) {
    if (!rawLogs || rawLogs.length === 0) return { logs: [], stats: { runningMin: 0, stoppedMin: 0, parkedMin: 0, engineOnMin: 0 } };

    const stats = { runningMin: 0, stoppedMin: 0, parkedMin: 0, engineOnMin: 0 };

    const sortedLogs = [...rawLogs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    let lastLat = null;
    let lastLng = null;

    const formattedLogs = sortedLogs.map(log => {
        const speed = parseFloat(log.speed) || 0;
        const rpm = parseInt(log.rpm) || 0;
        
        let status = 'OFFLINE';

        if (speed >= 1) {
            status = 'RUNNING';
        } else if (rpm > 0) {
            status = 'STOPPED';
        } else {
            status = 'PARKED';
        }

        let parsedLat = parseFloat(log.lat);
        let parsedLng = parseFloat(log.lng);
        let validLocation = true;

        if (isNaN(parsedLat) || isNaN(parsedLng) || (parsedLat === 0 && parsedLng === 0)) {
            parsedLat = lastLat;
            parsedLng = lastLng;
            validLocation = false;
        } else {
            lastLat = parsedLat;
            lastLng = parsedLng;
        }
        
        return {
            ...log,
            status,
            lat: parsedLat,
            lng: parsedLng,
            validLocation,
            date: new Date(log.timestamp)
        };
    });

    let lastLogTime = null;
    let lastStatus = null;

    formattedLogs.forEach(log => {
        const currTime = log.date.getTime();
        if (lastLogTime && lastStatus) {
            const diffMin = (currTime - lastLogTime) / 60000;
            
            // Cap at 10 min per gap to prevent inflated stats from network drops
            const timeToAdd = Math.min(diffMin, 10);
            
            if (lastStatus === 'RUNNING') stats.runningMin += timeToAdd;
            else if (lastStatus === 'STOPPED') stats.stoppedMin += timeToAdd;
            else if (lastStatus === 'PARKED') stats.parkedMin += timeToAdd;

            if (lastStatus === 'RUNNING' || lastStatus === 'STOPPED') {
                stats.engineOnMin += timeToAdd;
            }
        }
        lastLogTime = currTime;
        lastStatus = log.status;
    });

    stats.runningMin = Math.round(stats.runningMin);
    stats.stoppedMin = Math.round(stats.stoppedMin);
    stats.parkedMin = Math.round(stats.parkedMin);
    stats.engineOnMin = Math.round(stats.engineOnMin);

    return {
        logs: formattedLogs,
        stats
    };
}
