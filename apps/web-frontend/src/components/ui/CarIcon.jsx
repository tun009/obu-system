import React from 'react';

// Status color mapping for SVG filling
const statusColorMap = {
    RUNNING: "#10b981", // Emerald 500
    STOPPED: "#f59e0b", // Amber 500
    PARKED: "#64748b",  // Slate 500
    LOST_SIGNAL: "#ef4444" // Red 500
};

export default function CarIcon({ status = 'ONLINE', className = '', style = {}, width = 24, height = 40 }) {
    const rawStatus = status || 'ONLINE';
    const mainColor = statusColorMap[rawStatus] || "#3b82f6"; // default blue

    return (
        <svg 
            width={width} 
            height={height} 
            viewBox="0 0 24 40" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            style={style}
        >
            {/* Tires background */}
            <rect x="2" y="5" width="4" height="8" rx="1" fill="#1e293b"/>
            <rect x="18" y="5" width="4" height="8" rx="1" fill="#1e293b"/>
            <rect x="2" y="27" width="4" height="8" rx="1" fill="#1e293b"/>
            <rect x="18" y="27" width="4" height="8" rx="1" fill="#1e293b"/>
            
            {/* Main Car Body shape */}
            <rect x="4" y="2" width="16" height="36" rx="6" fill={mainColor} stroke="#0f172a" strokeWidth="1"/>
            
            {/* Windshield */}
            <path d="M5 12C5 10 7 9 12 9C17 9 19 10 19 12L18 16H6L5 12Z" fill="#bae6fd" stroke="#0ea5e9" strokeWidth="0.5"/>
            
            {/* Back window */}
            <path d="M6 28L5 32C5 34 7 35 12 35C17 35 19 34 19 32L18 28H6Z" fill="#bae6fd" stroke="#0ea5e9" strokeWidth="0.5"/>
            
            {/* Roof Top line for depth */}
            <rect x="6" y="16" width="12" height="12" rx="2" fill="white" fillOpacity="0.15"/>
            
            {/* Headlights */}
            <circle cx="7" cy="4" r="1.5" fill="#fef08a"/>
            <circle cx="17" cy="4" r="1.5" fill="#fef08a"/>
            
            {/* Taillights */}
            <rect x="5.5" y="37" width="3" height="1.5" rx="0.5" fill="#ef4444"/>
            <rect x="15.5" y="37" width="3" height="1.5" rx="0.5" fill="#ef4444"/>
        </svg>
    );
}
