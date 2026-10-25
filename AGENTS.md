# Instructions for AI Assistants

## Python Environment
Always use the virtual environment when running Python commands or tests in this repository.
Before running python commands, activate the virtual environment or run:
```bash
source prepare_context.sh
```
Or execute Python directly with:
```bash
PYTHONPATH=. .python_venv/bin/python ...
```
The venv is located at `.python_venv/` in the workspace root.

## Pull Requests
Always verify whether the current Pull Request has already been merged before exporting/pushing changes or assuming it is active. If the PR has already been merged, branch off `origin/main` (or rebase/create a new branch) and create a new PR.
