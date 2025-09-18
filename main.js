import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getDatabase, ref, set, onValue, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCdT2nWv0fF6jZmDfslIUvRKFun18rStWs",
  authDomain: "tracking-654e3.firebaseapp.com",
  databaseURL: "https://tracking-654e3-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tracking-654e3",
  storageBucket: "tracking-654e3.firebasestorage.app",
  messagingSenderId: "61074342637",
  appId: "1:61074342637:web:ee566c965c595668b5c2e4",
  measurementId: "G-Q5ZXKE7PTL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const profileScreen = document.getElementById('profileScreen');
const dashboardSection = document.getElementById('dashboardSection');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const darkModeToggle = document.getElementById('darkModeToggle');
const nameInput = document.getElementById('nameInput');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const startTrackingBtn = document.getElementById('startTrackingBtn');
const stopTrackingBtn = document.getElementById('stopTrackingBtn');
const profilePicture = document.getElementById('profilePicture');
const displayName = document.getElementById('displayName');
const displayEmail = document.getElementById('displayEmail');
const statusIndicator = document.getElementById('statusIndicator');
const trackingStatus = document.getElementById('trackingStatus');
const locationInfo = document.getElementById('locationInfo');
const latValue = document.getElementById('latValue');
const lngValue = document.getElementById('lngValue');
const accuracyValue = document.getElementById('accuracyValue');
const updateTime = document.getElementById('updateTime');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');

// State
let currentUser = null;
let isTracking = false;
let watchId = null;
let isDarkMode = localStorage.getItem('darkMode') === 'true';

// Initialize Dark Mode
if (isDarkMode) {
  document.body.classList.add('dark');
  darkModeToggle.innerHTML = '<i class="fas fa-sun text-yellow-400"></i>';
}

// Show Toast Notification
function showToast(message, duration = 3000) {
  toastMessage.textContent = message;
  toast.classList.remove('translate-y-full', 'opacity-0');
  
  setTimeout(() => {
    toast.classList.add('translate-y-full', 'opacity-0');
  }, duration);
}

// Dark Mode Toggle
darkModeToggle.addEventListener('click', () => {
  isDarkMode = !isDarkMode;
  localStorage.setItem('darkMode', isDarkMode);
  
  if (isDarkMode) {
    document.body.classList.add('dark');
    darkModeToggle.innerHTML = '<i class="fas fa-sun text-yellow-400"></i>';
  } else {
    document.body.classList.remove('dark');
    darkModeToggle.innerHTML = '<i class="fas fa-moon text-gray-700"></i>';
  }
});

// Login with Google
loginBtn.addEventListener('click', async () => {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (error) {
    showToast('Login gagal: ' + error.message);
  }
});

// Logout
logoutBtn.addEventListener('click', async () => {
  try {
    await signOut(auth);
    showToast('Logout berhasil!');
  } catch (error) {
    showToast('Logout gagal: ' + error.message);
  }
});

// Save Profile
saveProfileBtn.addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (!name) {
    showToast('Nama tidak boleh kosong');
    return;
  }
  
  const userRef = ref(database, `users/${currentUser.uid}`);
  set(userRef, {
    name: name,
    email: currentUser.email,
    photoURL: currentUser.photoURL,
    createdAt: serverTimestamp()
  }).then(() => {
    displayName.textContent = name;
    dashboardSection.classList.remove('hidden');
    showToast('Profil berhasil disimpan');
  }).catch(error => {
    showToast('Gagal menyimpan profil: ' + error.message);
  });
});

// Start Tracking
startTrackingBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    showToast('Geolocation tidak didukung oleh browser Anda');
    return;
  }
  
  isTracking = true;
  updateTrackingUI();
  showToast('Tracking dimulai');
  
  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      
      // Update UI
      latValue.textContent = latitude.toFixed(6);
      lngValue.textContent = longitude.toFixed(6);
      accuracyValue.textContent = accuracy.toFixed(2);
      updateTime.textContent = new Date().toLocaleTimeString();
      locationInfo.classList.remove('hidden');
      
      // Update to Firebase
      const locationRef = ref(database, `users/${currentUser.uid}/location`);
      set(locationRef, {
        lat: latitude,
        lng: longitude,
        accuracy: accuracy,
        timestamp: serverTimestamp()
      });
      
      const statusRef = ref(database, `users/${currentUser.uid}/status`);
      set(statusRef, 'active');
    },
    (error) => {
      showToast('Error: ' + error.message);
      stopTracking();
    },
    {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    }
  );
});

// Stop Tracking
stopTrackingBtn.addEventListener('click', stopTracking);

function stopTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  
  isTracking = false;
  updateTrackingUI();
  showToast('Tracking dihentikan');
  
  if (currentUser) {
    const statusRef = ref(database, `users/${currentUser.uid}/status`);
    set(statusRef, 'inactive');
  }
}

function updateTrackingUI() {
  if (isTracking) {
    statusIndicator.classList.add('bg-green-500');
    statusIndicator.classList.remove('bg-red-500');
    trackingStatus.textContent = 'Tracking Aktif';
    startTrackingBtn.classList.add('opacity-50', 'cursor-not-allowed');
    startTrackingBtn.disabled = true;
    stopTrackingBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    stopTrackingBtn.disabled = false;
  } else {
    statusIndicator.classList.add('bg-red-500');
    statusIndicator.classList.remove('bg-green-500');
    trackingStatus.textContent = 'Tracking Nonaktif';
    startTrackingBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    startTrackingBtn.disabled = false;
    stopTrackingBtn.classList.add('opacity-50', 'cursor-not-allowed');
    stopTrackingBtn.disabled = true;
  }
}

// Auth State Observer
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    
    // Update profile picture
    if (user.photoURL) {
      profilePicture.innerHTML = `<img src="${user.photoURL}" alt="Profile" class="w-16 h-16 rounded-full object-cover">`;
    }
    
    displayName.textContent = user.displayName || 'User';
    displayEmail.textContent = user.email;
    
    // Check if user has profile
    const userProfileRef = ref(database, `users/${user.uid}`);
    onValue(userProfileRef, (snapshot) => {
      const userData = snapshot.val();
      
      if (userData && userData.name) {
        nameInput.value = userData.name;
        dashboardSection.classList.remove('hidden');
      } else {
        dashboardSection.classList.add('hidden');
      }
      
      loginScreen.classList.add('hidden');
      profileScreen.classList.remove('hidden');
    }, (error) => {
      showToast('Error: ' + error.message);
    });
  } else {
    currentUser = null;
    loginScreen.classList.remove('hidden');
    profileScreen.classList.add('hidden');
    
    // Stop tracking if active
    if (isTracking) {
      stopTracking();
    }
  }
});