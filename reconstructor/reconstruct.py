"""Ядро реконструкции: фото + высота в метрах -> GLB-меш в реальном масштабе.

ТрипоSR выдаёт меш в каноническом пространстве Z-up («x back, y right, z up»),
нормированный на радиус 0.87 и отцентрированный у начала координат. Здесь меш
доворачивается в Y-up (three.js), опускается основанием на y=0 и масштабируется
так, чтобы высота равнялась указанной пользователем (в метрах). Фронтенд потом
сам читает реальные габариты из геометрии GLB.
"""
from __future__ import annotations

import io
import logging
import os
import sys
import threading
import time

import numpy as np
import rembg
import torch
from PIL import Image

log = logging.getLogger(__name__)

# torchmcubes подменяется реализацией на scikit-image (нет колёс под Windows/py3.13)
_FAKEMODS = os.path.join(os.path.dirname(__file__), "fakemods")
if _FAKEMODS not in sys.path:
    sys.path.insert(0, _FAKEMODS)

# в новых torch torch.load() по умолчанию weights_only=True; чекпойнт TripoSR —
# state_dict тензоров, но для надёжности разрешаем legacy-объекты
_orig_torch_load = torch.load


def _torch_load(*args, **kwargs):
    kwargs.setdefault("weights_only", False)
    return _orig_torch_load(*args, **kwargs)


torch.load = _torch_load

_TRIOSR = os.path.join(os.path.dirname(__file__), "triposr")
if _TRIOSR not in sys.path:
    sys.path.insert(0, _TRIOSR)

import trimesh  # noqa: E402
from tsr.system import TSR  # noqa: E402
from tsr.utils import remove_background, resize_foreground  # noqa: E402

_DEVICE = "cuda:0" if torch.cuda.is_available() else "cpu"

# scikit-image marching cubes на CPU: 256^3 слишком медленная, 192 — компромисс
MC_RESOLUTION = int(os.environ.get("MC_RESOLUTION", "192"))
FOREGROUND_RATIO = float(os.environ.get("FOREGROUND_RATIO", "0.85"))
CHUNK_SIZE = int(os.environ.get("CHUNK_SIZE", "8192"))
MODEL_ID = os.environ.get("TRIPOSR_MODEL", "stabilityai/TripoSR")

_model: TSR | None = None
_model_lock = threading.Lock()
_rembg_session = None


def get_model() -> TSR:
    """Лениво грузит модель один раз (включая загрузку весов из HF)."""
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                t0 = time.time()
                log.info("Загрузка модели %s на %s …", MODEL_ID, _DEVICE)
                m = TSR.from_pretrained(
                    MODEL_ID, config_name="config.yaml", weight_name="model.ckpt"
                )
                m.renderer.set_chunk_size(CHUNK_SIZE)
                m.to(_DEVICE)
                m.eval()
                _model = m
                log.info("Модель загружена за %.1f с", time.time() - t0)
    return _model


def _get_rembg_session():
    global _rembg_session
    if _rembg_session is None:
        t0 = time.time()
        log.info("Загрузка rembg-сессии (u2net) …")
        _rembg_session = rembg.new_session()
        log.info("rembg готова за %.1f с", time.time() - t0)
    return _rembg_session


def preprocess_image(image_bytes: bytes) -> Image.Image:
    """Убирает фон и центрирует объект, как в run.py у TripoSR."""
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as e:  # noqa: BLE001 — PIL.UnidentifiedImageError и др.
        raise ValueError("Файл не распознан как изображение") from e
    image = remove_background(image, _get_rembg_session())
    image = resize_foreground(image, FOREGROUND_RATIO)
    arr = np.array(image).astype(np.float32) / 255.0
    arr = arr[:, :, :3] * arr[:, :, 3:4] + (1 - arr[:, :, 3:4]) * 0.5
    return Image.fromarray((arr * 255.0).astype(np.uint8))


def reconstruct(image_bytes: bytes, height_m: float) -> trimesh.Trimesh:
    """Строит меш из фото и приводит его к реальному масштабу."""
    if not 0.1 <= height_m <= 10.0:
        raise ValueError("Высота должна быть в диапазоне 0.1–10 м")

    model = get_model()
    image = preprocess_image(image_bytes)
    device = _DEVICE

    log.info("Запуск реконструкции (resolution=%d) …", MC_RESOLUTION)
    t0 = time.time()
    with torch.no_grad():
        scene_codes = model([image], device=device)
        meshes = model.extract_mesh(scene_codes, True, resolution=MC_RESOLUTION)
    mesh = meshes[0]
    log.info("Меш построен за %.1f с (%d вершин)", time.time() - t0, len(mesh.vertices))

    mesh = _scale_to_real(mesh, height_m)
    return mesh


def _scale_to_real(mesh: trimesh.Trimesh, height_m: float) -> trimesh.Trimesh:
    """Z-up -> Y-up, основание на y=0, высота = height_m (метры)."""
    mesh = mesh.copy()
    # каноническое пространство TripoSR: +Z — «вверх»
    mesh.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0]))

    verts = mesh.vertices
    y0 = float(verts[:, 1].min())
    verts[:, 1] -= y0  # ставим основание на пол (y = 0)

    h = float(verts[:, 1].max())
    if h < 1e-4:
        raise ValueError("Не удалось определить высоту объекта (пустой меш?)")

    s = height_m / h
    mesh.vertices = verts * s
    return mesh


def export_glb(mesh: trimesh.Trimesh) -> bytes:
    buf = io.BytesIO()
    mesh.export(buf, file_type="glb")
    return buf.getvalue()
