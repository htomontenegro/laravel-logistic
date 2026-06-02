import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import MfaSetup from './components/MfaSetup';
import MfaSettings from './components/MfaSettings';
import TrustedDevices from './components/TrustedDevices';

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const token = localStorage.getItem('token');

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}

// Public Route Component (redirect to dashboard if already logged in)
function PublicRoute({ children }: { children: React.ReactNode }) {
    const token = localStorage.getItem('token');

    if (token) {
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
}

export default function App() {
    return (
        <Router>
            <Routes>
                {/* Public Routes */}
                <Route
                    path="/login"
                    element={
                        <PublicRoute>
                            <Login />
                        </PublicRoute>
                    }
                />
                <Route
                    path="/register"
                    element={
                        <PublicRoute>
                            <Register />
                        </PublicRoute>
                    }
                />

                {/* Protected Routes */}
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/mfa-setup"
                    element={
                        <ProtectedRoute>
                            <MfaSetup />
                        </ProtectedRoute>
                    }
                />
              
                <Route
                    path="/mfa-settings"
                    element={
                        <ProtectedRoute>
                            <MfaSettings />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/trusted-devices"
                    element={
                        <ProtectedRoute>
                            <TrustedDevices />
                        </ProtectedRoute>
                    }
                />

                {/* Default Route */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />

                {/* 404 Fallback */}
                <Route
                    path="*"
                    element={
                        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                            <div className="text-center">
                                <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                                <p className="text-gray-600 mb-6">Page not found</p>
                                <a
                                    href="/dashboard"
                                    className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    Go to Dashboard
                                </a>
                            </div>
                        </div>
                    }
                />
            </Routes>
        </Router>
    );
}