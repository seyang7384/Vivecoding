import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Schedule from './pages/Schedule';
import TreatmentStatus from './pages/TreatmentStatus';
import Chat from './pages/Chat';
import Inventory from './pages/Inventory';
import Manuals from './pages/Manuals';
import ManualDetail from './pages/ManualDetail';
import VoiceHQ from './pages/VoiceHQ';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="treatment-status" element={<TreatmentStatus />} />
            <Route path="patients" element={<Patients />} />
            <Route path="patients/:id" element={<PatientDetail />} />
            <Route path="schedule" element={<Schedule />} />
            <Route path="chat" element={<Chat />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="manuals" element={<Manuals />} />
            <Route path="manuals/:id" element={<ManualDetail />} />
            <Route path="voice-hq" element={<VoiceHQ />} />
          </Route>
        </Route>

        {/* Catch all - redirect to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
