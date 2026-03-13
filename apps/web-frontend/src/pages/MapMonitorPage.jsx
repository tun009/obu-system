import React, { useState } from 'react';
import axios from 'axios';
import VehicleList from '../components/VehicleList';
import MapDashboard from '../components/MapDashboard';
import { useVehicles } from '../context/VehicleContext';

export default function MapMonitorPage() {
    const { vehicles, API_BASE_URL } = useVehicles();
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [journeyHistory, setJourneyHistory] = useState([]);

    const handleSelectVehicle = async (vehicle) => {
        setSelectedVehicle(vehicle);
        try {
            const today = new Date();
            const start = new Date(today.setHours(0,0,0,0)).toISOString();
            const end = new Date(today.setHours(23,59,59,999)).toISOString();
            
            const response = await axios.get(`${API_BASE_URL}/vehicles/${vehicle.imei}/history`, {
                params: { start, end }
            });
            
            if (response.data.success) {
                setJourneyHistory(response.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch journey history", error);
            setJourneyHistory([]);
        }
    };

    return (
        <div className="flex h-full p-4 gap-4 pb-0">
            {/* 500px fixed width Sidebar */}
            <div className="w-[500px] flex-shrink-0 h-full pb-4">
                <div className="h-full rounded-lg overflow-hidden shadow-sm border border-gray-200">
                    <VehicleList 
                        vehicles={vehicles} 
                        onSelectVehicle={handleSelectVehicle} 
                        selectedVehicleId={selectedVehicle?.imei}
                    />
                </div>
            </div>

            {/* Flexible Map Container */}
            <div className="flex-1 h-full pb-4">
                <MapDashboard 
                    vehicles={vehicles} 
                    selectedVehicle={selectedVehicle}
                    journeyHistory={journeyHistory}
                />
            </div>
        </div>
    );
}
