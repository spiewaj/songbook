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
const googleProvider = new GoogleAuthProvider();

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
            let regexStr = '^' + item.glob
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\/\*\*\//g, '/(?:.*/)?')
                .replace(/\*\*/g, '.*')
                .replace(/\*/g, '[^/]*')
                + '$';
            const regex = new RegExp(regexStr);

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
        allSongs = []
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
        const ownerSet = new Set(existingData?.ownerIds || []);
        ownerSet.add(user.uid);
        if (Array.isArray(additionalOwnerIds)) {
            additionalOwnerIds.forEach(uid => ownerSet.add(uid));
        }
        const ownerIds = Array.from(ownerSet);

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

        const payload = {
            id,
            title,
            subtitle,
            publisher,
            place,
            isPublic: !!isPublic,
            creatorId: existingData?.creatorId || user.uid,
            ownerIds,
            members,
            baseRef: baseRef || "main",
            yaml,
            resolvedSongIds,
            songCount: resolvedSongIds.length,
            updatedAt: serverTimestamp(),
            createdAt: existingData?.createdAt || serverTimestamp()
        };

        await setDoc(songbookRef, payload, { merge: true });
        return payload;
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
        const songbookRef = doc(db, "songbooks", id);
        const snapshot = await getDoc(songbookRef);
        return snapshot.exists() ? snapshot.data() : null;
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
    }
};

// Expose globally for vanilla scripts
if (typeof window !== 'undefined') {
    window.FirebaseSongbook = FirebaseSongbook;
    window.resolveSongIdsFromYaml = resolveSongIdsFromYaml;
}
