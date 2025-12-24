import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { initializeFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// 1. FIREBASE CONFIGURATION
const firebaseConfig = {
    apiKey: "AIzaSyCEUDD0iB4iGFSDoC0a3wCXF8PT098Su3w",
    authDomain: "anonymous-messaging-f93c0.firebaseapp.com",
    projectId: "anonymous-messaging-f93c0",
    storageBucket: "anonymous-messaging-f93c0.firebasestorage.app",
    messagingSenderId: "990716606250",
    appId: "1:990716606250:web:a82a15347cc5980aa01053"
};

// 2. INITIALIZATION WITH POLLING FIX
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    experimentalForceLongPolling: true // CRITICAL: Fixes the 4G Transport Error
});

let currentUser = null;
const urlParams = new URLSearchParams(window.location.search);
const activeChatId = urlParams.get('id');

// 3. AUTHENTICATION FLOW
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        console.log("Verified User ID:", user.uid);
        // If the URL has an ID, we load that chat immediately
        if (activeChatId) {
            loadChatRoom(activeChatId);
        }
    } else {
        signInAnonymously(auth).catch(err => console.error("Auth Error:", err));
    }
});

// 4. THE CREATE ROOM & REDIRECT LOGIC
window.startVibe = async function(vibeType) {
    if (!currentUser) {
        alert("Connecting to tbh... please wait.");
        return;
    }

    // Show the loading screen (added to HTML in previous step)
    const loader = document.getElementById('global-loader');
    if (loader) loader.style.display = 'flex';

    try {
        // Create the room document
        const docRef = await addDoc(collection(db, "rooms"), {
            type: vibeType,
            createdBy: currentUser.uid,
            createdAt: serverTimestamp(),
            vibeName: vibeType === 'private' ? 'One-on-One' : 'Community'
        });

        console.log("Room Created with ID:", docRef.id);

        // THE NEXT STEP: Redirecting to the chat URL
        window.location.href = `chat.html?id=${docRef.id}`;
        
    } catch (error) {
        if (loader) loader.style.display = 'none';
        console.error("Room Creation Failed:", error);
        alert("Failed to start vibe. Check your internet connection.");
    }
};

// 5. LIVE CHAT ENGINE
function loadChatRoom(roomId) {
    const chatInterface = document.getElementById('active-chat-interface');
    const emptyState = document.getElementById('no-chat-selected');
    
    // Switch UI Views
    if (chatInterface) chatInterface.style.display = 'flex';
    if (emptyState) emptyState.style.display = 'none';

    // Listen for messages in this specific room
    const q = query(
        collection(db, "rooms", roomId, "messages"), 
        orderBy("timestamp", "asc")
    );

    onSnapshot(q, (snapshot) => {
        const messageContainer = document.getElementById('chat-messages');
        if (!messageContainer) return;

        messageContainer.innerHTML = ''; // Clear previous messages
        
        snapshot.forEach((doc) => {
            const data = doc.data();
            const isMe = data.senderId === currentUser.uid;
            
            const messageHtml = `
                <div class="message-wrapper ${isMe ? 'me' : 'them'}">
                    <div class="message-bubble">${data.text}</div>
                </div>
            `;
            messageContainer.insertAdjacentHTML('beforeend', messageHtml);
        });

        // Auto-scroll to bottom
        messageContainer.scrollTop = messageContainer.scrollHeight;
    });
}

// 6. UI INTERACTION & FORM SUBMISSION
document.addEventListener('DOMContentLoaded', () => {
    // Theme Management
    const savedTheme = localStorage.getItem('tbh-theme') || 'dark-theme';
    document.body.className = savedTheme + ' has-sidebar';

    // Modal Controls
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

    // Send Message Logic
    const chatForm = document.getElementById('chat-form');
    if (chatForm) {
        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('message-input');
            
            if (!input.value.trim() || !activeChatId || !currentUser) return;

            try {
                await addDoc(collection(db, "rooms", activeChatId, "messages"), {
                    text: input.value,
                    senderId: currentUser.uid,
                    timestamp: serverTimestamp()
                });
                input.value = ''; // Clear input
            } catch (err) {
                console.error("Error sending message:", err);
            }
        });
    }
});

