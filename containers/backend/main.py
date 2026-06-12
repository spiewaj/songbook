import os
import shutil
import subprocess
import tempfile
import uuid
from typing import Optional

from fastapi import FastAPI, HTTPException, Form, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel
from google.cloud import storage

from contextlib import asynccontextmanager
import threading
import urllib.request
import urllib.error
import zipfile
from fastapi.responses import JSONResponse, RedirectResponse, FileResponse

STORAGE_URI = os.environ.get("STORAGE_URI", "gs://spiewaj-pdf-renders")

# Security: code is bundled in the Docker image at build time.
# Only data directories are fetched from user-specified branches.
CODE_DIR = "/app"
DATA_DIRS = {"songs", "songbooks"}
ALLOWED_ZIP_EXTENSIONS = {".xml", ".yaml", ".yml", ".txt", ".pdf", ".png", ".jpg", ".svg"}

class YamlRequest(BaseModel):
    yaml_content: str
    branch: str = "main"
    papersize: str = "a4"

class XmlRequest(BaseModel):
    xml_content: str
    format: str = "single"
    papersize: str = "a4"
    title: str = "Song"
    branch: str = "main"

CACHE_DIR = "/tmp/songbook_cache"
os.makedirs(CACHE_DIR, exist_ok=True)
cache_locks = {}
cache_locks_lock = threading.Lock()

def get_lock(ref: str) -> threading.Lock:
    with cache_locks_lock:
        if ref not in cache_locks:
            cache_locks[ref] = threading.Lock()
        return cache_locks[ref]

def _fetch_branch_archive(ref: str, warmup: bool = False) -> str:
    """Download and cache a GitHub archive for the given ref. Returns path to cached extraction."""
    url = f"https://github.com/spiewaj/songbook/archive/{ref}.zip"
    ref_cache_dir = os.path.join(CACHE_DIR, ref)
    etag_file = os.path.join(CACHE_DIR, f"{ref}.etag")
    
    lock = get_lock(ref)
    with lock:
        current_etag = None
        if os.path.exists(etag_file):
            with open(etag_file, "r") as f:
                current_etag = f.read().strip()
                
        # Check if zip changed using HEAD request
        req = urllib.request.Request(url, method="HEAD")
        try:
            with urllib.request.urlopen(req) as response:
                new_etag = response.headers.get("ETag")
        except Exception as e:
            if not warmup:
                if current_etag and os.path.exists(ref_cache_dir):
                    new_etag = current_etag
                elif isinstance(e, urllib.error.HTTPError) and e.code == 404:
                    raise HTTPException(status_code=404, detail=f"GitHub archive not found for branch '{ref}'")
                else:
                    raise HTTPException(status_code=500, detail=f"Failed to check GitHub archive status: {e}")
            else:
                return ""
                
        needs_download = True
        if current_etag and new_etag == current_etag and os.path.exists(ref_cache_dir):
            needs_download = False
            
        if needs_download:
            zip_path = os.path.join(CACHE_DIR, f"{ref}.zip")
            extract_temp = os.path.join(CACHE_DIR, f"{ref}_temp")
            shutil.rmtree(extract_temp, ignore_errors=True)
            
            try:
                urllib.request.urlretrieve(url, zip_path)
                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    zip_ref.extractall(extract_temp)
            except Exception as e:
                if not warmup:
                    raise HTTPException(status_code=500, detail=f"Failed to download/extract repo: {e}")
                else:
                    return ""
            finally:
                if os.path.exists(zip_path):
                    os.remove(zip_path)
                    
            extracted_dirs = [d for d in os.listdir(extract_temp) if os.path.isdir(os.path.join(extract_temp, d))]
            if len(extracted_dirs) != 1:
                shutil.rmtree(extract_temp, ignore_errors=True)
                if not warmup:
                    raise HTTPException(status_code=500, detail="Unexpected zip structure from GitHub")
                else:
                    return ""
                    
            shutil.rmtree(ref_cache_dir, ignore_errors=True)
            shutil.move(os.path.join(extract_temp, extracted_dirs[0]), ref_cache_dir)
            shutil.rmtree(extract_temp, ignore_errors=True)
            
            if new_etag:
                with open(etag_file, "w") as f:
                    f.write(new_etag)
                    
    return ref_cache_dir


