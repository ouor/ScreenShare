# ScreenShare - Real-time WebRTC Screen Sharing Service

**ScreenShare** is a lightweight, high-performance web application that allows users to instantly share their screens with others via a generated link. It leverages **WebRTC** for low-latency streaming and requires no software installation.

## 🚀 Key Features

*   **Instant Sharing**: Create a room with one click and start sharing immediately. No login required.
*   **Real-time Streaming**: Powered by **Janus WebRTC Gateway** for sub-second latency.
*   **Link-based Access**: Viewers can join simply by clicking a shared URL.
*   **Robust Lifecycle**:
    *   **Heartbeat Mechanism**: Automatically detects host disconnections.
    *   **Auto-Cleanup**: "Zombie rooms" are automatically removed after inactivity.
*   **Modern UI**: Dark-themed, responsive design with toast notifications and intuitive controls.

## 🛠️ Technology Stack

### Frontend
*   **Framework**: React (Vite)
*   **Styling**: Styled Components
*   **Communication**: Axios (API), Janus.js (WebRTC)
*   **State Management**: React Hooks (useEffect, useRef)

### Backend (Control Plane)
*   **Framework**: FastAPI (Python)
*   **API Docs**: Swagger UI / OpenAPI (Auto-generated)
*   **Task Management**: Python `asyncio` background tasks (GC)

### Media Server
*   **Engine**: Janus WebRTC Gateway (Dockerized)
*   **Plugins**: `videoroom` (SFU)

## 🏗️ Architecture Overview

1.  **Room Creation**: Frontend requests a new room from FastAPI.
2.  **Orchestration**: FastAPI talks to Janus Admin API to allocate a secure video room session.
3.  **Signaling**:
    *   **Host**: Connects to Janus, publishes screen stream via `getDisplayMedia`.
    *   **Viewer**: Connects to Janus, subscribes to the Host's feed.
4.  **Lifecycle**: Host sends heartbeats to FastAPI. If missed, FastAPI destroys the Janus room.

## 🏃‍♂️ Getting Started

### Prerequisites
*   **Docker Desktop** (for Janus and Backend)
*   **Node.js 18+** (for Frontend)

### 1. Start Backend & Media Server
Use Docker Compose to start Janus and the FastAPI backend.

```bash
# Root directory
docker-compose up -d
```

- **Janus Gateway**: `http://localhost:8088/janus`
- **FastAPI Backend**: `http://localhost:8000/docs`

### 2. Start Frontend Application
Run the React development server.

```bash
cd frontend
npm install
npm run dev
```

- **Frontend UI**: `http://localhost:5173`

## 📖 Usage Guide

1.  **Host**: Open the Frontend URL and click **"Start Sharing Now"**.
2.  **Permission**: Grant browser permission to share your screen or window.
3.  **Share**: Copy the generated link using the **"Copy Link"** button and send it to viewers.
4.  **View**: Viewers open the link (e.g., in Incognito mode) to watch the stream.
5.  **Stop**: Click **"Stop Sharing"** or close the tab to end the session. The room will be automatically cleaned up.

## 📝 Lessons Learned
Check out [lesson.md](./lesson.md) for detailed technical challenges and solutions encountered during development (e.g., React Strict Mode handling, Manual Stream Acquisition).
