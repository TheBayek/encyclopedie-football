// Script JavaScript pour le site football
console.log("Bienvenue sur le site du football !");

// Fonction pour afficher un message
function afficherMessage() {
    alert("Football : le sport le plus populaire au monde !");
}

// Fonction pour changer la couleur du header au clic
document.addEventListener('DOMContentLoaded', function() {
    // Retiré : l'animation de couleur du header qui causait un bug flash
    // Animation des liens de navigation
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        link.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.1)';
            this.style.transition = 'transform 0.3s';
        });
        link.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
    });
    
    // Compteur de visites (simple)
    let visites = localStorage.getItem('visites') || 0;
    visites++;
    localStorage.setItem('visites', visites);
    console.log(`Nombre de visites : ${visites}`);

    // -- SYSTEME COMPTES/AUTH NAVBAR --
    const navs = document.querySelectorAll('nav ul');
    const userStr = localStorage.getItem('user');
    let navHtml = '';

    const inPagesDir = window.location.pathname.includes('/pages/');
    const loginLink = inPagesDir ? 'login.html' : 'pages/login.html';

    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            navHtml = `<li><a href="${loginLink}" style="color:#f1c40f;">👤 ${user.pseudo}</a></li>`;
        } catch(e) {}
    } else {
        navHtml = `<li><a href="${loginLink}" style="color:#1ABC9C;">🔐 Connexion</a></li>`;
    }

    if (navHtml) {
        navs.forEach(nav => {
            if (!nav.innerHTML.includes('Connexion') && !nav.innerHTML.includes('👤')) {
                nav.insertAdjacentHTML('beforeend', navHtml);
            }
        });
    }
});

// -- SYSTEME LEADERBOARD (Fenêtre Modale) --
window.showLeaderboard = async function(gameName, gameTitle) {
    let modal = document.getElementById('stat-modal');
    if(!modal) {
        modal = document.createElement('div');
        modal.id = 'stat-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;justify-content:center;align-items:center;z-index:9999;';
        document.body.appendChild(modal);
    }
    modal.innerHTML = `
        <div style="background: rgba(255,255,255,0.1); backdrop-filter: blur(25px); padding: 40px; border-radius: 20px; text-align: center; color: white; width: 90%; max-width: 450px; border: 1px solid rgba(255,255,255,0.3); box-shadow: 0 15px 35px rgba(0,0,0,0.5);">
            <h2 style="margin-bottom: 20px; font-size: 28px; text-shadow: 1px 1px 2px black;">🏆 Top 5 - ${gameTitle}</h2>
            <div id="leaderboard-content" style="min-height:150px;">Chargement du classement... ⏳</div>
            <button onclick="document.getElementById('stat-modal').style.display='none'" style="margin-top: 25px; padding: 12px 25px; border: none; border-radius: 10px; background: linear-gradient(135deg, #e74c3c, #c0392b); color: white; cursor: pointer; font-weight: bold; font-size:16px; transition: transform 0.2s;">Fermer ❌</button>
        </div>
    `;
    modal.style.display = 'flex';

    try {
        const res = await fetch(`/api/stats/leaderboard/${gameName}`);
        const data = await res.json();
        let content = '<ul style="list-style:none; padding:0; text-align:left; margin:0;">';
        data.forEach((p, i) => {
            const crown = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : '&nbsp;&nbsp;'));
            let color = i === 0 ? '#f1c40f' : (i === 1 ? '#bdc3c7' : (i === 2 ? '#cd7f32' : 'white'));
            content += `<li style="font-size:20px; padding: 12px; border-bottom:1px solid rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center;">
                <span style="color: ${color}; font-weight: ${i<3?'bold':'normal'};">${crown} ${i+1}. ${p.pseudo}</span>
                <strong style="color: #1ABC9C; font-size: 22px;">${p.score}</strong>
            </li>`;
        });
        if(data.length === 0) {
            content += "<li style='text-align:center; padding:20px;'>Aucun score enregistré pour le moment. Sois le premier !</li>";
        }
        content += '</ul>';
        document.getElementById('leaderboard-content').innerHTML = content;
    } catch(err) {
        document.getElementById('leaderboard-content').innerHTML = 'Erreur de chargement de la base de données.';
    }
}
