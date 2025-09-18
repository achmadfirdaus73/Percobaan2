import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getDatabase, ref, set, onValue, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCdT2nWv0fF6jZmDfslIUvRKFun18rStWs",
    authDomain: "tracking-654e3.firebaseapp.com",
    databaseURL: "https://tracking-654e3-default-rtdb.asia-southeast1.firebasedatabase.com",
    projectId: "tracking-654e3",
    storageBucket: "tracking-654e3.firebasestorage.app",
    messagingSenderId: "61074342637",
    appId: "1:61074342637:web:ee566c965c595668b5c2e4",
    measurementId: "G-Q5ZXKE7PTL"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// DOM Elements
const loadingScreen = document.getElementById('loadingScreen');
const loginScreen = document.getElementById('loginScreen');
const dashboardScreen = document.getElementById('dashboardScreen');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const darkModeToggle = document.getElementById('darkModeToggle');
const adminProfilePicture = document.getElementById('adminProfilePicture');
const adminName = document.getElementById('adminName');
const totalUsers = document.getElementById('totalUsers');
const activeUsers = document.getElementById('activeUsers');
const inactiveUsers = document.getElementById('inactiveUsers');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const exportBtn = document.getElementById('exportBtn');
const userTableBody = document.getElementById('userTableBody');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const userModal = document.getElementById('userModal');
const closeModal = document.getElementById('closeModal');
const modalUserName = document.getElementById('modalUserName');
const modalUserEmail = document.getElementById('modalUserEmail');
const modalUserStatus = document.getElementById('modalUserStatus');
const modalUserLocation = document.getElementById('modalUserLocation');
const modalUserLastUpdate = document.getElementById('modalUserLastUpdate');

// Elemen untuk popup OpenLayers
const popupContainer = document.getElementById('popup');
const popupContent = document.getElementById('popup-content');
const popupCloser = document.getElementById('popup-closer');

// State
let currentUser = null;
let users = [];
let filteredUsers = [];
let map = null;
let statusChart = null;
let hourlyChart = null;
let isDarkMode = localStorage.getItem('darkMode') === 'true';
let usersRef = null;
let locationDataRef = null;
let vectorSource;
let popupOverlay;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    if (isDarkMode) {
        document.body.classList.add('dark');
        darkModeToggle.querySelector('i').classList.replace('fa-moon', 'fa-sun');
    }
    auth.onAuthStateChanged(handleAuthStateChanged);
});

// Auth State Handler
function handleAuthStateChanged(user) {
    loadingScreen.classList.add('hidden');
    if (user) {
        currentUser = user;
        if (user.photoURL) {
            adminProfilePicture.innerHTML = `<img src="${user.photoURL}" alt="Profile" class="w-8 h-8 rounded-full object-cover">`;
        }
        adminName.textContent = user.displayName || 'Admin';

        // PENTING: Perbaikan logika pengecekan admin
        database.ref(`admins/${user.uid}`).once('value')
            .then((snapshot) => {
                const isAdmin = snapshot.val();
                if (isAdmin === true) {
                    loginScreen.classList.add('hidden');
                    dashboardScreen.classList.remove('hidden');
                    dashboardScreen.classList.add('fade-in');

                    if (!map) {
                        setTimeout(initMap, 100);
                    }
                    loadUsersData();
                    setupDatabaseListeners();
                } else {
                    showToast('Akses ditolak. Anda bukan admin.');
                    auth.signOut();
                }
            })
            .catch((error) => {
                console.error('Error checking admin status:', error);
                showToast('Error: ' + error.message);
                auth.signOut();
            });
    } else {
        currentUser = null;
        loginScreen.classList.remove('hidden');
        dashboardScreen.classList.add('hidden');
        if (usersRef) usersRef.off();
        if (locationDataRef) locationDataRef.off();
    }
}

// Setup Database Listeners
function setupDatabaseListeners() {
    usersRef = database.ref('users');
    usersRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            users = Object.keys(data).map(key => ({
                id: key,
                ...data[key]
            }));
            filterAndRender();
        }
    });

    locationDataRef = database.ref('location-data');
    locationDataRef.on('value', (snapshot) => {
        const locationData = snapshot.val() || {};
        users = users.map(user => {
            if (locationData[user.id]) {
                user.location = locationData[user.id];
            }
            return user;
        });
        filterAndRender();
    });
}

