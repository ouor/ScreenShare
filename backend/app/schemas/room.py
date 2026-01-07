from pydantic import BaseModel
from typing import Optional

class RoomCreate(BaseModel):
    title: Optional[str] = "Screen Share"
    password: Optional[str] = None

class RoomResponse(BaseModel):
    room_id: str
    host_token: str
    janus_room_id: int
    janus_url: str

class RoomInfo(BaseModel):
    room_id: str
    status: str
    janus_room_id: int
    janus_url: str
