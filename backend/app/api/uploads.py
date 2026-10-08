import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request

from ..security import require_admin


router = APIRouter(
    prefix="/uploads",
    tags=["Imagens"],
    dependencies=[Depends(require_admin)],
)

PROJECT_ROOT = Path(__file__).resolve().parents[3]
UPLOAD_DIR = PROJECT_ROOT / "frontend" / "uploads"
MAX_IMAGE_BYTES = 5 * 1024 * 1024
IMAGE_FORMATS = {
    "image/jpeg": ("jpg", lambda data: data.startswith(b"\xff\xd8\xff")),
    "image/png": ("png", lambda data: data.startswith(b"\x89PNG\r\n\x1a\n")),
    "image/webp": (
        "webp",
        lambda data: len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP",
    ),
}


@router.post("/imagens", status_code=201)
async def salvar_imagem(request: Request):
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_IMAGE_BYTES:
                raise HTTPException(status_code=413, detail="A imagem deve ter no máximo 5 MB.")
        except ValueError:
            raise HTTPException(status_code=400, detail="Tamanho de envio inválido.") from None

    content_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    image_format = IMAGE_FORMATS.get(content_type)
    if image_format is None:
        raise HTTPException(
            status_code=415,
            detail="Formato não aceito. Envie uma imagem JPG, PNG ou WebP.",
        )

    chunks = []
    total_bytes = 0
    async for chunk in request.stream():
        total_bytes += len(chunk)
        if total_bytes > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail="A imagem deve ter no máximo 5 MB.")
        chunks.append(chunk)

    contents = b"".join(chunks)
    extension, validar_assinatura = image_format
    if not contents or not validar_assinatura(contents):
        raise HTTPException(
            status_code=400,
            detail="O arquivo não corresponde a uma imagem JPG, PNG ou WebP válida.",
        )

    filename = f"{uuid.uuid4().hex}.{extension}"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    (UPLOAD_DIR / filename).write_bytes(contents)

    return {"url": f"/uploads/{filename}"}
