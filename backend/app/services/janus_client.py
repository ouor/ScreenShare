import httpx
import logging
from ..core.config import settings

logger = logging.getLogger(__name__)

class JanusClient:
    def __init__(self):
        # Pointing to standard API now, e.g., http://janus:8088/janus
        self.base_url = settings.JANUS_ADMIN_URL 
        self.admin_secret = settings.JANUS_ADMIN_SECRET

    async def create_room(self, room_id: int, description: str, secret: str = None) -> bool:
        async with httpx.AsyncClient() as client:
            try:
                # 1. Create Session
                session_resp = await client.post(self.base_url, json={"janus": "create", "transaction": "create_session"})
                session_resp.raise_for_status()
                session_data = session_resp.json()
                if session_data["janus"] != "success":
                    logger.error(f"Failed to create session: {session_data}")
                    return False
                session_id = session_data["data"]["id"]

                # 2. Attach to VideoRoom Plugin
                attach_url = f"{self.base_url}/{session_id}"
                attach_payload = {
                    "janus": "attach",
                    "plugin": "janus.plugin.videoroom",
                    "transaction": "attach_plugin"
                }
                attach_resp = await client.post(attach_url, json=attach_payload)
                attach_data = attach_resp.json()
                if attach_data["janus"] != "success":
                    logger.error(f"Failed to attach plugin: {attach_data}")
                    return False
                handle_id = attach_data["data"]["id"]

                # 3. Create Room (Send Message)
                msg_url = f"{self.base_url}/{session_id}/{handle_id}"
                create_payload = {
                    "janus": "message",
                    "transaction": "create_room_msg",
                    "body": {
                        "request": "create",
                        "room": room_id,
                        "description": description,
                        "publishers": 6,
                        "bitrate": 128000,
                        "fir_freq": 10,
                        "audiocodec": "opus",
                        "videocodec": "vp8",
                        "record": False
                    }
                }
                if secret:
                    create_payload["body"]["secret"] = secret
                
                # Admin key might be needed if configured globally, but we didn't set it in videoroom config.
                # If we had, we would add "admin_key" to body.

                msg_resp = await client.post(msg_url, json=create_payload)
                msg_data = msg_resp.json()
                
                # 4. Cleanup (Destroy Session) - We don't need to keep it open just for creating room
                await client.post(attach_url, json={"janus": "destroy", "transaction": "destroy_session"})

                if msg_data["janus"] == "success" and "data" in msg_data["plugindata"]:
                    # Check plugin specific data
                    plugin_data = msg_data["plugindata"]["data"]
                    if plugin_data["videoroom"] == "created":
                        return True
                    else:
                        logger.error(f"Room creation failed: {plugin_data}")
                        return False
                else:
                    logger.error(f"Janus message error: {msg_data}")
                    return False

            except Exception as e:
                logger.error(f"Failed to communicate with Janus: {e}")
                return False

    async def destroy_room(self, room_id: int, secret: str) -> bool:
        """
        Destroy a VideoRoom in Janus using the admin/standard API.
        """
        async with httpx.AsyncClient() as client:
            try:
                # 1. Create Session
                session_resp = await client.post(self.base_url, json={"janus": "create", "transaction": self._transaction_id()})
                session_resp.raise_for_status()
                session_data = session_resp.json()
                if session_data["janus"] != "success":
                    logger.error(f"Failed to create session for destroy_room: {session_data}")
                    return False
                session_id = session_data["data"]["id"]

                # 2. Attach to VideoRoom Plugin
                attach_url = f"{self.base_url}/{session_id}"
                attach_payload = {
                    "janus": "attach",
                    "plugin": "janus.plugin.videoroom",
                    "transaction": self._transaction_id()
                }
                attach_resp = await client.post(attach_url, json=attach_payload)
                attach_data = attach_resp.json()
                if attach_data["janus"] != "success":
                    logger.error(f"Failed to attach plugin for destroy_room: {attach_data}")
                    # Cleanup session
                    await client.post(attach_url, json={"janus": "destroy", "transaction": self._transaction_id()})
                    return False
                handle_id = attach_data["data"]["id"]
                
                # 3. Send Destroy Room Message
                msg_url = f"{self.base_url}/{session_id}/{handle_id}"
                destroy_payload = {
                    "janus": "message",
                    "transaction": self._transaction_id(),
                    "body": {
                        "request": "destroy",
                        "room": room_id,
                        "secret": secret # Use the provided secret
                    }
                }
                
                msg_resp = await client.post(msg_url, json=destroy_payload)
                msg_data = msg_resp.json()
                
                # 4. Cleanup (Destroy Session)
                await client.post(attach_url, json={"janus": "destroy", "transaction": self._transaction_id()})

                if msg_data["janus"] == "success" and "plugindata" in msg_data and "data" in msg_data["plugindata"]:
                    plugin_data = msg_data["plugindata"]["data"]
                    if plugin_data.get("videoroom") == "destroyed":
                        return True
                    elif "error_code" in plugin_data:
                        logger.error(f"Room destruction failed with error: {plugin_data.get('error')}")
                        return False
                    else:
                        logger.error(f"Unexpected response for room destruction: {plugin_data}")
                        return False
                else:
                    logger.error(f"Janus message error during room destruction: {msg_data}")
                    return False

            except Exception as e:
                logger.error(f"Failed to communicate with Janus for destroy_room: {e}")
                return False

    async def check_room(self, room_id: int) -> bool:
        # For check room, we also need session -> attach logic
        async with httpx.AsyncClient() as client:
            try:
                # 1. Create Session
                session_resp = await client.post(self.base_url, json={"janus": "create", "transaction": "check_session"})
                if session_resp.status_code != 200: return False
                session_id = session_resp.json()["data"]["id"]

                # 2. Attach
                attach_resp = await client.post(f"{self.base_url}/{session_id}", json={
                    "janus": "attach", "plugin": "janus.plugin.videoroom", "transaction": "check_attach"
                })
                handle_id = attach_resp.json()["data"]["id"]

                # 3. Check
                msg_resp = await client.post(f"{self.base_url}/{session_id}/{handle_id}", json={
                    "janus": "message", "transaction": "check_msg",
                    "body": { "request": "exists", "room": room_id }
                })
                data = msg_resp.json()
                
                # Cleanup
                await client.post(f"{self.base_url}/{session_id}", json={"janus": "destroy", "transaction": "destroy_session"})

                if "plugindata" in data and "data" in data["plugindata"]:
                     return data["plugindata"]["data"].get("exists", False)
                return False
            except Exception:
                return False

janus_client = JanusClient()
