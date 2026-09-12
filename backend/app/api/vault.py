"""Persistent original uploads and access to previously extracted documents."""
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlmodel import Session, select

from ..db import get_session
from ..models import SourceDocument, VaultDocument
from ..services import intake

router = APIRouter()


def info(doc):
    original = isinstance(doc, VaultDocument)
    return {
        "id": f"{'file' if original else 'source'}-{doc.id}",
        "filename": doc.filename,
        "category": doc.category if original else "Previous upload",
        "created_at": doc.created_at.isoformat() + "Z",
        "original_available": original,
    }


@router.get("/vault")
def list_documents(session: Session = Depends(get_session)):
    originals = session.exec(select(VaultDocument)).all()
    existing = {(d.filename, d.text) for d in originals}
    legacy = session.exec(select(SourceDocument)).all()
    documents = originals + [d for d in legacy if (d.filename, d.text) not in existing]
    return [info(d) for d in sorted(documents, key=lambda d: d.created_at, reverse=True)]


@router.post("/vault")
async def upload(request: Request, session: Session = Depends(get_session)):
    form = await request.form()
    file = form.get("file")
    category = form.get("category")
    if file is None or isinstance(file, str):
        raise HTTPException(422, "A file is required")
    if category not in ("Resume", "Job description", "Coursework"):
        raise HTTPException(422, "Invalid document category")
    content = await file.read()
    filename = (file.filename or "upload.txt").replace("\\", "/").split("/")[-1]
    try:
        _, text = intake.extract_text(filename, content)
    except Exception as exc:
        raise HTTPException(422, f"Could not read file: {exc}")
    doc = VaultDocument(filename=filename, category=category, content=content, text=text)
    session.add(doc)
    session.commit()
    session.refresh(doc)
    return {**info(doc), "text": text}


@router.get("/vault/{document_id}/download")
def download(document_id: str, session: Session = Depends(get_session)):
    prefix, _, raw_id = document_id.partition("-")
    if prefix not in ("file", "source") or not raw_id.isdigit():
        raise HTTPException(404, "Document not found")
    original = prefix == "file"
    doc = session.get(VaultDocument if original else SourceDocument, int(raw_id))
    if doc is None:
        raise HTTPException(404, "Document not found")
    filename = doc.filename if original else doc.filename + ".txt"
    return Response(
        content=doc.content if original else doc.text.encode("utf-8"),
        media_type="application/octet-stream" if original else "text/plain",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename, safe='')}"},
    )
