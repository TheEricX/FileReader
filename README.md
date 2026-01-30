# FileReader (ExcelFlow)

Lightweight spreadsheet assistant: upload a file, browse data, and chat with an agent that can read/update the sheet via tools.

## Project layout
- `backend/app/` FastAPI server, agent logic, spreadsheet helpers
- `frontend/src/` React UI
- `legacy/` older code paths (avoid new work unless needed)

## Prerequisites
- Python 3.9+
- Node.js 18+
- (Optional) AWS credentials if using Bedrock

## Backend setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Create `backend/.env` with at least:
```
OPENAI_API_KEY=your_key_here
```
Optional if using Bedrock:
```
AWS_REGION=us-east-1
```

## Frontend setup
```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:3000` and the API at `http://localhost:8000`.

## Usage
1. Start backend and frontend.
2. Upload a spreadsheet (XLSX, XLS, CSV, TSV, ODS) or a PDF.
3. Ask questions or request edits in the chat.
4. Use **Settings** to configure model parameters per model.
5. Use **Recent Uploads** to reopen or manage previous uploads.

## Notes
- Uploaded files are stored in `backend/uploads/` (ignored by git).
- If using AWS Bedrock, ensure `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and region are configured.
