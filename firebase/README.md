# Firebase Security Rules & Data Model

This directory contains the Firebase Security Rules, indexes, and data-model configuration for the Songbook application. It supports deployments to multiple Google Cloud/Firebase projects (`wdw-21` development sandbox and `spiewaj-com` production).

## Files in this Directory

*   `firebase.json`: Core Firebase deployment configuration for Firestore and Storage.
*   `.firebaserc`: Maps project aliases (`wdw-21`, `spiewaj.com`) to GCP project IDs (`wdw-21`, `spiewaj-com`).
*   `firestore.rules`: Security rules for Firestore with multi-owner authorization.
*   `storage.rules`: Security rules for Firebase Cloud Storage with shared songbook asset support.
*   `firestore.indexes.json`: Compound indexes for querying songbooks by membership or public visibility ordered by modification date.

---

## Data Model (Approach A: Canonical YAML + Denormalized Resolved Cache)

Songbooks are stored in the top-level Firestore collection `/songbooks/{songbookId}`.

### Canonical Source of Truth vs. Read-Cache
* **Canonical Source of Truth (`yaml`)**: The raw YAML string is stored verbatim. This guarantees 100% fidelity with the compiler tools (`songbook2tex.py`, LaTeX pipeline), preserving custom comments, options, and dynamic matchers.
* **Denormalized UI Read-Cache (`resolvedSongIds`)**: Whenever a songbook is saved or updated, the list of matching song IDs is resolved against `index.json` and saved as an array of strings. The reader UI (`spiewaj.com/#songbook={id}`) filters `index.json` instantly without parsing YAML in JavaScript.

### Songbook Document Schema (`/songbooks/{songbookId}`)

```json
{
  "id": "53wdhiz",
  "title": "Śpiewnik szczepu 53 WDHiZ",
  "subtitle": "2026",
  "isPublic": true,
  "creatorId": "FIREBASE_AUTH_UID_CREATOR",
  "ownerIds": [
    "FIREBASE_AUTH_UID_CREATOR",
    "FIREBASE_AUTH_UID_CO_OWNER"
  ],
  "members": {
    "FIREBASE_AUTH_UID_CREATOR": {
      "role": "owner",
      "email": "creator@example.com",
      "addedAt": "2026-10-09T18:00:00Z"
    },
    "FIREBASE_AUTH_UID_CO_OWNER": {
      "role": "editor",
      "email": "editor@example.com",
      "addedAt": "2026-10-09T18:30:00Z"
    }
  },
  "baseRef": "main",
  "yaml": "songbook:\n  id: 53wdhiz\n  title: Śpiewnik szczepu 53 WDHiZ\n  songs:\n    - glob: songs/pl/custom/53wdhiz/*.xml\n",
  "resolvedSongIds": [
    "1000_bajek",
    "kochana",
    "zawsze_tam_gdzie_ty",
    "lubie_mowic_z_toba"
  ],
  "songCount": 4,
  "createdAt": "2026-10-09T18:00:00Z",
  "updatedAt": "2026-10-09T18:30:00Z"
}
```

### User Profiles & Favorites (`/users/{userId}`)
* Document: `/users/{userId}` (owner only write, authenticated read)
* Subcollection: `/users/{userId}/favorite_songs/{songId}` (owner only read/write)

---

## Query Patterns & Indexes

1. **Get My Songbooks (as Owner or Collaborator)**:
   ```javascript
   db.collection("songbooks")
     .where("ownerIds", "array-contains", currentUser.uid)
     .orderBy("updatedAt", "desc");
   ```
2. **Browse Public Songbooks**:
   ```javascript
   db.collection("songbooks")
     .where("isPublic", "==", true)
     .orderBy("updatedAt", "desc");
   ```
3. **Filter Songs in the Web UI**:
   ```javascript
   // Zero YAML parsing needed - instant filter:
   const visibleSongs = allSongs.filter(s => songbook.resolvedSongIds.includes(s.id));
   ```

---

## Security Rules Summary

### Firestore Rules (`firestore.rules`)
1. **Users (`/users/{userId}`)**: User profiles and favorite songs can only be modified by the matching authenticated user (`request.auth.uid == userId`).
2. **Songbooks (`/songbooks/{songbookId}`)**:
   * **Read**: Allowed if `isPublic == true` OR if `request.auth.uid in resource.data.ownerIds`.
   * **Create**: Allowed if authenticated and `request.auth.uid in request.resource.data.ownerIds`.
   * **Update**: Allowed for any member in `ownerIds`.
   * **Delete**: Allowed for the `creatorId` or any user in `ownerIds`.

### Cloud Storage Rules (`storage.rules`)
1. **5MB Upload Limit**: Enforced on all user uploads (`request.resource.size < 5 * 1024 * 1024`).
2. **Shared Songbook Assets (`/songbooks/{songbookId}/assets/{filename}`)**: Images (PNG/JPG/SVG) uploaded by authenticated users for covers and logos.
3. **System Cache (`/caches/songbooks/{songbookId}/...`)**: Read-only for frontend; writes reserved for Cloud Run Admin SDK.

---

## Deploying to Firebase

1. **Select environment**:
   ```bash
   firebase use wdw-21      # Staging / sandbox
   # OR
   firebase use spiewaj.com # Production
   ```
2. **Deploy rules and indexes**:
   ```bash
   firebase deploy --only firestore,storage
   ```
