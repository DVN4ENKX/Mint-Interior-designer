"""HTTP-сервис TripoSR для Room Planner.

POST  /api/reconstruct            (multipart: image, height, name?) -> { job_id }
GET   /api/reconstruct/{id}       -> { status, size?, name?, error? }
GET   /api/reconstruct/{id}/file  -> GLB-файл (только когда status == done)

Генерация выполняется в фоновом потоке: на CPU это занимает несколько минут,
поэтому результат забирается опросом статуса.
"""
from __future__ import annotations

import logging
import os
import queue
import tempfile
import threading
import time
import uuid
from dataclasses import dataclass, field

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

import reconstruct

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
)
log = logging.getLogger("reconstructor")

OUT_DIR = os.environ.get("RECON_OUT_DIR", os.path.join(os.path.dirname(__file__), ".out"))
MAX_JOBS = int(os.environ.get("RECON_MAX_JOBS", "20"))
TMP_DIR = os.path.join(tempfile.gettempdir(), "room-planner-recon")


@dataclass
class Job:
    id: str
    status: str = "queued"  # queued | processing | done | error
    error: str | None = None
    file_path: str | None = None
    size: list[float] | None = None
    name: str | None = None
    created: float = field(default_factory=time.time)


jobs: dict[str, Job] = {}
q: "queue.Queue[str]" = queue.Queue()


def _worker() -> None:
    while True:
        job_id = q.get()
        job = jobs.get(job_id)
        if job is None:
            continue
        job.status = "processing"
        try:
            _process(job)
            job.status = "done"
        except Exception as e:  # noqa: BLE001
            log.exception("Ошибка реконструкции %s", job_id)
            job.status = "error"
            job.error = str(e)
        finally:
            pass


def _process(job: Job) -> None:
    t0 = time.time()
    with open(job.file_path, "rb") as f:
        image_bytes = f.read()
    mesh = reconstruct.reconstruct(image_bytes, job.height_m)
    glb = reconstruct.export_glb(mesh)
    out_name = os.path.join(OUT_DIR, f"{job.id}.glb")
    with open(out_name, "wb") as f:
        f.write(glb)
    job.file_path = out_name
    job.size = [round(float(v), 3) for v in mesh.extents]
    log.info("Job %s готов за %.1f с (%s)", job.id, time.time() - t0, job.size)


app = FastAPI(title="Room Planner — TripoSR")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(TMP_DIR, exist_ok=True)
    # чистим старые результаты предыдущих запусков
    for fn in os.listdir(OUT_DIR):
        try:
            os.remove(os.path.join(OUT_DIR, fn))
        except OSError:
            pass
    threading.Thread(target=_worker, daemon=True).start()
    log.info("Сервис реконструкции готов (device=%s, mc_resolution=%s)",
             reconstruct._DEVICE, reconstruct.MC_RESOLUTION)


@app.post("/api/reconstruct")
async def create_job(
    image: UploadFile = File(...),
    height: float = Form(..., description="Высота объекта в метрах"),
    name: str = Form(""),
) -> dict:
    if not 0.1 <= height <= 10.0:
        raise HTTPException(400, "height должен быть в диапазоне 0.1–10 м")
    if len(jobs) >= MAX_JOBS:
        raise HTTPException(429, "Слишком много задач, подождите")

    data = await image.read()
    if not data:
        raise HTTPException(400, "Пустой файл изображения")

    job = Job(id=uuid.uuid4().hex)
    job.name = name.strip() or image.filename or None
    job.height_m = height
    in_path = os.path.join(TMP_DIR, job.id + ".img")
    with open(in_path, "wb") as f:
        f.write(data)
    job.file_path = in_path

    jobs[job.id] = job
    q.put(job.id)
    # держим файл только для необработанных задач
    return {"job_id": job.id}


@app.get("/api/reconstruct/{job_id}")
async def job_status(job_id: str) -> dict:
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(404, "Задача не найдена")
    resp: dict = {"status": job.status}
    if job.status == "done":
        resp.update(size=job.size, name=job.name)
    if job.error:
        resp["error"] = job.error
    return resp


@app.get("/api/reconstruct/{job_id}/file")
async def job_file(job_id: str) -> FileResponse:
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(404, "Задача не найдена")
    if job.status != "done" or not job.file_path or not os.path.exists(job.file_path):
        raise HTTPException(409, "Результат ещё не готов")
    return FileResponse(
        job.file_path,
        media_type="model/gltf-binary",
        filename=f"{job.name or 'model'}.glb",
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8788")))
