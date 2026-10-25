import json
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
    papersize: str = "a5"
    songbook_id: Optional[str] = None
    is_published: bool = False


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
                shutil.copytree(src, dst, dirs_exist_ok=True, symlinks=True, ignore_dangling_symlinks=True)
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

def background_compile(temp_dir: str, job_id: str, render_cmd: list, publish_info: Optional[dict] = None):
    try:
        repo_dir = os.path.join(temp_dir, "repo")
        os.makedirs(os.path.join(repo_dir, "build"), exist_ok=True)
        env = os.environ.copy()
        env["JOB"] = job_id
        env["PYTHONPATH"] = repo_dir
        
        process = subprocess.run(
            render_cmd,
            cwd=repo_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=env
        )
        
        if process.returncode == 0:
            import glob
            pdf_files = glob.glob(os.path.join(repo_dir, "build", "songs_tex", "*.pdf"))
            epub_files = glob.glob(os.path.join(repo_dir, "build", "*.epub"))
            if pdf_files:
                upload_result(pdf_files[0], f"{job_id}.pdf", "application/pdf")
                if publish_info and publish_info.get("songbook_id") and publish_info.get("is_published"):
                    sb_id = publish_info["songbook_id"]
                    papersize = publish_info.get("papersize", "a5").lower()
                    pub_filename = f"{papersize}.pdf"
                    upload_result(pdf_files[0], f"published/{sb_id}/{pub_filename}", "application/pdf")
                    # Save permanent URL metadata in temporary job file
                    meta_path = os.path.join(temp_dir, f"{job_id}.json")
                    with open(meta_path, "w", encoding="utf-8") as f:
                        json.dump({"published_url": f"/api/published/{sb_id}/{pub_filename}", "format": "pdf"}, f)
                    upload_result(meta_path, f"{job_id}.json", "application/json")
            elif epub_files:
                upload_result(epub_files[0], f"{job_id}.epub", "application/epub+zip")
                if publish_info and publish_info.get("songbook_id") and publish_info.get("is_published"):
                    sb_id = publish_info["songbook_id"]
                    upload_result(epub_files[0], f"published/{sb_id}/songbook.epub", "application/epub+zip")
                    meta_path = os.path.join(temp_dir, f"{job_id}.json")
                    with open(meta_path, "w", encoding="utf-8") as f:
                        json.dump({"published_url": f"/api/published/{sb_id}/songbook.epub", "format": "epub"}, f)
                    upload_result(meta_path, f"{job_id}.json", "application/json")
            else:
                # File missing despite 0 exit code
                log_path = os.path.join(temp_dir, f"{job_id}.log")
                with open(log_path, "w", encoding="utf-8", errors="replace") as f:
                    f.write(f"Output artifact not found.\n\n{process.stdout}")
                upload_result(log_path, f"{job_id}.log", "text/plain")
        else:
            log_path = os.path.join(temp_dir, f"{job_id}.log")
            with open(log_path, "w", encoding="utf-8", errors="replace") as f:
                f.write(process.stdout)
            upload_result(log_path, f"{job_id}.log", "text/plain")
            
    except Exception as e:
        import traceback
        err_msg = f"Compilation exception: {e}\n\n{traceback.format_exc()}"
        print(f"[{job_id}] {err_msg}")
        log_path = os.path.join(temp_dir, f"{job_id}.log")
        try:
            with open(log_path, "w", encoding="utf-8", errors="replace") as f:
                f.write(err_msg)
            upload_result(log_path, f"{job_id}.log", "text/plain")
        except Exception as upload_err:
            print(f"[{job_id}] Failed to upload error log: {upload_err}")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

