from pypdf import PdfReader


def extract_pdf_text(file_path: str, max_pages: int = 50, max_chars: int = 20000) -> str:
    reader = PdfReader(file_path)
    text_chunks = []
    total_chars = 0

    for page_index, page in enumerate(reader.pages):
        if page_index >= max_pages:
            break
        page_text = page.extract_text() or ""
        if page_text:
            text_chunks.append(page_text)
            total_chars += len(page_text)
        if total_chars >= max_chars:
            break

    combined = "\n\n".join(text_chunks).strip()
    if len(combined) > max_chars:
        return combined[:max_chars]
    return combined
