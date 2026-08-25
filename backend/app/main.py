import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles


from .database import Base, engine, SessionLocal
from . import models  # noqa: F401  (ensures models are registered on Base)
from .seed_data import seed_if_empty
from .routers import transactions, lessons, investments, settings as settings_router, auth as auth_router, agent as agent_router

app = FastAPI(
    title="FinTrack API",
    description="Track -> Learn -> Invest: integrated personal finance platform backend.",
    version="1.0.0",
)

origins_env = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:4173")
origins = [o.strip() for o in origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_if_empty(db)
    finally:
        db.close()


app.include_router(auth_router.router)
app.include_router(transactions.router)
app.include_router(lessons.router)
app.include_router(investments.router)
app.include_router(settings_router.router)
app.include_router(agent_router.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))

if os.path.exists(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="static_assets")

    from fastapi.responses import FileResponse, Response

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api") or full_path in ["docs", "redoc", "openapi.json"]:
            return Response(status_code=404)
        file_path = os.path.join(frontend_dist, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        index_path = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return Response(status_code=404)
else:
    @app.get("/")
    def root():
        return {"message": "FinTrack API is running. See /docs for the interactive API explorer."}

