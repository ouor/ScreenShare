import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:8000/api/v1',
    headers: {
        // X-Host-Token header will be passed explicitly for protected routes
    },
});

export const sendHeartbeat = (roomId, token) => api.put(`/rooms/${roomId}/heartbeat`, {}, { headers: { 'X-Host-Token': token } });

export default api;
