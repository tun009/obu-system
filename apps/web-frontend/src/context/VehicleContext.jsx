import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

const VehicleContext = createContext();

export function VehicleProvider({ children }) {
    const API_BASE_URL = 'http://localhost:5000/api';
    const SOCKET_URL = 'http://localhost:5000';

    const [vehicles, setVehicles] = useState([]);
    
    // Initial Database Load
    useEffect(() => {
        const fetchVehicles = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/vehicles`);
                if (response.data.success) {
                    setVehicles(response.data.data);
                }
            } catch (error) {
                console.error("Failed to load initial vehicles", error);
            }
        };
        fetchVehicles();
    }, []);

    // Setup Socket Connect
    useEffect(() => {
        const socket = io(SOCKET_URL);

        socket.on('connect', () => {
            console.log("Connected to OBU Realtime WebSocket Hub");
        });

        socket.on('vehicle_moved', (incomingData) => {
            setVehicles(prevVehicles => {
                const index = prevVehicles.findIndex(v => v.imei === incomingData.imei);
                if (index !== -1) {
                    const updated = [...prevVehicles];
                    updated[index] = {
                        ...updated[index],
                        lat: incomingData.lat,
                        lng: incomingData.lng,
                        speed: incomingData.speed,
                        rpm: incomingData.rpm,
                        fuel: incomingData.fuel,
                        status: incomingData.status,
                        coolantTemp: incomingData.coolantTemp,
                        throttle: incomingData.throttle,
                        lastUpdate: Date.now()
                    };
                    return updated;
                } 
                // New unseen vehicle
                return [...prevVehicles, {
                    id: Date.now(),
                    imei: incomingData.imei,
                    licensePlate: `Xe ${incomingData.imei.slice(-4)}`,
                    lat: incomingData.lat,
                    lng: incomingData.lng,
                    speed: incomingData.speed,
                    rpm: incomingData.rpm,
                    fuel: incomingData.fuel,
                    status: incomingData.status,
                    coolantTemp: incomingData.coolantTemp,
                    throttle: incomingData.throttle,
                    lastUpdate: Date.now()
                }];
            });
        });

        return () => socket.disconnect();
    }, []);

    return (
        <VehicleContext.Provider value={{ vehicles, setVehicles, API_BASE_URL }}>
            {children}
        </VehicleContext.Provider>
    );
}

export function useVehicles() {
    return useContext(VehicleContext);
}
