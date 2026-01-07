import React, { useState } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';

const Container = styled.div`
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100vh;
    background: linear-gradient(135deg, #1e1e24 0%, #121212 100%);
`;

const Title = styled.h1`
    font-size: 3.5rem;
    font-weight: 800;
    margin-bottom: 1rem;
    background: linear-gradient(90deg, #00C9FF 0%, #92FE9D 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
`;

const Subtitle = styled.p`
    font-size: 1.25rem;
    color: #a0a0a0;
    margin-bottom: 3rem;
`;

const ShareButton = styled.button`
    padding: 1.2rem 3rem;
    font-size: 1.5rem;
    font-weight: 700;
    color: #121212;
    background: #00C9FF;
    border-radius: 50px;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(0, 201, 255, 0.3);

    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0, 201, 255, 0.5);
    }

    &:disabled {
        background: #555;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
    }
`;

const Home = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const handleStartSharing = async () => {
        setLoading(true);
        try {
            const response = await api.post('/rooms/', { title: "My Screen Share" });
            const { room_id, host_token, janus_room_id } = response.data;

            // Store host token in session storage
            sessionStorage.setItem(`host_token_${room_id}`, host_token);

            // Navigate to room with role=host
            navigate(`/room/${room_id}?role=host`, {
                state: { janusRoomId: janus_room_id }
            });
        } catch (error) {
            console.error("Failed to create room:", error);
            alert("Failed to create sharing session. Please check backend connection.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container>
            <Title>ScreenShare.io</Title>
            <Subtitle>Instantly share your screen. No login, no installs.</Subtitle>
            <ShareButton onClick={handleStartSharing} disabled={loading}>
                {loading ? "Creating Session..." : "Start Sharing Now"}
            </ShareButton>
        </Container>
    );
};

export default Home;