def setup_work_dir(temp_dir: str) -> str:
    """Create a working directory with bundled code from the Docker image.
    
    Security: code (src/, render_pdf.sh, etc.) comes from the immutable Docker
    image, never from user-specified branches or uploads.
    """
    work_dir = os.path.join(temp_dir, "repo")
    os.makedirs(work_dir, exist_ok=True)
    
    # Copy code artifacts from the bundled image
    code_items = ["src", "render_pdf.sh", "render_epub.sh", "songbooks", "songs", "songbook.yaml"]
    for item in code_items:
        src = os.path.join(CODE_DIR, item)
        dst = os.path.join(work_dir, item)
        if os.path.exists(src):
            if os.path.isdir(src):
                shutil.copytree(src, dst, dirs_exist_ok=True)
            else:
                shutil.copy2(src, dst)
    return work_dir


def overlay_branch_data(ref: str, work_dir: str, warmup: bool = False):
    """Overlay only DATA directories (songs/, songbooks/) from a branch onto the work dir.
    
    Security: only data directories are copied. No executable code (src/, *.sh,
    *.py) from the branch is ever used.
    """
    try:
        cache_dir = _fetch_branch_archive(ref, warmup=warmup)
    except HTTPException as e:
        if e.status_code == 404 and ref != "main":
            print(f"Branch {ref} not found on upstream, falling back to 'main' branch")
            cache_dir = _fetch_branch_archive("main", warmup=warmup)
        else:
            raise e
            
    if not cache_dir:
        return
    
    # Hold the ref lock while reading from cache to prevent a concurrent
    # _fetch_branch_archive() from replacing the cache dir mid-copy.
    lock = get_lock(ref)
    with lock:
        for data_dir in DATA_DIRS:
            src = os.path.join(cache_dir, data_dir)
            dst = os.path.join(work_dir, data_dir)
            if os.path.exists(src):
                # Overlay: merge branch data on top of bundled data
                shutil.copytree(src, dst, dirs_exist_ok=True)


def safe_extract_zip(zip_path: str, target_dir: str):
    """Extract only safe data files from a zip archive.
    
    Security: rejects executable files, path traversal, and anything outside
    the allowlisted extensions.
    """
    with zipfile.ZipFile(zip_path, 'r') as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            # Block path traversal
            normalized = os.path.normpath(info.filename)
            if normalized.startswith("..") or normalized.startswith("/"):
                print(f"Zip security: skipping path traversal attempt: {info.filename}")
                continue
            # Block non-data extensions
            _, ext = os.path.splitext(info.filename.lower())
            if ext not in ALLOWED_ZIP_EXTENSIONS:
                print(f"Zip security: skipping disallowed extension: {info.filename}")
                continue
            # Safe to extract
            zf.extract(info, target_dir)

@asynccontextmanager
async def lifespan(app: FastAPI):
    def warmup():
        try:
            _fetch_branch_archive("main", warmup=True)
        except Exception as e:
            print(f"Warmup failed: {e}")
    threading.Thread(target=warmup).start()
    yield

app = FastAPI(title="Songbook PDF Backend", lifespan=lifespan)

# Allow CORS for the editor
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# TODO: For the future: The requirement to validate whether .tex is actually renderable 
# is currently NOT on the synchronous feedback path (it happens async via pdflatex). 
# Eventually, we would like to move this validation to the synchronous path.

