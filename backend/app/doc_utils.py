from docx import Document


def extract_docx_text(file_path: str) -> str:
    doc = Document(file_path)
    lines = []
    for paragraph in doc.paragraphs:
        text = paragraph.text.strip()
        if text:
            lines.append(text)
    return "\n\n".join(lines)
