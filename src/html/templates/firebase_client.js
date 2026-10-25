/**
 * Firebase Client Service for Spiewaj.com Songbook
 * Handles Google Authentication, Multi-Owner Firestore Persistence,
 * and YAML / resolvedSongIds synchronization (Approach A).
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import {
    getAuth,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    collection,
    query,
    where,
    orderBy,
    getDocs,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import {
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js';

const firebaseConfig = {
    projectId: "wdw-21",
    appId: "1:660500178903:web:0dd92a7bec4cfcb35d0d92",
    storageBucket: "wdw-21.appspot.com",
    apiKey: "AIzaSyDm48Mxg08LXaPd1FGO_JPhq_Li_NeT2qQ",
    authDomain: "wdw-21.firebaseapp.com",
    messagingSenderId: "660500178903"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

export const ADMIN_EMAILS = [
    'piotr.tabor@gmail.com'
];

/**
 * Resolves a YAML songbook specification against a catalog of all songs.
 * Returns an ordered array of matching song IDs.
 *
 * @param {string} yamlContent - Raw YAML songbook definition
 * @param {Array<Object>} allSongs - Full list of songs from index.json
 * @returns {Array<string>} - Array of resolved song IDs
 */
export function resolveSongIdsFromYaml(yamlContent, allSongs) {
    if (!yamlContent || !allSongs || allSongs.length === 0) return [];
    
    let data;
    try {
        if (typeof jsyaml !== 'undefined') {
            data = jsyaml.load(yamlContent);
        } else {
            data = JSON.parse(yamlContent);
        }
    } catch (e) {
        console.error("Failed to parse YAML for song resolution:", e);
        return [];
    }

    if (!data || !data.songbook || !Array.isArray(data.songbook.songs)) {
        return [];
    }

    const songById = new Map();
    allSongs.forEach(song => songById.set(song.id, song));

    const matchedSongIds = new Set();
    const orderedSongIds = [];

    function addSong(id) {
        if (id && songById.has(id) && !matchedSongIds.has(id)) {
            matchedSongIds.add(id);
            orderedSongIds.push(id);
        }
    }

    data.songbook.songs.forEach(item => {
        if (!item) return;

        if (item.glob) {
            let str = item.glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
            str = str.replace(/\/\*\*\//g, '/__GLOBSTAR_SLASH__');
            str = str.replace(/\*\*/g, '__GLOBSTAR__');
            str = str.replace(/\*/g, '[^/]*');
            str = str.replace(/\?/g, '[^/]');
            str = str.replace(/\/__GLOBSTAR_SLASH__/g, '/(?:.*/)?');
            str = str.replace(/__GLOBSTAR__/g, '.*');
            const regex = new RegExp('^' + str + '$');

            for (const song of allSongs) {
                if (song.path && regex.test(song.path)) {
                    addSong(song.id);
                } else if (!song.path && `songs/**/${song.id}.xml` === item.glob) {
                    addSong(song.id);
                }
            }

            // Fallback for single filename
            if (!item.glob.includes('*')) {
                const match = item.glob.match(/([^\/]+)\.xml$/);
                if (match && songById.has(match[1])) {
                    addSong(match[1]);
                }
            }
        } else if (item.genre && item.genre.equals) {
            allSongs.filter(s => s.genre === item.genre.equals).forEach(s => addSong(s.id));
        } else if (item.artist && item.artist.equals) {
            allSongs.filter(s => s.artist === item.artist.equals).forEach(s => addSong(s.id));
        } else if (item.text_author && item.text_author.equals) {
            allSongs.filter(s => s.text_author === item.text_author.equals).forEach(s => addSong(s.id));
        }
    });

    return orderedSongIds;
}

export const FirebaseSongbook = {
    auth,
    db,
    storage,

    /**
     * Listen to authentication state changes.
     */
    onAuthChange(callback) {
        return onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.syncUserProfile(user).catch(e => console.warn("Sync user profile error:", e));
            }
            callback(user);
        });
    },

    /**
     * Get the currently authenticated user or null.
     */
    getCurrentUser() {
        return auth.currentUser;
    },

    /**
     * Sign in with Google Popup.
     */
    async loginWithGoogle() {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            if (result.user) {
                await this.syncUserProfile(result.user);
            }
            return result.user;
        } catch (error) {
            console.error("Google Sign-In failed:", error);
            throw error;
        }
    },

    /**
     * Persist or update current user info in Firestore /users/{uid}
     */
    async syncUserProfile(user) {
        if (!user || !user.uid) return;
        try {
            const userRef = doc(db, "users", user.uid);
            await setDoc(userRef, {
                uid: user.uid,
                email: (user.email || "").toLowerCase(),
                displayName: user.displayName || "",
                photoURL: user.photoURL || "",
                lastLoginAt: serverTimestamp()
            }, { merge: true });
        } catch (e) {
            console.warn("Could not sync user profile to Firestore:", e);
        }
    },

    /**
     * Search for a registered user by email address.
     */
    async findUserByEmail(email) {
        if (!email) return null;
        const cleanEmail = email.trim().toLowerCase();
        try {
            const q = query(
                collection(db, "users"),
                where("email", "==", cleanEmail)
            );
            const snap = await getDocs(q);
            if (snap.empty) {
                return null;
            }
            const docData = snap.docs[0].data();
            return {
                uid: docData.uid || snap.docs[0].id,
                email: docData.email,
                displayName: docData.displayName || ""
            };
        } catch (e) {
            console.error("Error finding user by email:", e);
            throw e;
        }
    },

    /**
     * Fetch user profile from /users/{uid} if exists.
     */
    async findUserById(uid) {
        if (!uid) return null;
        try {
            const userRef = doc(db, "users", uid.trim());
            const snap = await getDoc(userRef);
            if (snap.exists()) {
                const docData = snap.data();
                return {
                    uid: docData.uid || snap.id,
                    email: docData.email,
                    displayName: docData.displayName || ""
                };
            }
        } catch (e) {
            console.warn("Could not fetch user doc:", e);
        }
        return null;
    },

    /**
     * Sign out current user.
     */
    async logout() {
        return signOut(auth);
    },

    /**
     * Saves a songbook document to Firestore following Approach A.
     */
    async saveSongbook({
        id,
        title,
        subtitle = "",
        publisher = "",
        place = "",
        isPublic = true,
        yaml,
        baseRef = "main",
        additionalOwnerIds = [],
        members: customMembers = null,
        allSongs = [],
        isPublished = null,
        artifacts = null,
        imageUrl = null,
        image = null
    }) {
        const user = auth.currentUser;
        if (!user) {
            throw new Error("Musisz być zalogowany, aby zapisać śpiewnik w chmurze.");
        }

        if (!id || !title || !yaml) {
            throw new Error("Wymagane pola: ID, Tytuł oraz zawartość YAML.");
        }

        // Resolve songs against catalog
        const resolvedSongIds = resolveSongIdsFromYaml(yaml, allSongs);

        const songbookRef = doc(db, "songbooks", id);
        let existingData = null;
        try {
            const existingDoc = await getDoc(songbookRef);
            if (existingDoc.exists()) {
                existingData = existingDoc.data();
            }
        } catch (e) {
            // New creation or unreadable existing doc
            console.log("Creating new songbook document (or could not fetch existing):", e);
        }

        // Build ownerIds list
        let ownerIds;
        if (Array.isArray(additionalOwnerIds) && additionalOwnerIds.length > 0) {
            const ownerSet = new Set(additionalOwnerIds);
            ownerSet.add(user.uid);
            ownerIds = Array.from(ownerSet);
        } else {
            const ownerSet = new Set(existingData?.ownerIds || []);
            ownerSet.add(user.uid);
            ownerIds = Array.from(ownerSet);
        }

        // Members metadata map
        const members = customMembers !== null ? { ...customMembers } : { ...(existingData?.members || {}) };
        if (!members[user.uid]) {
            members[user.uid] = {
                role: existingData ? "editor" : "owner",
                email: user.email || "",
                displayName: user.displayName || "",
                addedAt: new Date().toISOString()
            };
        }

        const effectiveIsPublished = isPublished !== null ? !!isPublished : (existingData?.isPublished || false);
        const effectiveArtifacts = artifacts !== null ? artifacts : (existingData?.artifacts || {});
        const effectiveImageUrl = imageUrl !== null ? imageUrl : (existingData?.imageUrl || null);
        const effectiveImage = image !== null ? image : (existingData?.image || null);

        const payload = {
            id,
            title,
            subtitle,
            publisher,
            place,
            isPublic: isPublic !== undefined ? !!isPublic : (existingData?.isPublic ?? true),
            creatorId: existingData?.creatorId || user.uid,
            ownerIds,
            members,
            baseRef: baseRef || "main",
            yaml,
            resolvedSongIds,
            songCount: resolvedSongIds.length,
            isPublished: effectiveIsPublished,
            publishedAt: effectiveIsPublished ? (existingData?.publishedAt || serverTimestamp()) : (existingData?.publishedAt || null),
            artifacts: effectiveArtifacts,
            imageUrl: effectiveImageUrl,
            image: effectiveImage,
            updatedAt: serverTimestamp(),
            createdAt: existingData?.createdAt || serverTimestamp()
        };

        await setDoc(songbookRef, payload, { merge: true });
        return payload;
    },

    /**
     * Upload an image asset for a songbook directly to Firebase Storage.
     * @param {string} songbookId - ID of the songbook
     * @param {File} file - Image file
     * @returns {Promise<{ url: string, path: string, name: string, size: number, type: string }>}
     */
    async uploadSongbookImage(songbookId, file) {
        const user = auth.currentUser;
        if (!user) {
            throw new Error("Musisz być zalogowany, aby wgrać grafikę.");
        }
        if (!songbookId) {
            throw new Error("Brak identyfikatora śpiewnika.");
        }
        if (!file) {
            throw new Error("Nie wybrano pliku.");
        }
        if (!file.type || !file.type.startsWith('image/')) {
            throw new Error("Dozwolone są wyłącznie pliki graficzne (PNG, JPG, SVG, WebP).");
        }
        if (file.size > 5 * 1024 * 1024) {
            throw new Error("Maksymalny dozwolony rozmiar grafiki to 5MB.");
        }

        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `songbooks/${encodeURIComponent(songbookId)}/assets/${Date.now()}_${cleanName}`;
        const fileRef = ref(storage, storagePath);

        const metadata = {
            contentType: file.type,
            customMetadata: {
                uploaderUid: user.uid,
                originalName: file.name
            }
        };

        const snapshot = await uploadBytes(fileRef, file, metadata);
        const downloadUrl = await getDownloadURL(snapshot.ref);

        return {
            url: downloadUrl,
            path: snapshot.ref.fullPath,
            name: file.name,
            size: file.size,
            type: file.type
        };
    },

    /**
     * Delete an uploaded image from Firebase Storage.
     */
    async deleteSongbookImage(storagePath) {
        if (!storagePath) return;
        try {
            const fileRef = ref(storage, storagePath);
            await deleteObject(fileRef);
        } catch (e) {
            console.warn("Could not delete image from storage:", e);
        }
    },

    /**
     * Update downloadable artifacts for a published songbook document.
     */
    async updateSongbookArtifacts(id, artifacts, isPublished = true) {
        if (!id) return;
        const songbookRef = doc(db, "songbooks", id);
        const updateData = {
            artifacts: artifacts || {},
            updatedAt: serverTimestamp()
        };
        if (isPublished) {
            updateData.isPublished = true;
            updateData.publishedAt = serverTimestamp();
        }
        await setDoc(songbookRef, updateData, { merge: true });
    },

    /**
     * Fetch all songbooks where the current user is an owner or collaborator.
     */
    async fetchMySongbooks() {
        const user = auth.currentUser;
        if (!user) return [];

        const q = query(
            collection(db, "songbooks"),
            where("ownerIds", "array-contains", user.uid),
            orderBy("updatedAt", "desc")
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data());
    },

    /**
     * Fetch public songbooks.
     */
    async fetchPublicSongbooks() {
        const q = query(
            collection(db, "songbooks"),
            where("isPublic", "==", true),
            orderBy("updatedAt", "desc")
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data());
    },

    /**
     * Fetch a specific songbook by ID.
     */
    async fetchSongbook(id) {
        if (!id) return null;
        let songbookRef = doc(db, "songbooks", id);
        let snapshot = await getDoc(songbookRef);
        if (snapshot.exists()) return snapshot.data();

        // Fallback for case-insensitive ID
        if (id.toLowerCase() !== id) {
            songbookRef = doc(db, "songbooks", id.toLowerCase());
            snapshot = await getDoc(songbookRef);
            if (snapshot.exists()) return snapshot.data();
        }
        return null;
    },

    /**
     * Update public visibility and publication state of a songbook.
     * @param {string} id - Songbook ID
     * @param {boolean} isPublic - true for public, false for private
     * @param {boolean|null} isPublished - optional explicit isPublished value
     */
    async setSongbookVisibility(id, isPublic, isPublished = null) {
        const user = auth.currentUser;
        if (!user) {
            throw new Error("Musisz być zalogowany, aby zmienić widoczność śpiewnika.");
        }
        if (!id) {
            throw new Error("Brak identyfikatora śpiewnika.");
        }
        const songbookRef = doc(db, "songbooks", id);
        const updateData = {
            isPublic: !!isPublic,
            updatedAt: serverTimestamp()
        };
        if (isPublished !== null) {
            updateData.isPublished = !!isPublished;
        } else if (!isPublic) {
            // Unpublishing also clears isPublished flag
            updateData.isPublished = false;
        }
        await setDoc(songbookRef, updateData, { merge: true });
        return updateData;
    },

    /**
     * Delete a songbook by ID.
     */
    async deleteSongbook(id) {
        const user = auth.currentUser;
        if (!user) {
            throw new Error("Musisz być zalogowany, aby usunąć śpiewnik.");
        }
        const songbookRef = doc(db, "songbooks", id);
        await deleteDoc(songbookRef);
        return true;
    },

    /**
     * Synchronously check if a user has admin privileges based on email or claims.
     * @param {Object|null} user - Firebase User object (defaults to auth.currentUser)
     * @returns {boolean}
     */
    isAdmin(user = null) {
        const u = user || auth.currentUser;
        if (!u) return false;
        if (u.email && ADMIN_EMAILS.includes(u.email.toLowerCase())) {
            return true;
        }
        if (u.admin === true) {
            return true;
        }
        return false;
    },

    /**
     * Asynchronously check if a user is an admin (including checking /admins/{uid} in Firestore).
     * @param {Object|null} user - Firebase User object
     * @returns {Promise<boolean>}
     */
    async checkIsAdmin(user = null) {
        const u = user || auth.currentUser;
        if (!u) return false;
        if (this.isAdmin(u)) return true;
        try {
            const adminDoc = await getDoc(doc(db, "admins", u.uid));
            if (adminDoc.exists()) {
                return true;
            }
        } catch (e) {
            // Ignore permission error if not admin
        }
        return false;
    },

    /**
     * Toggle promoted/featured status of a songbook (admin only).
     * @param {string} id - Songbook ID
     * @param {boolean} isPromoted - true to feature/promote, false to remove promotion
     */
    async toggleSongbookPromote(id, isPromoted) {
        const user = auth.currentUser;
        if (!user) {
            throw new Error("Musisz być zalogowany, aby promować śpiewnik.");
        }
        if (!id) {
            throw new Error("Brak identyfikatora śpiewnika.");
        }
        const songbookRef = doc(db, "songbooks", id);
        const updateData = {
            isPromoted: !!isPromoted,
            promotedAt: isPromoted ? serverTimestamp() : null,
            updatedAt: serverTimestamp()
        };
        await setDoc(songbookRef, updateData, { merge: true });
        return updateData;
    },

    /**
     * Fetch all songbooks without public filter (admin only).
     */
    async fetchAllSongbooksAdmin() {
        const q = query(
            collection(db, "songbooks"),
            orderBy("updatedAt", "desc")
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data());
    },

    /**
     * Create an invitation for a songbook.
     * @param {Object} params
     * @param {string} params.songbookId
     * @param {string} params.songbookTitle
     * @param {string} [params.inviteeEmail] - optional target email
     * @param {string} [params.role] - role to grant (defaults to 'editor')
     * @returns {Promise<Object>} Created invite document data
     */
    async createInvite({ songbookId, songbookTitle, inviteeEmail = '', role = 'editor' }) {
        const user = auth.currentUser;
        if (!user) {
            throw new Error("Musisz być zalogowany, aby wysłać zaproszenie.");
        }
        if (!songbookId) {
            throw new Error("Brak identyfikatora śpiewnika.");
        }

        // Generate a clean random token
        const token = 'inv_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
        const inviteRef = doc(db, "invites", token);
        const cleanEmail = (inviteeEmail || '').trim().toLowerCase();

        const inviteData = {
            id: token,
            songbookId,
            songbookTitle: songbookTitle || songbookId,
            inviterUid: user.uid,
            inviterEmail: user.email || '',
            inviterName: user.displayName || user.email || 'Współtwórca',
            inviteeEmail: cleanEmail,
            role: role || 'editor',
            status: 'pending',
            createdAt: serverTimestamp()
        };

        await setDoc(inviteRef, inviteData);

        return {
            ...inviteData,
            inviteUrl: this.buildInviteUrl(token)
        };
    },

    /**
     * Build full invite URL based on current host.
     * @param {string} token
     * @returns {string}
     */
    buildInviteUrl(token) {
        if (typeof window === 'undefined') return `https://spiewaj.com/songbook_edit.html?invite=${token}`;
        const baseUrl = `${window.location.origin}${window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1)}`;
        return `${baseUrl}songbook_edit.html?invite=${encodeURIComponent(token)}`;
    },

    /**
     * Fetch an invite by token.
     * @param {string} token
     * @returns {Promise<Object|null>}
     */
    async fetchInvite(token) {
        if (!token) return null;
        try {
            const inviteRef = doc(db, "invites", token.trim());
            const snap = await getDoc(inviteRef);
            if (snap.exists()) {
                return snap.data();
            }
        } catch (e) {
            console.warn("Could not fetch invite:", e);
        }
        return null;
    },

    /**
     * Fetch all pending invites for a given songbook.
     * @param {string} songbookId
     * @returns {Promise<Array<Object>>}
     */
    async fetchPendingInvitesForSongbook(songbookId) {
        if (!songbookId) return [];
        try {
            const q = query(
                collection(db, "invites"),
                where("songbookId", "==", songbookId),
                where("status", "==", "pending")
            );
            const snap = await getDocs(q);
            const list = snap.docs.map(d => d.data());
            list.sort((a, b) => {
                const ta = a.createdAt?.seconds || 0;
                const tb = b.createdAt?.seconds || 0;
                return tb - ta;
            });
            return list;
        } catch (e) {
            console.warn("Could not fetch pending invites for songbook:", e);
            return [];
        }
    },

    /**
     * Fetch pending invites addressed to current user's email.
     * @returns {Promise<Array<Object>>}
     */
    async fetchMyPendingInvites() {
        const user = auth.currentUser;
        if (!user || !user.email) return [];
        try {
            const cleanEmail = user.email.trim().toLowerCase();
            const q = query(
                collection(db, "invites"),
                where("inviteeEmail", "==", cleanEmail),
                where("status", "==", "pending")
            );
            const snap = await getDocs(q);
            return snap.docs.map(d => d.data());
        } catch (e) {
            console.warn("Could not fetch user pending invites:", e);
            return [];
        }
    },

    /**
     * Revoke / cancel an invite.
     * @param {string} inviteId
     */
    async revokeInvite(inviteId) {
        const user = auth.currentUser;
        if (!user) {
            throw new Error("Musisz być zalogowany, aby anulować zaproszenie.");
        }
        if (!inviteId) return;
        const inviteRef = doc(db, "invites", inviteId.trim());
        await deleteDoc(inviteRef);
        return true;
    },

    /**
     * Accept an invite and grant editor privileges in the songbook.
     * @param {string} inviteId
     * @returns {Promise<Object>} Updated songbook document
     */
    async acceptInvite(inviteId) {
        const user = auth.currentUser;
        if (!user) {
            throw new Error("Musisz być zalogowany, aby dołączyć do śpiewnika.");
        }
        if (!inviteId) {
            throw new Error("Brak identyfikatora zaproszenia.");
        }

        const cleanInviteId = inviteId.trim();
        const inviteRef = doc(db, "invites", cleanInviteId);
        const inviteSnap = await getDoc(inviteRef);
        if (!inviteSnap.exists()) {
            throw new Error("Nie znaleziono zaproszenia lub zostało anulowane.");
        }

        const invite = inviteSnap.data();
        if (invite.status !== 'pending') {
            throw new Error("To zaproszenie zostało już wykorzystane.");
        }

        const songbookId = invite.songbookId;
        const songbookRef = doc(db, "songbooks", songbookId);
        const sbSnap = await getDoc(songbookRef);
        if (!sbSnap.exists()) {
            throw new Error("Śpiewnik powiązany z tym zaproszeniem nie istnieje.");
        }

        const sbData = sbSnap.data();

        // 1. Mark invite accepted
        await setDoc(inviteRef, {
            status: 'accepted',
            acceptedByUid: user.uid,
            acceptedByEmail: user.email || '',
            acceptedAt: serverTimestamp()
        }, { merge: true });

        // 2. Add user to ownerIds and members
        const ownerSet = new Set(sbData.ownerIds || []);
        ownerSet.add(user.uid);
        const updatedOwnerIds = Array.from(ownerSet);

        const updatedMembers = { ...(sbData.members || {}) };
        updatedMembers[user.uid] = {
            role: invite.role || 'editor',
            email: user.email || '',
            displayName: user.displayName || '',
            addedAt: new Date().toISOString(),
            inviteId: cleanInviteId
        };

        const updatePayload = {
            ownerIds: updatedOwnerIds,
            members: updatedMembers,
            updatedAt: serverTimestamp()
        };

        await setDoc(songbookRef, updatePayload, { merge: true });

        return {
            ...sbData,
            ...updatePayload
        };
    },

    /**
     * Remove a collaborator from a songbook.
     * @param {string} songbookId - Songbook ID
     * @param {string} uidToRemove - UID of collaborator to remove
     * @returns {Promise<Object>} { ownerIds, members }
     */
    async removeCollaborator(songbookId, uidToRemove) {
        const user = auth.currentUser;
        if (!user) {
            throw new Error("Musisz być zalogowany, aby zarządzać współtwórcami.");
        }
        if (!songbookId || !uidToRemove) {
            throw new Error("Brak identyfikatora śpiewnika lub użytkownika.");
        }

        const songbookRef = doc(db, "songbooks", songbookId);
        const sbSnap = await getDoc(songbookRef);
        if (!sbSnap.exists()) {
            throw new Error("Śpiewnik nie istnieje.");
        }

        const sbData = sbSnap.data();
        const isAdmin = this.isAdmin(user);
        const isOwner = (Array.isArray(sbData.ownerIds) && sbData.ownerIds.includes(user.uid)) ||
                        sbData.creatorId === user.uid ||
                        sbData.ownerId === user.uid ||
                        isAdmin;

        if (!isOwner) {
            throw new Error("Brak uprawnień do zarządzania współtwórcami tego śpiewnika.");
        }

        // Creator cannot be removed except by admin
        if (sbData.creatorId && uidToRemove === sbData.creatorId && !isAdmin) {
            throw new Error("Nie można odebrać uprawnień właścicielowi śpiewnika.");
        }

        const updatedOwnerIds = (sbData.ownerIds || []).filter(u => u !== uidToRemove);
        const updatedMembers = { ...(sbData.members || {}) };
        delete updatedMembers[uidToRemove];

        const updatePayload = {
            ownerIds: updatedOwnerIds,
            members: updatedMembers,
            updatedAt: serverTimestamp()
        };

        await setDoc(songbookRef, updatePayload, { merge: true });

        return {
            ownerIds: updatedOwnerIds,
            members: updatedMembers
        };
    },

    /**
     * Add a collaborator by email. If registered user exists, grants immediate editor access.
     * If user is not yet registered, creates a pending invite.
     * @param {string} songbookId
     * @param {string} email
     * @param {string} [role='editor']
     * @returns {Promise<Object>} { addedDirectly: boolean, targetUser?, invite?, ownerIds?, members? }
     */
    async addCollaboratorByEmail(songbookId, email, role = 'editor') {
        const user = auth.currentUser;
        if (!user) {
            throw new Error("Musisz być zalogowany, aby dodawać edytorów.");
        }
        const cleanEmail = (email || '').trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes('@')) {
            throw new Error("Podaj prawidłowy adres e-mail.");
        }

        const songbookRef = doc(db, "songbooks", songbookId);
        const sbSnap = await getDoc(songbookRef);
        if (!sbSnap.exists()) {
            throw new Error("Śpiewnik nie istnieje.");
        }

        const sbData = sbSnap.data();
        const isAdmin = this.isAdmin(user);
        const isOwner = (Array.isArray(sbData.ownerIds) && sbData.ownerIds.includes(user.uid)) ||
                        sbData.creatorId === user.uid ||
                        sbData.ownerId === user.uid ||
                        isAdmin;

        if (!isOwner) {
            throw new Error("Brak uprawnień do dodawania współtwórców tego śpiewnika.");
        }

        // Search if registered user exists with this email
        let targetUser = null;
        try {
            targetUser = await this.findUserByEmail(cleanEmail);
        } catch (e) {
            console.warn("Could not query users by email:", e);
        }

        if (targetUser && targetUser.uid) {
            const ownerSet = new Set(sbData.ownerIds || []);
            ownerSet.add(targetUser.uid);
            const updatedOwnerIds = Array.from(ownerSet);

            const updatedMembers = { ...(sbData.members || {}) };
            updatedMembers[targetUser.uid] = {
                role: role || 'editor',
                email: targetUser.email || cleanEmail,
                displayName: targetUser.displayName || '',
                addedAt: new Date().toISOString()
            };

            const updatePayload = {
                ownerIds: updatedOwnerIds,
                members: updatedMembers,
                updatedAt: serverTimestamp()
            };

            await setDoc(songbookRef, updatePayload, { merge: true });

            return {
                addedDirectly: true,
                targetUser,
                ownerIds: updatedOwnerIds,
                members: updatedMembers
            };
        } else {
            // Not registered yet -> create invite
            const invite = await this.createInvite({
                songbookId,
                songbookTitle: sbData.title || songbookId,
                inviteeEmail: cleanEmail,
                role
            });

            return {
                addedDirectly: false,
                invite
            };
        }
    }
};

// Expose globally for vanilla scripts
if (typeof window !== 'undefined') {
    window.FirebaseSongbook = FirebaseSongbook;
    window.resolveSongIdsFromYaml = resolveSongIdsFromYaml;
}
