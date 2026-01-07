from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.endpoints import rooms
from contextlib import asynccontextmanager
import asyncio
import time
from app.api.v1.endpoints.rooms import rooms_db
from app.services.janus_client import janus_client

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start background task
    task = asyncio.create_task(cleanup_stale_rooms())
    yield
    # Shutdown
    task.cancel()

async def cleanup_stale_rooms():
    print("Starting background room cleanup task...")
    while True:
        try:
            current_time = time.time()
            # Iterate copy of keys to avoid modification during iteration error
            stale_rooms = []
            for room_id, room_data in rooms_db.items():
                if current_time - room_data.get("last_heartbeat", 0) > 30: # 30s timeout for demo speed
                    stale_rooms.append(room_id)
            
            for room_id in stale_rooms:
                print(f"Reaping stale room: {room_id}")
                janus_id = rooms_db[room_id]["janus_room_id"]
                # Cleanup Janus
                try:
                    await janus_client.destroy_room(janus_id)
                except Exception as e:
                    print(f"Error destroying Janus room {janus_id}: {e}")
                
                del rooms_db[room_id]

            await asyncio.sleep(10) # Run every 10s
        except asyncio.CancelledError:
            print("Cleanup task cancelled")
            break
        except Exception as e:
            print(f"Error in cleanup task: {e}")
            await asyncio.sleep(10)

app = FastAPI(title="ScreenShare API", lifespan=lifespan)

# CORS (Allow Frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, set to specific frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rooms.router, prefix="/api/v1/rooms", tags=["rooms"])

@app.get("/")
def read_root():
    return {"message": "Screen Share API is running"}
