# Python-сервис TripoSR: генерация 3D из фото (CPU-only)
# Torch ставится из официального CPU-индекса (в requirements.txt его нет —
# на хосте он тоже ставился отдельно, CPU-вариант).
FROM python:3.13-slim

WORKDIR /app

# opencv, который тянет rembg, требует системные библиотеки
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

# torch для CPU (~200 МБ; CUDA-вариант из PyPI занимал бы ~3 ГБ)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# исходники сервиса + TripoSR (.venv/.out/.logs исключены через .dockerignore)
COPY app.py reconstruct.py ./
COPY fakemods ./fakemods
COPY triposr ./triposr

# веса TripoSR (~700 МБ) и u2net (~170 МБ) качаются при первом запуске
# и живут на томе recon_cache, чтобы перезапуск не качал их заново
ENV HF_HOME=/root/.cache/huggingface \
    U2NET_HOME=/root/.cache/u2net \
    PORT=8788 \
    MC_RESOLUTION=192

EXPOSE 8788

CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8788"]
