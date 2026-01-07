import React, { useEffect, useState, useRef } from 'react';
import styled from 'styled-components';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import adapter from 'webrtc-adapter'; // Explicit import
import Janus from '../libs/janus';
import api, { sendHeartbeat } from '../api/api';

const RoomContainer = styled.div`
    width: 100vw;
    height: 100vh;
    background-color: #000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
`;

const VideoElement = styled.video`
    width: 100%;
    height: 100%;
    object-fit: contain;
`;

const ControlsOverlay = styled.div`
    position: absolute;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(20, 20, 20, 0.8);
    padding: 1rem 2rem;
    border-radius: 12px;
    display: flex;
    gap: 1rem;
    backdrop-filter: blur(10px);
`;

const ControlButton = styled.button`
    padding: 0.8rem 1.5rem;
    background: ${props => props.$danger ? '#ff4b4b' : '#333'};
    color: white;
    font-weight: 600;
    border-radius: 8px;
    font-size: 1rem;
    
    &:hover {
        background: ${props => props.$danger ? '#ff2b2b' : '#444'};
    }
`;

const InfoBadge = styled.div`
    position: absolute;
    top: 20px;
    left: 20px;
    background: rgba(0,0,0,0.6);
    padding: 0.5rem 1rem;
    border-radius: 20px;
    color: white;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 10px;
    
    &.live {
        border: 1px solid #ff4b4b;
    }
`;

const StatusDot = styled.span`
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: ${props => props.$active ? '#00ff88' : '#ff4b4b'};
    box-shadow: ${props => props.$active ? '0 0 10px #00ff88' : 'none'};
`;

const Spinner = styled.div`
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-left-color: #00C9FF;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    animation: spin 1s linear infinite;
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;

const ToastContainer = styled.div`
    position: fixed;
    top: 20px;
    right: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 1000;
`;

const ToastMessage = styled.div`
    background: rgba(30, 30, 35, 0.9);
    border-left: 4px solid #00C9FF;
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(5px);
    animation: slideIn 0.3s ease-out forwards;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 250px;

    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;

