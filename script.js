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
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    experimentalForceLongPolling: true // This ensures your 4G stays connected
});

let currentUser = null;
const activeChatId = new URLSearchParams(window.location.search).get('id');

// AUTHENTICATION
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        console.log("Verified User:", user.uid);
        if (activeChatId) loadChatRoom(activeChatId);
    } else {
        signInAnonymously(auth);
    }
});

// THE PROCESS: CREATE AND REDIRECT
window.startVibe = async function(type) {
    if (!currentUser) return;
    try {
        const docRef = await addDoc(collection(db, "rooms"), {
            type: type,
            createdBy: currentUser.uid,
            createdAt: serverTimestamp(),
            name: type === 'private' ? 'One-on-One' : 'Community'
        });
        // NEXT STEP: Page reloads with the new ID in the URL
        window.location.href = `chat.html?id=${docRef.id}`;
    } catch (e) {
        console.error("Failed to create room", e);
    }
};

// LIVE CHAT ENGINE
function loadChatRoom(id) {
    const activeUI = document.getElementById('active-chat-interface');
    const emptyUI = document.getElementById('no-chat-selected');
    
    if(activeUI) activeUI.style.display = 'flex';
    if(emptyUI) emptyUI.style.display = 'none';

    const q = query(collection(db, "rooms", id, "messages"), orderBy("timestamp", "asc"));
    onSnapshot(q, (snap) => {
        const box = document.getElementById('chat-messages');
        if (!box) return;
        box.innerHTML = '';
        snap.forEach(doc => {
            const m = doc.data();
            const isMe = m.senderId === currentUser.uid;
            box.insertAdjacentHTML('beforeend', `
                <div class="message-wrapper ${isMe ? 'me' : 'them'}">
                    <div class="message-bubble">${m.text}</div>
                </div>
            `);
        });
        box.scrollTop = box.scrollHeight;
    });
}

// UI HANDLERS
document.addEventListener('DOMContentLoaded', () => {
    // Modal Open/Close
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

    // Message Sending
    document.getElementById('chat-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('message-input');
        if (!input.value.trim() || !activeChatId) return;

        await addDoc(collection(db, "rooms", activeChatId, "messages"), {
            text: input.value,
            senderId: currentUser.uid,
            timestamp: serverTimestamp()
        });
        input.value = '';
    });
});
