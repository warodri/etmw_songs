import os
import queue
import secrets
import subprocess
import threading
import time
import uuid
from pathlib import Path
from typing import List, Optional, Union

import torch
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from heartlib import HeartMuLaGenPipeline

BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "outputs"
OUTPUT_DIR.mkdir(exist_ok=True)
MODEL_PATH = str(BASE_DIR / "ckpt")
API_KEY = os.getenv("HEARTMULA_API_KEY", "").strip()

app = FastAPI(
    title="HeartMuLa Local API",
    version="1.1",
    docs_url=None if API_KEY else "/docs",
    redoc_url=None if API_KEY else "/redoc",
    openapi_url=None if API_KEY else "/openapi.json",
)
pipeline: Optional[HeartMuLaGenPipeline] = None
pipeline_lock = threading.Lock()
jobs: dict[str, dict] = {}
job_queue: "queue.Queue[str]" = queue.Queue()


def require_api_key(x_api_key: Optional[str] = Header(default=None)):
    if API_KEY and (not x_api_key or not secrets.compare_digest(x_api_key, API_KEY)):
        raise HTTPException(status_code=401, detail="Invalid API key")


class GenerateRequest(BaseModel):
    lyrics: str = Field(..., description="Lyrics with [Verse], [Chorus], etc.")
    tags: Union[str, List[str]] = Field(
        default_factory=lambda: ["pop"], description="Comma-separated string or list"
    )
    duration_seconds: int = Field(default=60, ge=5, le=240)
    topk: int = Field(default=50, ge=1, le=200)
    temperature: float = Field(default=1.0, ge=0.1, le=2.0)
    cfg_scale: float = Field(default=3.0, ge=1.0, le=10.0)
    seed: Optional[int] = None


def load_pipeline() -> HeartMuLaGenPipeline:
    if torch.backends.mps.is_available():
        device = torch.device("mps")
        mula_dtype = torch.float16
    else:
        device = torch.device("cpu")
        mula_dtype = torch.bfloat16

    return HeartMuLaGenPipeline.from_pretrained(
        MODEL_PATH,
        device={"mula": device, "codec": device},
        dtype={"mula": mula_dtype, "codec": torch.float32},
        version="3B",
        lazy_load=False,
    )


def _tags(value: Union[str, List[str]]) -> str:
    if isinstance(value, str):
        return value
    return ",".join(value)


def _seed(value: Optional[int]) -> None:
    if value is None:
        return
    torch.manual_seed(value)
    if torch.backends.mps.is_available():
        torch.mps.manual_seed(value)


def run_generation(request: GenerateRequest, mp3_path: Path) -> None:
    wav_path = mp3_path.with_suffix(".wav")
    with pipeline_lock:
        _seed(request.seed)
        with torch.no_grad():
            pipeline(
                {"lyrics": request.lyrics, "tags": _tags(request.tags)},
                max_audio_length_ms=request.duration_seconds * 1000,
                save_path=str(wav_path),
                topk=request.topk,
                temperature=request.temperature,
                cfg_scale=request.cfg_scale,
            )
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav_path), str(mp3_path)],
            check=True,
        )
        wav_path.unlink(missing_ok=True)


def _worker() -> None:
    while True:
        job_id = job_queue.get()
        try:
            job = jobs.get(job_id)
            if not job:
                continue
            job["status"] = "running"
            job["started_at"] = time.time()
            mp3_path = OUTPUT_DIR / f"{job_id}.mp3"
            run_generation(job["request"], mp3_path)
            job["status"] = "completed"
            job["completed_at"] = time.time()
            job["audio_url"] = f"/jobs/{job_id}/audio"
        except Exception as exc:
            job = jobs.get(job_id)
            if job is not None:
                job["status"] = "failed"
                job["error"] = str(exc)
                job["completed_at"] = time.time()
            print(f"generation job {job_id} failed: {exc}", flush=True)
        finally:
            job_queue.task_done()


@app.on_event("startup")
def startup() -> None:
    global pipeline
    pipeline = load_pipeline()
    threading.Thread(target=_worker, daemon=True, name="heartmula-worker").start()
    cutoff = time.time() - 24 * 60 * 60
    for path in OUTPUT_DIR.glob("*"):
        try:
            if path.is_file() and path.stat().st_mtime < cutoff:
                path.unlink()
        except OSError:
            pass
    print("HeartMuLa pipeline loaded and ready.", flush=True)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": pipeline is not None,
        "mps": torch.backends.mps.is_available(),
        "jobs": len(jobs),
    }


@app.post("/jobs", dependencies=[Depends(require_api_key)], status_code=202)
def create_job(request: GenerateRequest):
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Model is still loading")
    job_id = uuid.uuid4().hex
    jobs[job_id] = {
        "id": job_id,
        "status": "queued",
        "created_at": time.time(),
        "request": request,
    }
    job_queue.put(job_id)
    return {"id": job_id, "status": "queued"}


@app.get("/jobs/{job_id}", dependencies=[Depends(require_api_key)])
def get_job(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    response = {
        "id": job["id"],
        "status": job["status"],
        "created_at": job["created_at"],
        "started_at": job.get("started_at"),
        "completed_at": job.get("completed_at"),
        "error": job.get("error"),
        "audio_url": job.get("audio_url"),
    }
    return response


@app.get("/jobs/{job_id}/audio", dependencies=[Depends(require_api_key)])
def get_job_audio(job_id: str):
    job = jobs.get(job_id)
    path = OUTPUT_DIR / f"{job_id}.mp3"
    if not job or job.get("status") != "completed" or not path.is_file():
        raise HTTPException(status_code=404, detail="Audio not found")
    return FileResponse(path, media_type="audio/mpeg", filename=f"{job_id}.mp3")


@app.delete("/jobs/{job_id}", dependencies=[Depends(require_api_key)])
def delete_job(job_id: str):
    job = jobs.pop(job_id, None)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    (OUTPUT_DIR / f"{job_id}.mp3").unlink(missing_ok=True)
    (OUTPUT_DIR / f"{job_id}.wav").unlink(missing_ok=True)
    return {"deleted": True}


@app.post("/generate", dependencies=[Depends(require_api_key)])
def generate(request: GenerateRequest):
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Model is still loading")
    song_id = uuid.uuid4().hex
    mp3_path = OUTPUT_DIR / f"{song_id}.mp3"
    started_at = time.time()
    run_generation(request, mp3_path)
    jobs[song_id] = {
        "id": song_id,
        "status": "completed",
        "created_at": started_at,
        "started_at": started_at,
        "completed_at": time.time(),
        "request": request,
        "audio_url": f"/jobs/{song_id}/audio",
    }
    return {
        "id": song_id,
        "audio_url": f"/jobs/{song_id}/audio",
        "duration_seconds": request.duration_seconds,
    }