def prepare_songbook_image(yaml_path: str, work_dir: str):
    try:
        import yaml
        import urllib.request
        with open(yaml_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        if not data or "songbook" not in data:
            return

        sb_data = data["songbook"]
        sb_id = sb_data.get("id")

        # Ensure custom songbooks render correct reader URL in PDF footer and QR code
        if sb_id and sb_id != "default_all":
            curr_url = (sb_data.get("url") or "").strip()
            if not curr_url or curr_url in (
                f"https://spiewaj.com#{sb_id}",
                f"https://spiewaj.com/#{sb_id}",
                f"https://spiewaj.com/index.html#songbook={sb_id}",
                f"https://spiewaj.com/index.html#{sb_id}",
                f"https://spiewaj.com/#songbook={sb_id}",
                f"https://spiewaj.com/#{sb_id.lower()}",
                f"https://spiewaj.com#{sb_id.lower()}",
                "https://spiewaj.com",
                "https://spiewaj.com/",
            ):
                sb_data["url"] = f"https://spiewaj.com#{sb_id}"

        if "image" in sb_data:
            img_spec = sb_data["image"]
            if isinstance(img_spec, dict) and "url" in img_spec and img_spec["url"]:
                img_url = img_spec["url"]
                name_or_url = (img_spec.get("name", "") + " " + img_url).lower()
                req = urllib.request.Request(img_url, headers={"User-Agent": "SpiewajSongbook/1.0"})
                with urllib.request.urlopen(req, timeout=15) as resp:
                    raw_bytes = resp.read()

                if ".jpg" in name_or_url or ".jpeg" in name_or_url:
                    dest_name = "cover_image.jpg"
                    dest_path = os.path.join(work_dir, dest_name)
                    with open(dest_path, "wb") as out:
                        out.write(raw_bytes)
                    sb_data["image"]["jpg"] = dest_name
                    sb_data["image"]["pdf"] = dest_name
                elif ".pdf" in name_or_url:
                    dest_name = "cover_image.pdf"
                    dest_path = os.path.join(work_dir, dest_name)
                    with open(dest_path, "wb") as out:
                        out.write(raw_bytes)
                    sb_data["image"]["pdf"] = dest_name
                elif ".svg" in name_or_url:
                    try:
                        import cairosvg
                        dest_name = "cover_image.pdf"
                        dest_path = os.path.join(work_dir, dest_name)
                        cairosvg.svg2pdf(bytestring=raw_bytes, write_to=dest_path)
                        sb_data["image"]["pdf"] = dest_name
                        sb_data["image"]["svg"] = dest_name
                    except Exception as ex:
                        print(f"Could not convert SVG to PDF: {ex}")
                elif ".webp" in name_or_url:
                    try:
                        from PIL import Image
                        import io
                        dest_name = "cover_image.png"
                        dest_path = os.path.join(work_dir, dest_name)
                        with Image.open(io.BytesIO(raw_bytes)) as im:
                            im.convert("RGB").save(dest_path, "PNG")
                        sb_data["image"]["png"] = dest_name
                        sb_data["image"]["pdf"] = dest_name
                    except Exception as ex:
                        print(f"Could not convert WEBP to PNG: {ex}")
                else:
                    dest_name = "cover_image.png"
                    dest_path = os.path.join(work_dir, dest_name)
                    with open(dest_path, "wb") as out:
                        out.write(raw_bytes)
                    sb_data["image"]["png"] = dest_name
                    sb_data["image"]["pdf"] = dest_name

        with open(yaml_path, "w", encoding="utf-8") as f:
            yaml.dump(data, f)
    except Exception as e:
        print(f"Warning: could not process songbook assets/url: {e}")

class EpubRequest(BaseModel):
    yaml_content: str
    branch: str = "main"
    songbook_id: Optional[str] = None
    is_published: bool = False

@app.post("/api/render/songbook_epub")
async def render_songbook_epub(request: EpubRequest, background_tasks: BackgroundTasks):
    job_id = f"job_{uuid.uuid4().hex[:8]}"
    temp_dir = tempfile.mkdtemp(prefix="songbook_epub_")
    work_dir = setup_work_dir(temp_dir)
    overlay_branch_data(request.branch, work_dir)
    
    yaml_path = os.path.join(work_dir, "songbooks", "custom.yaml")
    with open(yaml_path, "w", encoding="utf-8") as f:
        f.write(request.yaml_content)
    prepare_songbook_image(yaml_path, work_dir)
        
    publish_info = None
    if request.songbook_id and request.is_published:
        publish_info = {
            "songbook_id": request.songbook_id,
            "is_published": True,
            "artifact_type": "epub"
        }

    render_cmd = ["python3", "src/epub/create_epub.py", "songbooks/custom.yaml"]
    background_tasks.add_task(background_compile, temp_dir, job_id, render_cmd, publish_info)
    
    return {"job_id": job_id, "status": 200}

@app.post("/api/render/songbook_yaml")
async def render_songbook_yaml(request: YamlRequest, background_tasks: BackgroundTasks):
    job_id = f"job_{uuid.uuid4().hex[:8]}"
    temp_dir = tempfile.mkdtemp(prefix="songbook_")
    work_dir = setup_work_dir(temp_dir)
    overlay_branch_data(request.branch, work_dir)
    
    yaml_path = os.path.join(work_dir, "songbooks", "custom.yaml")
    with open(yaml_path, "w", encoding="utf-8") as f:
        f.write(request.yaml_content)
    prepare_songbook_image(yaml_path, work_dir)
        
    # Synchronous check
    python_cmd = ["python3", "src/latex/songbook2tex.py", request.papersize, "songbooks/custom.yaml"]
    env = os.environ.copy()
    env["PYTHONPATH"] = work_dir
    process = subprocess.run(python_cmd, cwd=work_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace", env=env)
    
    if process.returncode != 0:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=f"Python generation failed: {process.stderr}")
        
    publish_info = None
    if request.songbook_id and request.is_published:
        publish_info = {
            "songbook_id": request.songbook_id,
            "is_published": True,
            "papersize": request.papersize
        }

    render_cmd = ["bash", "./render_pdf.sh", request.papersize, "songbooks/custom.yaml"]
    background_tasks.add_task(background_compile, temp_dir, job_id, render_cmd, publish_info)
    
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
    process = subprocess.run(python_cmd, cwd=work_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace", env=env)
    
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
    papersize: str = Form("a5"),
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
    process = subprocess.run(python_cmd, cwd=work_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace", env=env)
    
    if process.returncode != 0:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=f"Python generation failed: {process.stderr}")
        
    render_cmd = ["bash", "./render_pdf.sh", papersize, "songbook.yaml"]
    background_tasks.add_task(background_compile, temp_dir, job_id, render_cmd)
    
    return {"job_id": job_id, "status": 200}

@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str):
    try:
        import json
        published_url = None
        if STORAGE_URI.startswith("gs://"):
            bucket_name = STORAGE_URI[5:]
            client = storage.Client()
            bucket = client.bucket(bucket_name)
            
            meta_blob = bucket.blob(f"{job_id}.json")
            if meta_blob.exists():
                try:
                    meta_data = json.loads(meta_blob.download_as_text())
                    published_url = meta_data.get("published_url")
                except Exception:
                    pass

            pdf_blob = bucket.blob(f"{job_id}.pdf")
            if pdf_blob.exists():
                res = {"status": "done", "url": f"/api/jobs/{job_id}/download", "format": "pdf"}
                if published_url:
                    res["published_url"] = published_url
                return res
                
            epub_blob = bucket.blob(f"{job_id}.epub")
            if epub_blob.exists():
                res = {"status": "done", "url": f"/api/jobs/{job_id}/download", "format": "epub"}
                if published_url:
                    res["published_url"] = published_url
                return res

            log_blob = bucket.blob(f"{job_id}.log")
            if log_blob.exists():
                log_content = log_blob.download_as_text()
                return {"status": "error", "log": log_content}
        else:
            local_dir = STORAGE_URI
            if STORAGE_URI.startswith("file://"):
                local_dir = STORAGE_URI[7:]

            meta_path = os.path.join(local_dir, f"{job_id}.json")
            if os.path.exists(meta_path):
                try:
                    with open(meta_path, "r", encoding="utf-8") as f:
                        meta_data = json.load(f)
                    published_url = meta_data.get("published_url")
                except Exception:
                    pass

            if os.path.exists(os.path.join(local_dir, f"{job_id}.pdf")):
                res = {"status": "done", "url": f"/api/jobs/{job_id}/download", "format": "pdf"}
                if published_url:
                    res["published_url"] = published_url
                return res
            if os.path.exists(os.path.join(local_dir, f"{job_id}.epub")):
                res = {"status": "done", "url": f"/api/jobs/{job_id}/download", "format": "epub"}
                if published_url:
                    res["published_url"] = published_url
                return res
                    
            log_path = os.path.join(local_dir, f"{job_id}.log")
            if os.path.exists(log_path):
                with open(log_path, "r") as f:
                    return {"status": "error", "log": f.read()}
                    
        return {"status": "processing"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check storage: {e}")


@app.get("/api/jobs/{job_id}/download")
async def download_job(job_id: str, filename: Optional[str] = None, disposition: str = "inline"):
    from fastapi import Response
    import urllib.parse

    if STORAGE_URI.startswith("gs://"):
        bucket_name = STORAGE_URI[5:]
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)

        pdf_blob = bucket.blob(f"{job_id}.pdf")
        if pdf_blob.exists():
            dl_filename = filename if filename else f"{job_id}.pdf"
            if not dl_filename.endswith(".pdf"):
                dl_filename += ".pdf"
            pdf_bytes = pdf_blob.download_as_bytes()
            encoded_filename = urllib.parse.quote(dl_filename)
            headers = {"Content-Disposition": f"{disposition}; filename*=UTF-8''{encoded_filename}"}
            return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)

        epub_blob = bucket.blob(f"{job_id}.epub")
        if epub_blob.exists():
            dl_filename = filename if filename else f"{job_id}.epub"
            if not dl_filename.endswith(".epub"):
                dl_filename += ".epub"
            epub_bytes = epub_blob.download_as_bytes()
            encoded_filename = urllib.parse.quote(dl_filename)
            headers = {"Content-Disposition": f"{disposition}; filename*=UTF-8''{encoded_filename}"}
            return Response(content=epub_bytes, media_type="application/epub+zip", headers=headers)
    else:
        local_dir = STORAGE_URI
        if STORAGE_URI.startswith("file://"):
            local_dir = STORAGE_URI[7:]

        pdf_path = os.path.join(local_dir, f"{job_id}.pdf")
        if os.path.exists(pdf_path):
            dl_filename = filename if filename else f"{job_id}.pdf"
            if not dl_filename.endswith(".pdf"):
                dl_filename += ".pdf"
            headers = {"Content-Disposition": f"{disposition}; filename=\"{dl_filename}\""}
            return FileResponse(pdf_path, media_type="application/pdf", filename=dl_filename, headers=headers)

        epub_path = os.path.join(local_dir, f"{job_id}.epub")
        if os.path.exists(epub_path):
            dl_filename = filename if filename else f"{job_id}.epub"
            if not dl_filename.endswith(".epub"):
                dl_filename += ".epub"
            headers = {"Content-Disposition": f"{disposition}; filename=\"{dl_filename}\""}
            return FileResponse(epub_path, media_type="application/epub+zip", filename=dl_filename, headers=headers)

    raise HTTPException(status_code=404, detail="File not found")


