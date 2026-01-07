# Lessons Learned

## 1. React Strict Mode & Janus Session Lifecycle
**Problem**: React Strict Mode mounts components twice in development. This caused `Janus.init` and `createSession` to run multiple times, creating "ghost sessions" and race conditions where Janus would verify a token against a destroyed session.
**Solution**:
- Used `useRef` guards (`initializedRef`, `creatingSessionRef`) to ensure initialization logic runs exactly once per component lifecycle.
- Implemented robust cleanup in `useEffect` to explicitly destroy Janus sessions on unmount.

## 2. Stream Acquisition: Janus vs Manual
**Problem**: Relying on Janus to acquire the screen stream (`plugin.createOffer({ media: { video: 'screen' } })` or the newer `tracks` API) was unreliable. The `onlocalstream` callback frequently failed to fire even after successful permission grants, leaving the local self-view blank.
**Solution**:
- Decoupled stream acquisition from Janus.
- Implemented **Manual Stream Acquisition** using `navigator.mediaDevices.getDisplayMedia`.
- Passed the explicit tracks to Janus via `createOffer`.
- Assigned the stream directly to the local video element (`video.srcObject = stream`), guaranteeing instant self-view regardless of the signaling state.

## 3. Remote Stream Rendering Reliability
**Problem**: Viewers were successfully negotiating WebRTC, but the `onremotestream` callback (which provides a fully formed MediaStream) was inconsistent, often resulting in blank screens despite active data flow.
**Solution**:
- Utilized the `onremotetrack` callback as a fallback/primary method.
- This allows attaching individual tracks (audio/video) to the MediaStream as soon as they arrive on the wire, rather than waiting for the browser/library to bundle them.
- Updated the subscription request to explicitly ask for receiving video/audio tracks.

## 4. State Persistence & Deep Linking
**Problem**:
- **Host Role Loss**: Refreshing the browser caused the Host to lose their status (becoming a Viewer) because the role data was only in volatile `location.state`.
- **Viewer Link Error**: Viewers clicking a shared link failed to join because the internal Janus Room ID (different from the DB ID) was unknown to them.
**Solution**:
- **Role**: Implemented a multi-tier check: URL Query Param (`?role=host`) + `sessionStorage` (Host Token) validation.
- **Viewer Init**: Added logic to fetch Room Metadata (including Janus Room ID) from the backend API if it's missing from the initial state.

## 5. Autoplay & Interaction
**Problem**: Browsers block video autoplay with sound, and sometimes even muted autoplay if the element isn't interacting with the DOM correctly.
**Solution**:
- Enforced `muted={true}` on all video elements.
- Added explicit `video.play().catch(...)` logic to handle playback promises and debug failures.