function filterAndRender() {
    filterUsers();
    updateStats();
    updateCharts();
}

// Load Users Data
function loadUsersData() {
    database.ref('users').once('value').then((snapshot) => {
        const data = snapshot.val();
        if (data) {
            users = Object.keys(data).map(key => ({
                id: key,
                ...data[key]
            }));
            filterAndRender();
        }
    }).catch((error) => {
        console.error('Error loading users data:', error);
        showToast('Error loading users data: ' + error.message);
    });
}

// Show/Hide Toast Notification
function showToast(message, duration = 3000) {
    toastMessage.textContent = message;
    toast.classList.add('show');
    toast.classList.remove('translate-y-full', 'opacity-0');
    setTimeout(() => hideToast(), duration);
}

function hideToast() {
    toast.classList.remove('show');
    toast.classList.add('translate-y-full', 'opacity-0');
}

// Dark Mode Toggle
darkModeToggle.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    localStorage.setItem('darkMode', isDarkMode);
    document.body.classList.toggle('dark');
    const icon = darkModeToggle.querySelector('i');
    if (isDarkMode) {
        icon.classList.replace('fa-moon', 'fa-sun');
    } else {
        icon.classList.replace('fa-sun', 'fa-moon');
    }
});

// Login & Logout
loginBtn.addEventListener('click', async () => {
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Loading...';
    loginBtn.disabled = true;
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
        await auth.signInWithPopup(provider);
    } catch (error) {
        console.error('Login error:', error);
        showToast('Login gagal: ' + error.message);
    } finally {
        loginBtn.innerHTML = '<i class="fab fa-google mr-2"></i>Login dengan Google';
        loginBtn.disabled = false;
    }
});

logoutBtn.addEventListener('click', () => auth.signOut().then(() => showToast('Logout berhasil!')));

// Export to CSV
exportBtn.addEventListener('click', () => {
    const csv = Papa.unparse(filteredUsers);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'users.csv';
    link.click();
    showToast('Data berhasil diexport');
});

// Filter & Render Table
searchInput.addEventListener('input', filterUsers);
statusFilter.addEventListener('change', filterUsers);

function filterUsers() {
    const searchTerm = searchInput.value.toLowerCase();
    const statusValue = statusFilter.value;
    filteredUsers = users.filter(user => {
        const name = user.name || '';
        const email = user.email || '';
        const matchesSearch = name.toLowerCase().includes(searchTerm) || email.toLowerCase().includes(searchTerm);
        const matchesStatus = statusValue === 'all' || user.status === statusValue;
        return matchesSearch && matchesStatus;
    });
    renderUserTable();
    updateUserMarkers();
}

function renderUserTable() {
    if (filteredUsers.length === 0) {
        userTableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">No users found</td></tr>`;
        return;
    }
    userTableBody.innerHTML = filteredUsers.map(user => `
        <tr class="user-row" onclick="showUserModal('${user.id}')">
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10">
                        ${user.photoURL ?
                            `<img class="h-10 w-10 rounded-full" src="${user.photoURL}" alt="" />` :
                            `<div class="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center"><i class="fas fa-user text-gray-500"></i></div>`
                        }
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">${user.name || 'Unknown'}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap"><div class="text-sm text-gray-900">${user.email || 'N/A'}</div></td>
            <td class="px-6 py-4 whitespace-nowrap"><span class="badge ${user.status === 'active' ? 'badge-green' : 'badge-red'}">${user.status || 'inactive'}</span></td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.location ? `${user.location.lat?.toFixed(4)}, ${user.location.lng?.toFixed(4)}` : 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.location?.timestamp ? new Date(user.location.timestamp).toLocaleString() : 'Never'}</td>
        </tr>
    `).join('');
}

// Modal Logic
function showUserModal(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    modalUserName.textContent = user.name || 'Unknown';
    modalUserEmail.textContent = `Email: ${user.email || 'N/A'}`;
    modalUserStatus.innerHTML = `Status: <span class="badge ${user.status === 'active' ? 'badge-green' : 'badge-red'}">${user.status || 'inactive'}</span>`;
    modalUserLocation.textContent = `Location: ${user.location ? `${user.location.lat?.toFixed(4)}, ${user.location.lng?.toFixed(4)}` : 'N/A'}`;
    modalUserLastUpdate.textContent = `Last Update: ${user.location?.timestamp ? new Date(user.location.timestamp).toLocaleString() : 'Never'}`;
    userModal.classList.remove('hidden');
}