const Room = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    // Role Determination Strategy
    const query = new URLSearchParams(location.search);
    const queryRole = query.get('role');
    const hasHostToken = !!sessionStorage.getItem(`host_token_${roomId}`);
    const role = (queryRole === 'host' || hasHostToken) ? 'host' : 'viewer';

    const [janusRoomId, setJanusRoomId] = useState(location.state?.janusRoomId || null);
    const [status, setStatus] = useState('Initializing...');
    const [toasts, setToasts] = useState([]); // Toast State

    const videoRef = useRef(null);
    const initializedRef = useRef(false);
    const janusInstanceRef = useRef(null);
    const pluginRef = useRef(null);
    const creatingSessionRef = useRef(false);
    const localStreamRef = useRef(null);

    // Toast Helper
    const showToast = (message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    // Fetch Room ID if missing (Viewer case via Link)
    useEffect(() => {
        if (!janusRoomId && roomId) {
            setStatus('Fetching Room Info...');
            api.get(`/rooms/${roomId}`)
                .then(response => {
                    setJanusRoomId(response.data.janus_room_id);
                })
                .catch(error => {
                    console.error("Failed to fetch room info:", error);
                    showToast("Invalid or expired room link.", "error");
                    setTimeout(() => navigate('/'), 2000);
                });
        }
    }, [roomId, janusRoomId, navigate]);

    // Lifecycle: Heartbeat & Cleanup (Host Only)
    useEffect(() => {
        if (role !== 'host') return;
        const hostToken = sessionStorage.getItem(`host_token_${roomId}`);
        if (!hostToken) return;

        const interval = setInterval(() => {
            sendHeartbeat(roomId, hostToken).catch(err => console.warn("Heartbeat failed", err));
        }, 10000); // 10s

        const handleBeforeUnload = () => {
            api.delete(`/rooms/${roomId}`, {
                headers: { 'X-Host-Token': hostToken },
                keepalive: true
            }).catch(e => console.error(e));
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            clearInterval(interval);
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [role, roomId]);

    // Cleanup function
    const cleanup = () => {
        if (janusInstanceRef.current) {
            janusInstanceRef.current.destroy();
            janusInstanceRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        creatingSessionRef.current = false;
        navigate('/');
    };

    useEffect(() => {
        if (!janusRoomId) return;
        let mounted = true;
        if (initializedRef.current) return;
        initializedRef.current = true;

        Janus.init({
            debug: "all",
            dependencies: Janus.useDefaultDependencies({ adapter: adapter }),
            callback: () => {
                if (!mounted) return;
                if (!Janus.isWebrtcSupported()) {
                    showToast("WebRTC not supported!", "error");
                    return;
                }
                if (!janusInstanceRef.current && !creatingSessionRef.current) {
                    setStatus('Connecting to Server...');
                    createJanusSession();
                }
            }
        });

        return () => {
            mounted = false;
            if (janusInstanceRef.current) {
                janusInstanceRef.current.destroy();
                janusInstanceRef.current = null;
            }
            creatingSessionRef.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [janusRoomId]);

    const createJanusSession = () => {
        if (creatingSessionRef.current) return;
        creatingSessionRef.current = true;

        const janus = new Janus({
            server: "http://localhost:8088/janus",
            success: () => {
                creatingSessionRef.current = false;
                setStatus('Connected. Attaching Plugin...');
                attachToVideoRoom(janus);
            },
            error: (error) => {
                console.error("Janus Error:", error);
                creatingSessionRef.current = false;
                setStatus('Connection Failed');
                showToast("Connection to Media Server Failed", "error");
            },
            destroyed: () => {
                setStatus('Session Destroyed');
                creatingSessionRef.current = false;
            }
        });
        janusInstanceRef.current = janus;
    };

    const attachToVideoRoom = (janus) => {
        let pluginHandle = null;

        janus.attach({
            plugin: "janus.plugin.videoroom",
            success: (plugin) => {
                pluginHandle = plugin;
                pluginRef.current = plugin;
                setStatus('Ready to Join');

                if (role === 'host') {
                    publishScreen(plugin);
                } else {
                    const register = { request: "join", room: janusRoomId, ptype: "publisher", display: "Viewer" };
                    plugin.send({ message: register });
                }
            },
            error: (error) => {
                console.error("Error attaching plugin:", error);
                setStatus('Error Attaching Plugin');
            },
            onmessage: (msg, jsep) => {
                const event = msg["videoroom"];
                if (event) {
                    if (event === "joined") {
                        if (role === 'host') {
                            setStatus('Active');
                            showToast("You joined as Host");
                        } else {
                            setStatus('Waiting for host...');
                            if (msg["publishers"]) {
                                const list = msg["publishers"];
                                for (let f in list) {
                                    subscribeToRemoteFeed(janus, list[f]["id"]);
                                }
                            }
                        }
                    } else if (event === "destroyed") {
                        showToast("The room has been destroyed!", "warning");
                        setTimeout(cleanup, 2000);
                    } else if (event === "event") {
                        if (msg["publishers"]) {
                            const list = msg["publishers"];
                            for (let f in list) {
                                showToast(`Publisher found: ${list[f]["display"]}`);
                                subscribeToRemoteFeed(janus, list[f]["id"]);
                            }
                        } else if (msg["leaving"]) {
                            showToast("A participant left");
                        }

                        if (msg["error"] && msg["error_code"] !== 0) {
                            showToast(msg["error"], "error");
                        }
                    }
                }
                if (jsep && pluginHandle) {
                    pluginHandle.handleRemoteJsep({ jsep: jsep });
                }
            },
            onlocalstream: (stream) => {
                // Manual handling preferred, leaving blank
            },
            onremotestream: (stream) => { },
            oncleanup: () => { setStatus('Cleaned up'); }
        });
    };

    const subscribeToRemoteFeed = (janus, feedId) => {
        let remoteFeed = null;
        janus.attach({
            plugin: "janus.plugin.videoroom",
            success: (plugin) => {
                remoteFeed = plugin;
                const listen = { request: "join", room: janusRoomId, ptype: "subscriber", feed: feedId };
                plugin.send({ message: listen });
            },
            error: (error) => {
                console.error("Subscriber Error:", error);
            },
            onmessage: (msg, jsep) => {
                if (jsep) {
                    remoteFeed.createAnswer({
                        jsep: jsep,
                        tracks: [
                            { type: 'data' },
                            { type: 'audio', capture: false, recv: false },
                            { type: 'video', capture: false, recv: true }
                        ],
                        success: (jsep) => {
                            const body = { request: "start", room: janusRoomId };
                            remoteFeed.send({ message: body, jsep: jsep });
                        },
                        error: (error) => {
                            console.error("WebRTC error:", error);
                        }
                    });
                }
            },
            onremotetrack: (track, mid, on) => {
                if (track.kind === 'video' && on) {
                    if (videoRef.current) {
                        let stream = videoRef.current.srcObject;
                        if (!stream) {
                            stream = new MediaStream();
                            videoRef.current.srcObject = stream;
                        }
                        stream.addTrack(track);
                        videoRef.current.muted = true;
                        videoRef.current.play().catch(e => console.error("Remote Play Error (Track):", e));
                        setStatus("Watching Stream");
                    }
                }
            },
            // ... other callbacks
        });
    };

    const publishScreen = async (plugin) => {
        const register = { request: "join", room: janusRoomId, ptype: "publisher", display: "Host" };
        plugin.send({ message: register });

        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            localStreamRef.current = stream;
            const videoTrack = stream.getVideoTracks()[0];

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.muted = true;
                videoRef.current.play().catch(e => console.error('Manual play fail: ' + e));
            }

            videoTrack.onended = () => {
                showToast("Screen sharing stopped by user.");
                cleanup();
            };

            plugin.createOffer({
                tracks: [{ type: 'screen', capture: videoTrack, recv: false }],
                success: (jsep) => {
                    const publish = { request: "configure", audio: false, video: true };
                    plugin.send({ message: publish, jsep: jsep });
                    setStatus('Sharing Active');
                    showToast("Screen Sharing Started");
                },
                error: (error) => {
                    console.error("WebRTC Error:", error);
                    showToast("WebRTC Error: " + JSON.stringify(error), "error");
                }
            });
        } catch (err) {
            console.error("Error getting display media:", err);
            showToast("Could not share screen: " + err, "error");
            cleanup();
        }
    };

    const handleStop = async () => {
        if (!window.confirm("Stop sharing and delete room?")) return;
        const hostToken = sessionStorage.getItem(`host_token_${roomId}`);
        if (hostToken) {
            try {
                await api.delete(`/rooms/${roomId}`, { headers: { 'X-Host-Token': hostToken } });
            } catch (e) { console.error(e); }
        }
        cleanup();
    };

    const handleCopyLink = () => {
        const url = `${window.location.origin}/room/${roomId}`;
        navigator.clipboard.writeText(url);
        showToast("Link copied to clipboard!");
    };

    return (
        <RoomContainer>
            <ToastContainer>
                {toasts.map(toast => (
                    <ToastMessage key={toast.id}>
                        {toast.type === 'error' ? '❌' : 'ℹ️'} {toast.message}
                    </ToastMessage>
                ))}
            </ToastContainer>

            <InfoBadge className={status === 'Sharing Active' || status === 'Watching Stream' ? 'live' : ''}>
                {(status === 'Connecting to Server...' || status === 'Initializing...') ? <Spinner /> : <StatusDot $active={status === 'Sharing Active' || status === 'Watching Stream'} />}
                {status}
                {role === 'host' && " (Host)"}
            </InfoBadge>

            <VideoElement ref={videoRef} autoPlay playsInline muted />

            <ControlsOverlay>
                <ControlButton onClick={handleCopyLink}>
                    🔗 Copy Link
                </ControlButton>
                {role === 'host' && (
                    <ControlButton $danger onClick={handleStop}>
                        ⏹ Stop Sharing
                    </ControlButton>
                )}
            </ControlsOverlay>
        </RoomContainer>
    );
};

export default Room;
