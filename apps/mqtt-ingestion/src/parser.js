function parseObuMessage(messageString) {
    try {
        const cleanString = messageString.trim();
        return JSON.parse(cleanString);
    } catch (err) {
        try {
            const fixedString = messageString
                .replace(/'/g, '"')
                .replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3')
                .replace(/,\s*}/g, '}')
                .trim();
            return JSON.parse(fixedString);
        } catch (err2) {
            console.error("Failed to parse message content:", messageString);
            return null;
        }
    }
}

function determineVehicleStatus(rpm, speed, carResponse) {
    const currentRpm = parseFloat(rpm) || 0;
    let currentSpeed = parseFloat(speed) || 0;

    // Ưu tiên tuyệt đối: Vận tốc GPS (Ngưỡng 1km/h - thống nhất với frontend)
    const SPEED_THRESHOLD = 1; 
    
    if (currentSpeed >= SPEED_THRESHOLD) {
        return 'RUNNING';
    }

    // Nếu xe đứng im (Speed < 3), ta mới dùng tới cảm biến ACC & RPM của OBU/ODB2
    if (String(carResponse) === '0') {
        return 'PARKED';
    }

    if (currentRpm > 0) {
        return 'STOPPED'; // Xe nổ máy nhưng đứng yên
    }

    return 'PARKED';
}

module.exports = {
    parseObuMessage,
    determineVehicleStatus
};
