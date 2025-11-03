// URL de la API
const API_URL = 'https://jsonplaceholder.typicode.com/users';

// Elementos del DOM
const usersContainer = document.getElementById('users-container');
const loadingElement = document.getElementById('loading');

// Objeto para almacenar instancias de mapas
const maps = {};

// Función principal para obtener usuarios
async function fetchUsers() {
    try {
        showLoading();

        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const users = await response.json();
        hideLoading();
        displayUsers(users);

    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        hideLoading();
        showError(`Error al cargar los usuarios: ${error.message}`);
    }
}

function showLoading() {
    loadingElement.style.display = 'block';
    usersContainer.innerHTML = '';
}

function hideLoading() {
    loadingElement.style.display = 'none';
}

function showError(message) {
    usersContainer.innerHTML = `
        <div class="error">
            <h3>¡Oops! Algo salió mal</h3>
            <p>${message}</p>
            <button onclick="fetchUsers()" style="
                background: white;
                color: #e74c3c;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                margin-top: 10px;
                font-weight: bold;
            ">Reintentar</button>
        </div>
    `;
}

function displayUsers(users) {
    usersContainer.innerHTML = '';

    users.forEach(user => {
        const userCard = createUserCard(user);
        usersContainer.appendChild(userCard);
    });
}

function createUserCard(user) {
    const userCard = document.createElement('div');
    userCard.className = 'user-card';
    userCard.dataset.userId = user.id;
    userCard.userData = user;

    // NOTA: ponemos la .map-info fuera del contenedor del mapa para evitar superponer tiles
    userCard.innerHTML = `
        <div class="user-info">
            <h2>${escapeHtml(user.name)}</h2>
            <p><strong>👤 Usuario:</strong> ${escapeHtml(user.username)}</p>
            <p><strong>📧 Email:</strong> ${escapeHtml(user.email)}</p>
            <p><strong>📞 Teléfono:</strong> ${escapeHtml(user.phone)}</p>
            <p><strong>🏠 Dirección:</strong> ${escapeHtml(user.address.street)}, ${escapeHtml(user.address.city)}</p>
            <p><strong>🏢 Compañía:</strong> ${escapeHtml(user.company.name)}</p>
        </div>

        <div class="map-info" id="mapinfo-${user.id}">
            <p><strong>📍 Coordenadas:</strong> Lat: ${user.address.geo.lat}, Lng: ${user.address.geo.lng}</p>
            <div class="map-loading" id="loading-${user.id}">
                <div class="loading-spinner"></div>
                <p>Cargando mapa...</p>
            </div>
        </div>

        <div class="user-map" id="map-${user.id}"></div>
    `;

    userCard.addEventListener('click', (e) => {
        if (!e.target.closest('.user-map')) {
            toggleCard(userCard, user);
        }
    });

    return userCard;
}

function toggleCard(card, user) {
    const isExpanded = card.classList.contains('expanded');

    // cerrar otras
    document.querySelectorAll('.user-card.expanded').forEach(expandedCard => {
        if (expandedCard !== card) {
            expandedCard.classList.remove('expanded');
            const expandedUserId = expandedCard.dataset.userId;
            if (maps[expandedUserId]) {
                setTimeout(() => maps[expandedUserId].invalidateSize(), 300);
            }
        }
    });

    if (!isExpanded) {
        card.classList.add('expanded');

        // esperamos un poco más para que el layout termine (evita mapas con tiles faltantes)
        setTimeout(() => {
            initMap(user);
        }, 350);
    } else {
        card.classList.remove('expanded');
    }
}

function initMap(user) {
    const mapId = `map-${user.id}`;
    const mapContainer = document.getElementById(mapId);
    const loadingEl = document.getElementById(`loading-${user.id}`);

    if (!mapContainer) return;

    // aparecer loading
    if (loadingEl) loadingEl.style.display = 'block';

    // remover mapa previo si existe
    if (maps[user.id]) {
        try { maps[user.id].remove(); } catch(e){ /* ignore */ }
        delete maps[user.id];
    }

    const lat = parseFloat(user.address.geo.lat);
    const lng = parseFloat(user.address.geo.lng);

    if (isNaN(lat) || isNaN(lng)) {
        showMapError(mapContainer, 'Coordenadas inválidas para mostrar el mapa');
        return;
    }

    // esperamos un poco para asegurar que el contenedor tiene tamaño real (especialmente en mobile)
    setTimeout(() => {
        try {
            const map = L.map(mapId, {
                zoomControl: true,
                attributionControl: true,
                fadeAnimation: true,
                zoomAnimation: true
            }).setView([lat, lng], 10);

            const provider = {
                url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            };

            const tileLayer = L.tileLayer(provider.url, {
                attribution: provider.attribution,
                maxZoom: provider.maxZoom,
                // fallback invisible tile to avoid broken icon
                errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
            }).addTo(map);

            tileLayer.on('tileerror', () => {
                console.warn('tileerror: intentar con otro proveedor o revisar red');
                // si quieres puedes encadenar proveedores aquí
            });

            L.marker([lat, lng]).addTo(map)
                .bindPopup(`${escapeHtml(user.name)}<br>${escapeHtml(user.address.street)}, ${escapeHtml(user.address.city)}`);

            if (loadingEl) loadingEl.style.display = 'none';

            // invalidateSize después de que el mapa esté en DOM y visible
            setTimeout(() => {
                try {
                    map.invalidateSize(true);
                    map.setView([lat, lng], 10);
                } catch (e) {
                    console.warn('invalidateSize failed', e);
                }
            }, 500);

            maps[user.id] = map;

        } catch (error) {
            console.error('Error creando mapa:', error);
            showMapError(mapContainer, error.message || 'Error al crear mapa');
        }
    }, 350);
}

function showMapError(mapContainer, message) {
    // oculta loading si existe
    const loadingElement = mapContainer.previousElementSibling?.querySelector('.map-loading');
    if (loadingElement) loadingElement.style.display = 'none';

    // evita duplicar
    const existing = mapContainer.querySelector('.map-error');
    if (existing) existing.remove();

    mapContainer.insertAdjacentHTML('beforeend', `
        <div class="map-error">
            <h4>❌ Error al cargar el mapa</h4>
            <p>${message}</p>
            <button onclick="retryMap(${mapContainer.id.split('-')[1]})">Reintentar</button>
        </div>
    `);
}

function retryMap(userId) {
    const userCard = document.querySelector(`[data-user-id="${userId}"]`);
    if (userCard && userCard.classList.contains('expanded')) {
        // quitar error
        const mapContainer = document.getElementById(`map-${userId}`);
        const errorElement = mapContainer.querySelector('.map-error');
        if (errorElement) errorElement.remove();

        initMap(userCard.userData);
    }
}

function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return unsafe.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

document.addEventListener('DOMContentLoaded', fetchUsers);

window.addEventListener('resize', () => {
    Object.values(maps).forEach(map => {
        try { map.invalidateSize(); } catch (e) { /* ignore */ }
    });
});
