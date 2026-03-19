import React, { useState } from 'react';
import VehicleList from '../components/VehicleList';
import MapDashboard from '../components/MapDashboard';
import { useVehicles } from '../context/VehicleContext';

export default function MapMonitorPage() {
    const { vehicles } = useVehicles();
    const [selectedVehicle, setSelectedVehicle] = useState(null);

    return (
        <div className="flex h-full p-4 gap-4 pb-0">
            <div className="w-[500px] flex-shrink-0 h-full pb-4">
                <div className="h-full rounded-lg overflow-hidden shadow-sm border border-gray-200">
                    <VehicleList 
                        vehicles={vehicles} 
                        onSelectVehicle={setSelectedVehicle}
                        selectedVehicleId={selectedVehicle?.imei}
                    />
                </div>
            </div>

            <div className="flex-1 h-full pb-4">
                <MapDashboard 
                    vehicles={vehicles} 
                    selectedVehicle={selectedVehicle}
                />
            </div>
        </div>
    );
}
