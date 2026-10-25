#!/usr/bin/env python3
"""
Convert / copy static songbooks (53wdhiz, spiewnik_lupienicki) into custom Firestore songbooks.
"""

import datetime
import json
import os
import re
import subprocess
import urllib.request
import yaml

REPO_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
INDEX_JSON_PATH = os.path.join(REPO_DIR, "build", "index.json")

ADMIN_UID = "yeH6gnxL8RQcDOGqlKDaRzAhPqD3"
ADMIN_EMAIL = "piotr.tabor@gmail.com"
ADMIN_NAME = "Piotr Tabor"
PROJECT_ID = "wdw-21"

def get_access_token():
    cmd = ["gcloud", "auth", "print-access-token"]
    res = subprocess.run(cmd, check=True, stdout=subprocess.PIPE, text=True)
    return res.stdout.strip()

def resolve_song_ids(songs_spec, all_songs):
    song_by_id = {s["id"]: s for s in all_songs}
    ordered = []
    matched = set()

    def add(sid):
        if sid and sid in song_by_id and sid not in matched:
            matched.add(sid)
            ordered.append(sid)

    for item in songs_spec:
        if not item:
            continue
        if "glob" in item:
            g = item["glob"]
            regex_str = (
                "^"
                + re.escape(g)
                .replace(r"/\*\*/", r"/(?:.*/)?")
                .replace(r"\*\*", ".*")
                .replace(r"\*", "[^/]*")
                + "$"
            )
            rx = re.compile(regex_str)
            for s in all_songs:
                p = s.get("path")
                if p and rx.match(p):
                    add(s["id"])
                elif not p and f"songs/**/{s['id']}.xml" == g:
                    add(s["id"])
            if "*" not in g:
                m = re.search(r"([^/]+)\.xml$", g)
                if m and m.group(1) in song_by_id:
                    add(m.group(1))
        elif "genre" in item and isinstance(item["genre"], dict) and "equals" in item["genre"]:
            eq = item["genre"]["equals"]
            for s in all_songs:
                if s.get("genre") == eq:
                    add(s["id"])
        elif "artist" in item and isinstance(item["artist"], dict) and "equals" in item["artist"]:
            eq = item["artist"]["equals"]
            for s in all_songs:
                if s.get("artist") == eq:
                    add(s["id"])
        elif "text_author" in item and isinstance(item["text_author"], dict) and "equals" in item["text_author"]:
            eq = item["text_author"]["equals"]
            for s in all_songs:
                if s.get("text_author") == eq:
                    add(s["id"])

    return ordered

def to_firestore_value(val):
    if val is None:
        return {"nullValue": None}
    if isinstance(val, bool):
        return {"booleanValue": val}
    if isinstance(val, int):
        return {"integerValue": str(val)}
    if isinstance(val, float):
        return {"doubleValue": val}
    if isinstance(val, str):
        if re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$", val):
            return {"timestampValue": val}
        return {"stringValue": val}
    if isinstance(val, list):
        return {"arrayValue": {"values": [to_firestore_value(v) for v in val]}}
    if isinstance(val, dict):
        return {"mapValue": {"fields": {k: to_firestore_value(v) for k, v in val.items()}}}
    raise ValueError(f"Unsupported Firestore type: {type(val)}")

def to_firestore_doc(data_dict):
    return {"fields": {k: to_firestore_value(v) for k, v in data_dict.items()}}

