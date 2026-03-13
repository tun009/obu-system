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
    if (String(carResponse) === '0') {
        return 'PARKED';
    }

    const currentRpm = parseFloat(rpm) || 0;
    let currentSpeed = parseFloat(speed) || 0;

    // Ngưỡng tốc độ để coi như xe đang chạy
    const SPEED_THRESHOLD = 1;
    if (currentSpeed < SPEED_THRESHOLD) {
        currentSpeed = 0;
    }

    if (currentRpm === 0 && currentSpeed === 0) {
        return 'PARKED';
    } else if (currentRpm > 0 && currentSpeed === 0) {
        return 'STOPPED';
    } else if (currentSpeed > 0) {
        return 'RUNNING';
    }

    return 'ONLINE';
}

module.exports = {
    parseObuMessage,
    determineVehicleStatus
};