closeModal.addEventListener('click', () => userModal.classList.add('hidden'));
window.addEventListener('click', (event) => {
    if (event.target === userModal) userModal.classList.add('hidden');
});

// --- OpenLayers Map Implementation ---
function initMap() {
    vectorSource = new ol.source.Vector();
    const vectorLayer = new ol.layer.Vector({
        source: vectorSource,
        style: new ol.style.Style({
            image: new ol.style.Circle({
                radius: 7,
                fill: new ol.style.Fill({ color: '#3B82F6' }),
                stroke: new ol.style.Stroke({ color: '#FFFFFF', width: 2 })
            })
        })
    });
    
    popupOverlay = new ol.Overlay({
        element: popupContainer,
        autoPan: { animation: { duration: 250 } }
    });
    popupCloser.onclick = () => {
        popupOverlay.setPosition(undefined);
        popupCloser.blur();
        return false;
    };

    map = new ol.Map({
        target: 'map',
        layers: [
            new ol.layer.Tile({
                source: new ol.source.OSM()
            }),
            vectorLayer
        ],
        overlays: [popupOverlay],
        view: new ol.View({
            center: ol.proj.fromLonLat([106.8456, -6.2088]),
            zoom: 10
        })
    });
    
    map.on('click', function(evt) {
        const feature = map.forEachFeatureAtPixel(evt.pixel, (feature) => feature);
        if (feature) {
            const coordinates = feature.getGeometry().getCoordinates();
            popupOverlay.setPosition(coordinates);
            const userData = feature.get('userData');
            popupContent.innerHTML = `
                <h3 class="font-bold text-base mb-1">${userData.name || 'Unknown'}</h3>
                <p class="text-xs text-gray-600">${userData.email || 'N/A'}</p>
                <p class="text-xs mt-2">Status: <span class="font-semibold ${userData.status === 'active' ? 'text-green-600' : 'text-red-600'}">${userData.status}</span></p>
                <p class="text-xs">Update: ${new Date(userData.location.timestamp).toLocaleTimeString()}</p>
            `;
        } else {
            popupOverlay.setPosition(undefined);
            popupCloser.blur();
        }
    });
}

function updateUserMarkers() {
    if (!map || !vectorSource) return;
    vectorSource.clear();
    const features = [];
    filteredUsers.forEach(user => {
        if (user.location?.lat && user.location?.lng) {
            const feature = new ol.Feature({
                geometry: new ol.geom.Point(ol.proj.fromLonLat([user.location.lng, user.location.lat])),
                userData: user
            });
            features.push(feature);
        }
    });
    if (features.length > 0) {
        vectorSource.addFeatures(features);
        map.getView().fit(vectorSource.getExtent(), { padding: [50, 50, 50, 50], duration: 500 });
    }
}

// Update Stats & Charts
function updateStats() {
    totalUsers.textContent = users.length;
    activeUsers.textContent = users.filter(u => u.status === 'active').length;
    inactiveUsers.textContent = users.filter(u => u.status === 'inactive').length;
}

function updateCharts() {
    const activeCount = users.filter(u => u.status === 'active').length;
    const inactiveCount = users.filter(u => u.status === 'inactive').length;
    if (statusChart) statusChart.destroy();
    statusChart = new Chart(document.getElementById('statusChart').getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Active', 'Inactive'],
            datasets: [{
                data: [activeCount, inactiveCount],
                backgroundColor: ['#10B981', '#EF4444'],
                borderWidth: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });

    const hourlyData = Array(24).fill(0);
    users.forEach(user => {
        if (user.location?.timestamp) {
            const hour = new Date(user.location.timestamp).getHours();
            hourlyData[hour]++;
        }
    });
    if (hourlyChart) hourlyChart.destroy();
    hourlyChart = new Chart(document.getElementById('hourlyChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
            datasets: [{
                label: 'User Activity',
                data: hourlyData,
                backgroundColor: '#3B82F6',
                borderColor: '#2563EB',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}