def upload_result(local_path: str, destination_name: str, content_type: str):
    try:
        if STORAGE_URI.startswith("gs://"):
            bucket_name = STORAGE_URI[5:]
            client = storage.Client()
            bucket = client.bucket(bucket_name)
            blob = bucket.blob(destination_name)
            blob.upload_from_filename(local_path, content_type=content_type)
        else:
            local_dir = STORAGE_URI
            if STORAGE_URI.startswith("file://"):
                local_dir = STORAGE_URI[7:]
            os.makedirs(local_dir, exist_ok=True)
            dest_path = os.path.join(local_dir, destination_name)
            shutil.copy2(local_path, dest_path)
    except Exception as e:
        print(f"Upload failed: {e}")

def background_compile(temp_dir: str, job_id: str, render_cmd: list):
    try:
        repo_dir = os.path.join(temp_dir, "repo")
        env = os.environ.copy()
        env["JOB"] = job_id
        
        process = subprocess.run(
            render_cmd,
            cwd=repo_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            env=env
        )
        
        if process.returncode == 0:
            import glob
            pdf_files = glob.glob(os.path.join(repo_dir, "build", "songs_tex", "*.pdf"))
            if pdf_files:
                upload_result(pdf_files[0], f"{job_id}.pdf", "application/pdf")
            else:
                # PDF missing despite 0 exit code
                log_path = os.path.join(temp_dir, f"{job_id}.log")
                with open(log_path, "w") as f:
                    f.write(f"PDF not found.\n\n{process.stdout}")
                upload_result(log_path, f"{job_id}.log", "text/plain")
        else:
            log_path = os.path.join(temp_dir, f"{job_id}.log")
            with open(log_path, "w") as f:
                f.write(process.stdout)
            upload_result(log_path, f"{job_id}.log", "text/plain")
            
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

@app.post("/api/render/songbook_yaml")
async def render_songbook_yaml(request: YamlRequest, background_tasks: BackgroundTasks):
    job_id = f"job_{uuid.uuid4().hex[:8]}"
    temp_dir = tempfile.mkdtemp(prefix="songbook_")
    work_dir = setup_work_dir(temp_dir)
    overlay_branch_data(request.branch, work_dir)
    
    yaml_path = os.path.join(work_dir, "songbooks", "custom.yaml")
    with open(yaml_path, "w", encoding="utf-8") as f:
        f.write(request.yaml_content)
        
    # Synchronous check
    python_cmd = ["python3", "src/latex/songbook2tex.py", request.papersize, "songbooks/custom.yaml"]
    env = os.environ.copy()
    env["PYTHONPATH"] = work_dir
    process = subprocess.run(python_cmd, cwd=work_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
    
    if process.returncode != 0:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=f"Python generation failed: {process.stderr}")
        
    render_cmd = ["bash", "./render_pdf.sh", request.papersize, "songbooks/custom.yaml"]
    background_tasks.add_task(background_compile, temp_dir, job_id, render_cmd)
    
    return {"job_id": job_id, "status": 200}

@app.post("/api/render/song_xml")
async def render_song_xml(request: XmlRequest, background_tasks: BackgroundTasks):
    job_id = f"job_{uuid.uuid4().hex[:8]}"
    temp_dir = tempfile.mkdtemp(prefix="songbook_")
    work_dir = setup_work_dir(temp_dir)
    # We do not overlay branch data for a single song render
    # because the song is fully provided in xml_content
    # and all LaTeX templates are already bundled in the Docker image.
    
    xml_path = os.path.join(work_dir, "custom.xml")
    with open(xml_path, "w", encoding="utf-8") as f:
        f.write(request.xml_content)
        
    # Synchronous check
    python_cmd = ["python3", "src/latex/songs2tex.py", request.format, request.papersize, request.title, "custom.xml"]
    env = os.environ.copy()
    env["PYTHONPATH"] = work_dir
    process = subprocess.run(python_cmd, cwd=work_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
    
    if process.returncode != 0:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=f"Python generation failed: {process.stderr}")
        
    render_cmd = ["bash", "./render_pdf.sh", request.format, request.papersize, request.title, "custom.xml"]
    background_tasks.add_task(background_compile, temp_dir, job_id, render_cmd)
    
    return {"job_id": job_id, "status": 200}

