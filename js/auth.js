function toggleAuth(mode) {
    document.getElementById('login-box').style.display = mode === 'login' ? 'block' : 'none';
    document.getElementById('register-box').style.display = mode === 'register' ? 'block' : 'none';
    document.getElementById('logged-box').style.display = 'none';
}

function checkAuthState() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (token && userStr) {
        const user = JSON.parse(userStr);
        document.getElementById('login-box').style.display = 'none';
        document.getElementById('register-box').style.display = 'none';
        document.getElementById('logged-box').style.display = 'block';
        document.getElementById('welcome-msg').innerText = `Bienvenue, ${user.pseudo} 👤`;
        
        // Charger les statistiques personnelles
        fetch('/api/stats/me', { headers: { 'x-auth-token': token } })
            .then(res => res.json())
            .then(data => {
                const grid = document.getElementById('stats-grid');
                if(grid) {
                    grid.innerHTML = `
                        <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:10px;"><strong>🏃 Dribbles :</strong> <span style="color:#1ABC9C; float:right; font-weight:bold;">${data.dribble || 0}</span></div>
                        <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:10px;"><strong>🦅 Flappy :</strong> <span style="color:#1ABC9C; float:right; font-weight:bold;">${data.flappy || 0}</span></div>
                        <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:10px;"><strong>🧤 Arrêts :</strong> <span style="color:#1ABC9C; float:right; font-weight:bold;">${data.gardien || 0}</span></div>
                        <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:10px;"><strong>👟 Jongles :</strong> <span style="color:#1ABC9C; float:right; font-weight:bold;">${data.jongles || 0}</span></div>
                        <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:10px;"><strong>🎯 Pénos :</strong> <span style="color:#1ABC9C; float:right; font-weight:bold;">${data.penalty || 0}</span></div>
                        <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:10px;"><strong>🏓 Pong :</strong> <span style="color:#1ABC9C; float:right; font-weight:bold;">${data.pong || 0}</span></div>
                    `;
                }
            }).catch(e => console.log('Erreur stats', e));

    } else {
        toggleAuth('login');
    }
}

document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pseudo = document.getElementById('reg-pseudo').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const errBox = document.getElementById('reg-error');
    errBox.style.display = 'none';

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pseudo, email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Erreur serveur');
        
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        checkAuthState();
        window.location.reload(); // Refresh to update navbar
    } catch (err) {
        errBox.innerText = err.message;
        errBox.style.display = 'block';
    }
});

document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('log-email').value;
    const password = document.getElementById('log-password').value;
    const errBox = document.getElementById('log-error');
    errBox.style.display = 'none';

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Erreur serveur');
        
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        checkAuthState();
        window.location.reload(); // Refresh to update navbar
    } catch (err) {
        errBox.innerText = err.message;
        errBox.style.display = 'block';
    }
});

function logoutAction() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
}

// Global Nav Update: Append 'Espace Membre' or 'Pseudo' to the navbar automatically on every page.
window.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('login-box')) {
        checkAuthState();
    }

    const navs = document.querySelectorAll('nav ul');
    const userStr = localStorage.getItem('user');
    let navHtml = '';

    // Determine the correct path to login.html depending on if we are in /pages/ or root
    const inPagesDir = window.location.pathname.includes('/pages/');
    const loginLink = inPagesDir ? 'login.html' : 'pages/login.html';

    if (userStr) {
        const user = JSON.parse(userStr);
        navHtml = `<li><a href="${loginLink}" style="color:#f1c40f;">👤 ${user.pseudo}</a></li>`;
    } else {
        navHtml = `<li><a href="${loginLink}">🔐 Connexion</a></li>`;
    }

    navs.forEach(nav => {
        // Prevent duplicate appending
        if (!nav.innerHTML.includes('Connexion') && !nav.innerHTML.includes('👤')) {
            nav.insertAdjacentHTML('beforeend', navHtml);
        }
    });
});
