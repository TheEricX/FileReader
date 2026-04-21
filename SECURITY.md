# Security Notes

## Secrets
- Do not commit real credentials to this repository.
- Copy `backend/.env.example` to `backend/.env` and fill in your own values locally.
- Copy `frontend/.env.example` to `frontend/.env` only if you need local overrides.

## Before Making The Repo Public
- Rotate any credentials that have ever lived in local `.env` files on this machine.
- Confirm `git status` does not include `.env`, uploaded files, or local databases.
- Review staged changes with `git diff --staged` before pushing.
- Enable GitHub secret scanning and push protection for the repository.

## If A Secret Was Committed Previously
- Revoke or rotate the secret immediately.
- Remove it from the current branch and Git history before making the repository public.