@app.post("/api/render/songbook_zip")
async def render_songbook_zip(
    background_tasks: BackgroundTasks,
    branch: str = Form("main"),
    papersize: str = Form("a4"),
    zip_file: UploadFile = File(...)
):
    job_id = f"job_{uuid.uuid4().hex[:8]}"
    temp_dir = tempfile.mkdtemp(prefix="songbook_")
    work_dir = setup_work_dir(temp_dir)
    overlay_branch_data(branch, work_dir)
    
    zip_path = os.path.join(temp_dir, "upload.zip")
    with open(zip_path, "wb") as f:
        f.write(await zip_file.read())
        
    # Security: only extract safe data files from the uploaded zip
    try:
        safe_extract_zip(zip_path, work_dir)
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=f"Failed to unzip payload: {e}")
    finally:
        if os.path.exists(zip_path):
            os.remove(zip_path)
        
    if not os.path.exists(os.path.join(work_dir, "songbook.yaml")):
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail="songbook.yaml not found at root of the zip archive")
        
    # Synchronous check
    python_cmd = ["python3", "src/latex/songbook2tex.py", papersize, "songbook.yaml"]
    env = os.environ.copy()
    env["PYTHONPATH"] = work_dir
    process = subprocess.run(python_cmd, cwd=work_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
    
    if process.returncode != 0:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=f"Python generation failed: {process.stderr}")
        
    render_cmd = ["bash", "./render_pdf.sh", papersize, "songbook.yaml"]
    background_tasks.add_task(background_compile, temp_dir, job_id, render_cmd)
    
    return {"job_id": job_id, "status": 200}

@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str):
    try:
        if STORAGE_URI.startswith("gs://"):
            bucket_name = STORAGE_URI[5:]
            client = storage.Client()
            bucket = client.bucket(bucket_name)
            
            pdf_blob = bucket.blob(f"{job_id}.pdf")
            if pdf_blob.exists():
                return {"status": "done", "url": f"/api/jobs/{job_id}/download"}
                
            log_blob = bucket.blob(f"{job_id}.log")
            if log_blob.exists():
                log_content = log_blob.download_as_text()
                return {"status": "error", "log": log_content}
        else:
            local_dir = STORAGE_URI
            if STORAGE_URI.startswith("file://"):
                local_dir = STORAGE_URI[7:]
            if os.path.exists(os.path.join(local_dir, f"{job_id}.pdf")):
                return {"status": "done", "url": f"/api/jobs/{job_id}/download"}
                    
            log_path = os.path.join(local_dir, f"{job_id}.log")
            if os.path.exists(log_path):
                with open(log_path, "r") as f:
                    return {"status": "error", "log": f.read()}
                    
        return {"status": "processing"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check storage: {e}")

@app.get("/api/jobs/{job_id}/download")
async def download_job(job_id: str, filename: Optional[str] = None, disposition: str = "inline"):
    dl_filename = filename if filename else f"{job_id}.pdf"
    if not dl_filename.endswith(".pdf"):
        dl_filename += ".pdf"
        
    if STORAGE_URI.startswith("gs://"):
        bucket_name = STORAGE_URI[5:]
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(f"{job_id}.pdf")
        if blob.exists():
            pdf_bytes = blob.download_as_bytes()
            from fastapi import Response
            import urllib.parse
            encoded_filename = urllib.parse.quote(dl_filename)
            headers = {"Content-Disposition": f"{disposition}; filename*=UTF-8''{encoded_filename}"}
            return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)
    else:
        local_dir = STORAGE_URI
        if STORAGE_URI.startswith("file://"):
            local_dir = STORAGE_URI[7:]
        pdf_path = os.path.join(local_dir, f"{job_id}.pdf")
        if os.path.exists(pdf_path):
            headers = {"Content-Disposition": f"{disposition}; filename=\"{dl_filename}\""}
            return FileResponse(pdf_path, media_type="application/pdf", filename=dl_filename, headers=headers)
            
    raise HTTPException(status_code=404, detail="File not found")
