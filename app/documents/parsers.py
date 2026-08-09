"""
Text extraction, one function per supported file type. Kept separate
from service.py so chunking (Step 6) can re-open a stored file and
re-extract text without depending on any upload/DB logic -- extraction
is a pure "path in, text out" operation.
"""

from pypdf import PdfReader
from docx import Document as DocxDocument

from app.models.document import DocumentType


class ExtractionError(Exception):
    pass


def _extract_pdf(path: str) -> str:
    reader = PdfReader(path)
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n\n".join(pages)


def _extract_docx(path: str) -> str:
    doc = DocxDocument(path)
    return "\n".join(p.text for p in doc.paragraphs)


def _extract_plain_text(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


_EXTRACTORS = {
    DocumentType.PDF: _extract_pdf,
    DocumentType.DOCX: _extract_docx,
    DocumentType.TXT: _extract_plain_text,
    DocumentType.MD: _extract_plain_text,
}


def extract_text(path: str, file_type: DocumentType) -> str:
    extractor = _EXTRACTORS.get(file_type)
    if extractor is None:
        raise ExtractionError(f"No extractor for file type: {file_type}")

    try:
        text = extractor(path)
    except Exception as exc:
        raise ExtractionError(f"Failed to extract text: {exc}") from exc

    if not text.strip():
        raise ExtractionError("No extractable text found in document")

    return text