@app.get("/api/published/{songbook_id}/{artifact_name}")
async def download_published(
    songbook_id: str,
    artifact_name: str,
    filename: Optional[str] = None,
    disposition: str = "inline"
):
    import urllib.parse
    from fastapi import Response

    if ".." in songbook_id or "/" in songbook_id or "\\" in songbook_id:
        raise HTTPException(status_code=400, detail="Invalid songbook ID")

    normalized = artifact_name.lower()
    if normalized in ["a5", "a5.pdf"]:
        target_path = f"published/{songbook_id}/a5.pdf"
        default_fn = f"{songbook_id}_A5.pdf"
        media_type = "application/pdf"
    elif normalized in ["a4", "a4.pdf"]:
        target_path = f"published/{songbook_id}/a4.pdf"
        default_fn = f"{songbook_id}_A4.pdf"
        media_type = "application/pdf"
    elif normalized in ["epub", "songbook.epub"]:
        target_path = f"published/{songbook_id}/songbook.epub"
        default_fn = f"{songbook_id}.epub"
        media_type = "application/epub+zip"
    else:
        raise HTTPException(status_code=400, detail="Invalid artifact name. Supported: a5.pdf, a4.pdf, songbook.epub")

    dl_filename = filename if filename else default_fn
    encoded_filename = urllib.parse.quote(dl_filename)
    headers = {
        "Content-Disposition": f"{disposition}; filename*=UTF-8''{encoded_filename}",
        "Cache-Control": "public, max-age=3600"
    }

    if STORAGE_URI.startswith("gs://"):
        bucket_name = STORAGE_URI[5:]
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(target_path)
        if blob.exists():
            file_bytes = blob.download_as_bytes()
            return Response(content=file_bytes, media_type=media_type, headers=headers)
    else:
        local_dir = STORAGE_URI
        if STORAGE_URI.startswith("file://"):
            local_dir = STORAGE_URI[7:]
        local_path = os.path.join(local_dir, target_path)
        if os.path.exists(local_path):
            headers = {"Content-Disposition": f"{disposition}; filename=\"{dl_filename}\"", "Cache-Control": "public, max-age=3600"}
            return FileResponse(local_path, media_type=media_type, filename=dl_filename, headers=headers)

    raise HTTPException(status_code=404, detail="Published artifact not found")


