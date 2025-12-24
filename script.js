import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { initializeFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCEUDD0iB4iGFSDoC0a3wCXF8PT098Su3w",
    authDomain: "anonymous-messaging-f93c0.firebaseapp.com",
    projectId: "anonymous-messaging-f93c0",
    storageBucket: "anonymous-messaging-f93c0.firebasestorage.app",
    messagingSenderId: "990716606250",
    appId: "1:990716606250:web:a82a15347cc5980aa01053"
};

// INITIALIZE
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// THE POLLING FIX: Forcing experimental settings to kill the "Transport Errored" issue
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    experimentalForceLongPolling: true,
    useFetchStreams: false 
});

let currentUser = null;
const urlParams = new URLSearchParams(window.location.search);
const activeChatId = urlParams.get('id');

// AUTHENTICATION
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        console.log("Verified User:", user.uid);
        if (activeChatId) loadChatRoom(activeChatId);
    } else {
        signInAnonymously(auth).catch(err => console.error("Auth Error:", err));
    }
});

// THE PROCESS: CREATE AND REDIRECT
window.startVibe = async function(type) {
    if (!currentUser) {
        alert("Still connecting to network... give it 5 seconds.");
        return;
    }

    const loader = document.getElementById('global-loader');
    if (loader) loader.style.display = 'flex';

    // Setting a 15-second safety timeout so you don't wait 30 mins again
    const timeout = setTimeout(() => {
        if (loader) loader.style.display = 'none';
        alert("Network is too slow. Try switching from 4G to WiFi or moving to a better signal area.");
    }, 15000);

    try {
        const docRef = await addDoc(collection(db, "rooms"), {
            type: type,
            createdBy: currentUser.uid,
            createdAt: serverTimestamp(),
            vibeName: type === 'private' ? 'One-on-One' : 'Community'
        });

        clearTimeout(timeout);
        console.log("Success! Room ID:", docRef.id);
        
        // REDIRECT
        window.location.href = `chat.html?id=${docRef.id}`;
    } catch (e) {
        clearTimeout(timeout);
        if (loader) loader.style.display = 'none';
        console.error("Critical Failure:", e);
        alert("Database connection failed. Refresh and try again.");
    }
};

// LIVE CHAT ENGINE
function loadChatRoom(id) {
    const chatUI = document.getElementById('active-chat-interface');
    const emptyUI = document.getElementById('no-chat-selected');
    
    if (chatUI) chatUI.style.display = 'flex';
    if (emptyUI) emptyUI.style.display = 'none';

    const q = query(collection(db, "rooms", id, "messages"), orderBy("timestamp", "asc"));
    
    onSnapshot(q, (snapshot) => {
        const box = document.getElementById('chat-messages');
        if (!box) return;

        box.innerHTML = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            const isMe = data.senderId === currentUser.uid;
            box.insertAdjacentHTML('beforeend', `
                <div class="message-wrapper ${isMe ? 'me' : 'them'}">
                    <div class="message-bubble">${data.text}</div>
                </div>
            `);
        });
        box.scrollTop = box.scrollHeight;
    }, (error) => {
        console.error("Snapshot Error:", error);
    });
}

// UI HANDLERS
document.addEventListener('DOMContentLoaded', () => {
    // Restore Theme
    const savedTheme = localStorage.getItem('tbh-theme') || 'dark-theme';
    document.body.className = savedTheme + ' has-sidebar';

    // Modal Logic
    const chatModal = document.getElementById('chat-modal-overlay');
    document.querySelectorAll('#open-chat-modal-main, #open-chat-modal-sidebar').forEach(btn => {
        btn.onclick = () => chatModal.classList.add('active');
    });

    document.querySelectorAll('.close-btn, .modal-overlay').forEach(btn => {
        btn.onclick = (e) => {
            if (e.target === btn || btn.classList.contains('close-btn')) {
                chatModal.classList.remove('active');
            }
        };
    });

    // Send Message
    document.getElementById('chat-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('message-input');
        if (!input.value.trim() || !activeChatId || !currentUser) return;

        try {
            await addDoc(collection(db, "rooms", activeChatId, "messages"), {
                text: input.value,
                senderId: currentUser.uid,
                timestamp: serverTimestamp()
            });
            input.value = '';
        } catch (err) {
            console.error("Message error:", err);
        }
    });
});


