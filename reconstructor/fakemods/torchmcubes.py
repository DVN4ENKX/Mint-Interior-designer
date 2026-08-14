"""Замена torchmcubes реализацией на scikit-image.

torchmcubes не имеет готовых колёс под Windows + Python 3.13 (сборка из
исходников требует MSVC, которого нет на машине). TripoSR делает
`from torchmcubes import marching_cubes` в tsr/models/isosurface.py — этот
модуль подставляется в sys.path до импорта tsr и повторяет тот же API.

Соглашения совпадают с torchmcubes: входной воксельный массив (D,H,W),
вершины возвращаются в порядке (z, y, x) — это ожидает
MarchingCubeHelper.forward (там делается v_pos[..., [2, 1, 0]]).
"""
from __future__ import annotations

import numpy as np
import torch
from skimage import measure


def marching_cubes(volume, level=0.0, **kwargs):
    """Возвращает (verts, faces) в стиле torchmcubes.

    volume: torch.Tensor или np.ndarray формы (D, H, W).
    """
    if isinstance(volume, torch.Tensor):
        device = volume.device
        vol = volume.detach().cpu().numpy()
    else:
        device = None
        vol = np.asarray(volume)

    verts, faces, _normals, _values = measure.marching_cubes(vol, level=float(level), **kwargs)

    # np.array(...) форсирует копию: skimage может вернуть view с отрицательным
    # stride, а torch.from_numpy такое не принимает
    v = torch.from_numpy(np.array(verts, dtype=np.float32))
    f = torch.from_numpy(np.array(faces, dtype=np.int64))
    if device is not None:
        v, f = v.to(device), f.to(device)
    return v, f
