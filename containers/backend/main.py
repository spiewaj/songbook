import os
import shutil
import subprocess
import tempfile
import uuid
from typing import Optional

from fastapi import FastAPI, HTTPException, Form, UploadFile, File, BackgroundTasks
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

def download_repo(ref: str, temp_dir: str, warmup: bool = False) -> str:
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
                    
    if warmup:
        return ref_cache_dir
        
    repo_dir = os.path.join(temp_dir, "repo")
    shutil.copytree(ref_cache_dir, repo_dir)
    return repo_dir

@asynccontextmanager
async def lifespan(app: FastAPI):
    def warmup():
        try:
            download_repo("main", "", warmup=True)
        except Exception as e:
            print(f"Warmup failed: {e}")
    threading.Thread(target=warmup).start()
    yield

app = FastAPI(title="Songbook PDF Backend", lifespan=lifespan)

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
    repo_dir = download_repo(request.branch, temp_dir)
    
    yaml_path = os.path.join(repo_dir, "custom.yaml")
    with open(yaml_path, "w", encoding="utf-8") as f:
        f.write(request.yaml_content)
        
    # Synchronous check
    python_cmd = ["python3", "src/latex/songbook2tex.py", request.papersize, "custom.yaml"]
    env = os.environ.copy()
    env["PYTHONPATH"] = repo_dir
    process = subprocess.run(python_cmd, cwd=repo_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
    
    if process.returncode != 0:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=f"Python generation failed: {process.stderr}")
        
    render_cmd = ["bash", "./render_pdf.sh", request.papersize, "custom.yaml"]
    background_tasks.add_task(background_compile, temp_dir, job_id, render_cmd)
    
    return {"job_id": job_id, "status": 200}

@app.post("/api/render/song_xml")
async def render_song_xml(request: XmlRequest, background_tasks: BackgroundTasks):
    job_id = f"job_{uuid.uuid4().hex[:8]}"
    temp_dir = tempfile.mkdtemp(prefix="songbook_")
    repo_dir = download_repo(request.branch, temp_dir)
    
    xml_path = os.path.join(repo_dir, "custom.xml")
    with open(xml_path, "w", encoding="utf-8") as f:
        f.write(request.xml_content)
        
    # Synchronous check
    python_cmd = ["python3", "src/latex/songs2tex.py", request.format, request.papersize, request.title, "custom.xml"]
    env = os.environ.copy()
    env["PYTHONPATH"] = repo_dir
    process = subprocess.run(python_cmd, cwd=repo_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
    
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
    repo_dir = download_repo(branch, temp_dir)
    
    zip_path = os.path.join(temp_dir, "upload.zip")
    with open(zip_path, "wb") as f:
        f.write(await zip_file.read())
        
    # Unzip over repo
    import zipfile
    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(repo_dir)
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=f"Failed to unzip payload: {e}")
        
    if not os.path.exists(os.path.join(repo_dir, "songbook.yaml")):
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail="songbook.yaml not found at root of the zip archive")
        
    # Synchronous check
    python_cmd = ["python3", "src/latex/songbook2tex.py", papersize, "songbook.yaml"]
    env = os.environ.copy()
    env["PYTHONPATH"] = repo_dir
    process = subprocess.run(python_cmd, cwd=repo_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
    
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
async def download_job(job_id: str):
    if STORAGE_URI.startswith("gs://"):
        bucket_name = STORAGE_URI[5:]
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(f"{job_id}.pdf")
        if blob.exists():
            pdf_bytes = blob.download_as_bytes()
            from fastapi import Response
            return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={job_id}.pdf"})
    else:
        local_dir = STORAGE_URI
        if STORAGE_URI.startswith("file://"):
            local_dir = STORAGE_URI[7:]
        pdf_path = os.path.join(local_dir, f"{job_id}.pdf")
        if os.path.exists(pdf_path):
            return FileResponse(pdf_path, media_type="application/pdf", filename=f"{job_id}.pdf")
            
    raise HTTPException(status_code=404, detail="File not found")
