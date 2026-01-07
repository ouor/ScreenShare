from fastapi import APIRouter, HTTPException, Depends, Header
from app.schemas.room import RoomCreate, RoomResponse, RoomInfo
from app.services.janus_client import janus_client
import uuid
import random
import time

router = APIRouter()

# In-memory storage for demonstration (Replace with Redis in production)
# Mapping: friendly_uuid_str -> { janus_room_id: int, host_token: str, title: str, last_heartbeat: float }
rooms_db = {}

@router.post("/", response_model=RoomResponse)
async def create_room(room_in: RoomCreate):
    # 1. Generate unique IDs
    room_uuid = str(uuid.uuid4())
    host_token = str(uuid.uuid4())
    # Janus uses integer room IDs by default (unless configured for string credentials which is complex)
    # We'll generate a random positive 32-bit integer for Janus
    janus_room_id = random.randint(1000, 999999999) 
    
    # 2. Create room in Janus
    success = await janus_client.create_room(
        room_id=janus_room_id, 
        description=room_in.title,
        secret=room_in.password
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to create room on media server")

    # 3. Store mapping
    rooms_db[room_uuid] = {
        "janus_room_id": janus_room_id,
        "host_token": host_token,
        "title": room_in.title,
        "last_heartbeat": time.time()
    }
    
    # 4. Return response
    return RoomResponse(
        room_id=room_uuid,
        host_token=host_token,
        janus_room_id=janus_room_id,
        janus_url="/janus" # Relative path, handled by Nginx or direct connection later
    )

@router.get("/{room_id}", response_model=RoomInfo)
async def get_room(room_id: str):
    room_data = rooms_db.get(room_id)
    if not room_data:
        raise HTTPException(status_code=404, detail="Room not found")
        
    # Optional: Double check with Janus if the room is still alive
    # is_alive = await janus_client.check_room(room_data["janus_room_id"])
    # if not is_alive:
    #     del rooms_db[room_id]
    #     raise HTTPException(status_code=404, detail="Room active on DB but missing in Janus")

    return RoomInfo(
        room_id=room_id,
        status="active",
        janus_room_id=room_data["janus_room_id"],
        janus_url="/janus"
    )

@router.put("/{room_id}/heartbeat")
async def heartbeat(room_id: str, x_host_token: str = Header(None)):
    room_data = rooms_db.get(room_id)
    if not room_data:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if room_data["host_token"] != x_host_token:
        raise HTTPException(status_code=403, detail="Invalid host token")
    
    room_data["last_heartbeat"] = time.time()
    return {"status": "alive"}

@router.delete("/{room_id}")
async def delete_room(room_id: str, x_host_token: str = Header(None)):
    room_data = rooms_db.get(room_id)
    if not room_data:
        raise HTTPException(status_code=404, detail="Room not found")
        
    if room_data["host_token"] != x_host_token:
        raise HTTPException(status_code=403, detail="Invalid host token")

    # Destroy in Janus
    await janus_client.destroy_room(room_data["janus_room_id"])
    
    del rooms_db[room_id]
    return {"status": "deleted"}