class InviteEmailRequest(BaseModel):
    invitee_email: str
    inviter_name: Optional[str] = None
    inviter_email: Optional[str] = None
    songbook_title: str
    invite_url: str


@app.post("/api/invite/send")
async def send_invite_email(request: InviteEmailRequest):
    resend_api_key = os.environ.get("RESEND_API_KEY")
    if not resend_api_key:
        raise HTTPException(status_code=500, detail="RESEND_API_KEY is not configured on the server.")

    if not request.invitee_email or "@" not in request.invitee_email:
        raise HTTPException(status_code=400, detail="Nieprawidłowy adres e-mail odbiorcy.")

    inviter_display = request.inviter_name if request.inviter_name else (request.inviter_email or "Twórca śpiewnika")
    subject = f"Zaproszenie do współtworzenia śpiewnika: {request.songbook_title}"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #2d3748; background-color: #f7fafc; margin: 0; padding: 20px; }}
        .container {{ max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }}
        .brand {{ text-align: center; margin-bottom: 24px; }}
        .brand-title {{ font-size: 24px; font-weight: bold; color: #2e7d32; text-decoration: none; }}
        .title-box {{ background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0; }}
        .songbook-name {{ font-size: 18px; font-weight: bold; color: #166534; }}
        .role-badge {{ display: inline-block; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px; font-size: 13px; font-weight: 600; margin-top: 6px; }}
        .btn-container {{ text-align: center; margin: 28px 0; }}
        .btn {{ display: inline-block; background-color: #2e7d32; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px; }}
        .info-text {{ font-size: 14px; color: #4b5563; line-height: 1.5; }}
        .footer {{ margin-top: 32px; font-size: 12px; color: #9ca3af; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 16px; }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="brand">
          <span class="brand-title">🎶 spiewaj.com</span>
        </div>
        <p>Cześć!</p>
        <p><strong>{inviter_display}</strong> zaprasza Cię do współtworzenia śpiewnika w serwisie <strong>spiewaj.com</strong>.</p>
        
        <div class="title-box">
          <div class="songbook-name">📖 {request.songbook_title}</div>
          <div class="role-badge">Rola: Edytor</div>
        </div>

        <p class="info-text">
          Jako edytor zyskujesz prawo do edycji piosenek, dodawania nowych utworów oraz zapisywania wydań śpiewnika.
        </p>

        <div class="btn-container">
          <a href="{request.invite_url}" class="btn">Dołącz do śpiewnika</a>
        </div>

        <p class="info-text" style="font-size: 13px; color: #6b7280;">
          Po otwarciu linku zaloguj się swoim kontem Google, a śpiewnik pojawi się na Twojej liście śpiewników w chmurze.
        </p>

        <p class="info-text" style="font-size: 12px; color: #9ca3af; word-break: break-all; margin-top: 20px;">
          Gdyby przycisk nie działał, przejdź pod ten adres:<br>
          <a href="{request.invite_url}" style="color: #2e7d32;">{request.invite_url}</a>
        </p>

        <div class="footer">
          Wiadomość wysłana z serwisu <a href="https://spiewaj.com" style="color: #9ca3af;">spiewaj.com</a>.
        </div>
      </div>
    </body>
    </html>
    """

    payload = {
        "from": "Śpiewnik spiewaj.com <powiadomienia@spiewaj.com>",
        "to": [request.invitee_email],
        "subject": subject,
        "html": html_content
    }
    if request.inviter_email:
        payload["reply_to"] = request.inviter_email

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {resend_api_key}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            return JSONResponse(content={"status": "sent", "resend_id": res_data.get("id")})
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        print(f"Resend API error: {e.code} - {err_body}")
        raise HTTPException(status_code=502, detail=f"Błąd wysyłki e-mail przez Resend: {err_body}")
    except Exception as e:
        print(f"Exception sending invite email: {e}")
        raise HTTPException(status_code=500, detail=str(e))

