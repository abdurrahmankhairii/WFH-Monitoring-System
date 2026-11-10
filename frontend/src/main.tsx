// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import 'leaflet/dist/leaflet.css';
import './index.css';

// Feature: Core Architecture — Purpose: Bootstraps the React 18 frontend application into the `#root` DOM element.
// OOP: Functional Helper Module — Connected To: Loaded by `frontend/index.html`; mounts `frontend/src/App.tsx`.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
