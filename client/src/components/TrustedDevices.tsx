import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';

interface Device {
    id: number;
    device_fingerprint: string;
    name: string | null;
    ip_address: string | null;
    country_code: string | null;
    last_used_at: string | null;
}

export default function TrustedDevices() {
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [removing, setRemoving] = useState<number | null>(null);


    useEffect(() => {
        fetchDevices();
    }, []);

    const fetchDevices = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await apiClient.get('/devices', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setDevices(response.data.devices);
        } catch {
            setError('Failed to load trusted devices');
        } finally {
            setLoading(false);
        }
    };

    const removeDevice = async (id: number) => {
        setRemoving(id);
        try {
            const token = localStorage.getItem('token');
            await apiClient.delete(`/devices/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setDevices(prev => prev.filter(d => d.id !== id));
        } catch {
            setError('Failed to remove device');
        } finally {
            setRemoving(null);
        }
    };

    const currentFingerprint = localStorage.getItem('device_fingerprint');

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-2">Trusted Devices</h2>
            <p className="text-slate-400 text-sm mb-6">
                Devices that skip email verification on login.
            </p>

            {error && (
                <div className="bg-red-950 border border-red-800 text-red-200 px-4 py-3 rounded-lg text-sm mb-4">
                    {error}
                </div>
            )}

            {loading ? (
                <p className="text-slate-500 text-sm">Loading...</p>
            ) : devices.length === 0 ? (
                <p className="text-slate-500 text-sm">No trusted devices yet.</p>
            ) : (
                <ul className="space-y-3">
                    {devices.map(device => {
                        const isCurrent = device.device_fingerprint === currentFingerprint;
                        return (
                            <li
                                key={device.id}
                                className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-lg px-5 py-4"
                            >
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-white text-sm font-medium">
                                            {device.name ?? `Device …${device.device_fingerprint.slice(-8)}`}
                                        </span>
                                        {isCurrent && (
                                            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                                                This device
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-slate-400 text-xs mt-1 space-x-3">
                                        {device.country_code && <span>{device.country_code}</span>}
                                        {device.ip_address && <span>{device.ip_address}</span>}
                                        {device.last_used_at && (
                                            <span>Last used {new Date(device.last_used_at).toLocaleDateString()}</span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => removeDevice(device.id)}
                                    disabled={removing === device.id}
                                    className="text-red-400 hover:text-red-300 text-sm font-medium disabled:opacity-50 transition ml-4"
                                >
                                    {removing === device.id ? 'Removing…' : 'Remove'}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}