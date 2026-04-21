# ExcelFlow

ExcelFlow is a local AI workspace for spreadsheets and documents. You can upload files, inspect their contents in the browser, and chat with an agent that can analyze data, answer questions, and in the spreadsheet workflow make tool-driven edits.

## What It Does
- Upload and inspect spreadsheets in the browser.
- Chat with an agent about spreadsheet, PDF, and DOCX content.
- Use a workspace-first flow with separate `ExcelFlow` and `Gemini` workspaces.
- Reopen previous uploads from workspace-aware history views.
- Stream responses over WebSocket while the FastAPI backend handles file processing and model calls.

## Supported Files
- Spreadsheet: `xlsx`, `xls`, `csv`, `tsv`, `ods`, `fods`, `xlsm`, `xltx`, `xltm`
- PDF: `pdf`
- Document: `docx`

## Tech Stack
- Backend: FastAPI
- Frontend: React + Vite
- AI providers: OpenAI, AWS Bedrock, Gemini
- Persistence: local SQLite for upload and session history

## Project Structure
- `backend/app/`: FastAPI server, agent logic, file parsing, persistence
- `frontend/src/`: React application and UI components
- `backend/uploads/`: local uploaded files, ignored by git
- `legacy/`: older code paths kept for reference

## Quick Start

### 1. Prerequisites
- Python 3.9+
- Node.js 18+
- An OpenAI API key for the default OpenAI-backed flows
- Optional: AWS credentials for Bedrock
- Optional: a Gemini API key for the Gemini workspace

### 2. Backend setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` and set the values you need.

Required for the standard OpenAI flow:
```env
OPENAI_API_KEY=your_openai_api_key_here
```

Optional for AWS Bedrock:
```env
AWS_ACCESS_KEY_ID=your_aws_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key_here
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=your_bedrock_model_id_here
```

Optional for Gemini:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Frontend setup
```bash
cd frontend
npm install
```

Optional local frontend overrides:
```bash
cp .env.example .env
```

Default values:
```env
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_BASE_URL=ws://localhost:8000
```

If `frontend/.env` is not set, the frontend uses the local Vite proxy for `/api/*` and derives the WebSocket host from the current page.

## Run Locally

Start the backend:
```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload
```

Start the frontend in a second terminal:
```bash
cd frontend
npm run dev
```

Local URLs:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`

## How To Use It
1. Start backend and frontend.
2. Open the home hub and choose `ExcelFlow` or `Gemini`.
3. Upload a spreadsheet, PDF, or DOCX file.
4. Ask questions in chat or request spreadsheet edits.
5. Reopen recent uploads from the home hub or manage uploads within a workspace.

## Workspace Overview

### ExcelFlow workspace
- Focused on spreadsheet-first work.
- Supports spreadsheet uploads plus document-oriented flows exposed by the app.
- Uses OpenAI or Bedrock-backed model options in the current UI.

### Gemini workspace
- Separate workspace with Gemini model options.
- Supports spreadsheet, PDF, and DOCX analysis.
- Includes image attachment support for Gemini chat flows.

## Architecture
```text
browser (React/Vite) -> REST upload + fetch
browser (React/Vite) <-> WebSocket
                    -> FastAPI (`backend/app/main.py`)
                               -> spreadsheet / PDF / DOCX parsing
                               -> OpenAI / Bedrock / Gemini agents
                               -> local uploads + SQLite persistence
```

## Development Notes
- Backend entrypoint: `backend/app/main.py`
- Frontend entrypoint: `frontend/src/App.jsx`
- Uploaded files are stored in `backend/uploads/`
- Session and upload metadata are stored locally by the backend

Useful commands:
```bash
# frontend
cd frontend
npm run dev
npm run build
npm run lint

# backend
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload
```

## Troubleshooting
- If the frontend cannot reach the backend, confirm the backend is running on `http://localhost:8000`.
- If model calls fail immediately, check that the corresponding API key is present in `backend/.env`.
- If WebSocket features fail in development, verify `VITE_WS_BASE_URL` or fall back to the default local setup.
- If uploads do not appear, check `backend/uploads/` permissions and confirm the file format is supported.

## Limitations
- This repository does not currently include an automated test suite.
- CORS is permissive in local development and should be tightened for production use.
- Uploaded files and local session data are stored on disk by the backend.
