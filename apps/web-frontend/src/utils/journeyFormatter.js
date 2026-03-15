export function formatJourneyData(rawLogs) {
    if (!rawLogs || rawLogs.length === 0) return { logs: [], stats: { runningMin: 0, stoppedMin: 0, parkedMin: 0, engineOnMin: 0 } };

    const stats = { runningMin: 0, stoppedMin: 0, parkedMin: 0, engineOnMin: 0 };
    
    // Đảm bảo dữ liệu sắp xếp theo thứ tự thời gian tăng dần để tính toán
    const sortedLogs = [...rawLogs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    let lastLat = null;
    let lastLng = null;

    const formattedLogs = sortedLogs.map(log => {
        const speed = parseFloat(log.speed) || 0;
        const rpm = parseInt(log.rpm) || 0;
        
        let status = 'OFFLINE';
        
        // Ưu tiên số 1: Vận tốc GPS (ngưỡng 1km/h - thống nhất toàn hệ thống)
        if (speed >= 1) {
            status = 'RUNNING';
        } else if (rpm > 0) {
            // Đứng im nhưng có vòng tua máy -> Dừng đỗ/Nổ máy
            status = 'STOPPED';
        } else {
            // Không chạy, không vòng tua -> Tắt máy
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

    // Tính thời gian tích luỹ (Cộng dồn khoảng cách thời gian giữa các bản ghi)
    let lastLogTime = null;
    let lastStatus = null;

    formattedLogs.forEach(log => {
        const currTime = log.date.getTime();
        if (lastLogTime && lastStatus) {
            const diffMin = (currTime - lastLogTime) / 60000;
            
            // Giới hạn max 10 phút / khoảng gap. Nếu rớt mạng quá 10 phút không làm thay đổi báo cáo ảo.
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
        logs: formattedLogs, // Thứ tự ASC (cũ -> mới), nhất quán với ORDER BY timestamp ASC từ backend
        stats
    };
}