def build_custom_songbook(yaml_rel_path, cover_url, cover_name, cover_size, all_songs):
    full_yaml_path = os.path.join(REPO_DIR, yaml_rel_path)
    with open(full_yaml_path, "r", encoding="utf-8") as f:
        raw_yaml_str = f.read()
        spec = yaml.safe_load(raw_yaml_str)

    sb_spec = spec["songbook"]
    sb_id = sb_spec["id"]
    title = sb_spec.get("title", sb_id)
    subtitle = sb_spec.get("subtitle", "")
    publisher = sb_spec.get("publisher", "").strip()
    place = sb_spec.get("place", "").strip()

    # Create YAML with the cloud image URL so the backend builder can use it directly
    yaml_dict = yaml.safe_load(raw_yaml_str)
    yaml_dict["songbook"]["image"] = {"url": cover_url}
    yaml_dict["songbook"]["url"] = f"https://spiewaj.com/#{sb_id}"
    yaml_content = yaml.dump(yaml_dict, allow_unicode=True, sort_keys=False)

    resolved_song_ids = resolve_song_ids(sb_spec.get("songs", []), all_songs)
    now_iso = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    if cover_name.lower().endswith(".svg"):
        image_type = "image/svg+xml"
    elif cover_name.lower().endswith((".jpg", ".jpeg")):
        image_type = "image/jpeg"
    else:
        image_type = "image/png"
    image_meta = {
        "name": cover_name,
        "path": f"songbooks/{sb_id}/assets/{cover_name}",
        "size": cover_size,
        "type": image_type,
        "url": cover_url
    }

    artifacts = {
        "epub": f"https://spiewaj.com/{sb_id}.epub",
        "pdf_a5": f"https://spiewaj.com/songs_tex/{sb_id}_a5.pdf",
        "pdf_a4": f"https://spiewaj.com/songs_tex/{sb_id}_a4.pdf"
    }

    doc_data = {
        "id": sb_id,
        "title": title,
        "subtitle": subtitle,
        "publisher": publisher,
        "place": place,
        "isPublic": True,
        "isPublished": True,
        "isPromoted": True,
        "creatorId": ADMIN_UID,
        "ownerIds": [ADMIN_UID],
        "members": {
            ADMIN_UID: {
                "role": "owner",
                "email": ADMIN_EMAIL,
                "displayName": ADMIN_NAME,
                "addedAt": now_iso
            }
        },
        "baseRef": "main",
        "yaml": yaml_content,
        "resolvedSongIds": resolved_song_ids,
        "songCount": len(resolved_song_ids),
        "imageUrl": cover_url,
        "image": image_meta,
        "artifacts": artifacts,
        "createdAt": now_iso,
        "updatedAt": now_iso,
        "publishedAt": now_iso
    }

    return sb_id, doc_data

def upload_to_firestore(doc_id, doc_data, dry_run=False):
    firestore_payload = to_firestore_doc(doc_data)
    if dry_run:
        print(f"[DRY-RUN] Would upload {doc_id} to Firestore. Song count: {doc_data['songCount']}")
        return

    token = get_access_token()
    url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/songbooks/{doc_id}"

    req = urllib.request.Request(
        url,
        data=json.dumps(firestore_payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        method="PATCH"
    )

    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read().decode("utf-8"))
        print(f"Successfully uploaded {doc_id} to Firestore: {result.get('name')}")

def main():
    with open(INDEX_JSON_PATH, "r", encoding="utf-8") as f:
        all_songs = json.load(f)["songs"]

    songbooks_to_convert = [
        {
            "yaml_path": "songbooks/53wdhiz.yaml",
            "cover_url": "https://firebasestorage.googleapis.com/v0/b/wdw-21.appspot.com/o/songbooks%2F53wdhiz%2Fassets%2Flogo.svg?alt=media",
            "cover_name": "logo.svg",
            "cover_size": os.path.getsize(os.path.join(REPO_DIR, "songbooks", "53wdhiz", "logo.svg")),
        },
        {
            "yaml_path": "songbooks/spiewnik_lupienicki.songbook.yaml",
            "cover_url": "https://firebasestorage.googleapis.com/v0/b/wdw-21.appspot.com/o/songbooks%2Fspiewnik_lupienicki%2Fassets%2Flupienice.svg?alt=media",
            "cover_name": "lupienice.svg",
            "cover_size": os.path.getsize(os.path.join(REPO_DIR, "songbooks", "spiewnik_lupienicki", "lupienice.svg")),
        },
        {
            "yaml_path": "songbooks/21wdw.yaml",
            "cover_url": "https://firebasestorage.googleapis.com/v0/b/wdw-21.appspot.com/o/songbooks%2F21wdw%2Fassets%2Fznak21.svg?alt=media",
            "cover_name": "znak21.svg",
            "cover_size": os.path.getsize(os.path.join(REPO_DIR, "songbooks", "wdw21", "znak21.svg")),
        }
    ]

    for item in songbooks_to_convert:
        sb_id, doc_data = build_custom_songbook(
            item["yaml_path"],
            item["cover_url"],
            item["cover_name"],
            item["cover_size"],
            all_songs
        )
        print(f"Prepared songbook '{sb_id}': title='{doc_data['title']}', songs={doc_data['songCount']}")
        upload_to_firestore(sb_id, doc_data, dry_run=False)

if __name__ == "__main__":
    main()
