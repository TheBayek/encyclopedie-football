// Moteur de jeu de FIFA Pixel (Pro)

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const mainMenu = document.getElementById("mainMenu");
const levelsGrid = document.getElementById("levelsGrid");
const hudLevel = document.getElementById("hudLevel");

let maxLevelUnlocked = 1;
let currentLevel = 1;
let gameLoopId = null;
let isPlaying = false;

// Config Terrain
let CW, CH;
const WORLD_W = 1200;
const WORLD_H = 1800;
let camX = 0, camY = 0;
const GOAL_WIDTH = 150;

// Entités
let ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, owner: null, cooldown: 0 };
let myTeam = [];
let enemyTeam = [];
let controlledPlayer = null;
let enemyGoalie = null;
let myGoalie = null;

// Inputs
let keys = { w:false, a:false, s:false, d:false, z:false, q:false, ArrowUp:false, ArrowLeft:false, ArrowDown:false, ArrowRight:false };
let joyX = 0, joyY = 0;

// Fetch DB Progress
async function fetchProgress() {
    const token = localStorage.getItem('token');
    if(!token) return maxLevelUnlocked;
    try {
        const res = await fetch('/api/stats/me', { headers: { 'x-auth-token': token } });
        if(res.ok) {
            const data = await res.json();
            let dbLevel = (data.fifa !== undefined) ? data.fifa + 1 : 1;
            return Math.max(dbLevel, maxLevelUnlocked); 
        }
    } catch(e) { console.error(e); }
    return maxLevelUnlocked;
}

// Envoyer progression API
async function unlockNextLevel() {
    if(currentLevel >= maxLevelUnlocked) {
        maxLevelUnlocked = currentLevel + 1;
        const token = localStorage.getItem('token');
        if(token) {
            await fetch('/api/stats/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                body: JSON.stringify({ game: 'fifa', score: currentLevel })
            }).catch(e=>console.log(e));
        }
    }
}

// Initialisation Menu
async function initMenu() {
    maxLevelUnlocked = await fetchProgress();
    // Limite max level 50
    if(maxLevelUnlocked > 50) maxLevelUnlocked = 50;
    
    levelsGrid.innerHTML = "";
    for(let i=1; i<=50; i++) {
        let btn = document.createElement("button");
        btn.className = "level-btn " + (i <= maxLevelUnlocked ? "unlocked" : "locked");
        btn.innerHTML = i <= maxLevelUnlocked ? `Niveau ${i}` : `🔒 Niv ${i}`;
        
        if(i <= maxLevelUnlocked) {
            btn.onclick = () => launchGame(i);
        }
        levelsGrid.appendChild(btn);
    }
    mainMenu.style.display = "flex";
}

// Joystick Logique Mobile
const stick = document.getElementById("stick");
const joyZone = document.getElementById("joystickZone");
let joyActive = false, joyCenterX = 0, joyCenterY = 0;

joyZone.addEventListener("touchstart", (e) => {
    e.preventDefault();
    joyActive = true;
    let rect = joyZone.getBoundingClientRect();
    joyCenterX = rect.left + rect.width / 2;
    joyCenterY = rect.top + rect.height / 2;
    updateJoystick(e.touches[0]);
}, {passive: false});

joyZone.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if(joyActive) updateJoystick(e.touches[0]);
}, {passive: false});

joyZone.addEventListener("touchend", (e) => {
    e.preventDefault();
    joyActive = false;
    stick.style.transform = `translate(0px, 0px)`;
    joyX = 0; joyY = 0;
});

function updateJoystick(touch) {
    let dx = touch.clientX - joyCenterX;
    let dy = touch.clientY - joyCenterY;
    let distance = Math.hypot(dx, dy);
    let maxDist = 40;
    
    if(distance > maxDist) {
        dx = (dx / distance) * maxDist;
        dy = (dy / distance) * maxDist;
    }
    stick.style.transform = `translate(${dx}px, ${dy}px)`;
    
    // Normalize entre -1 et 1
    joyX = dx / maxDist;
    joyY = dy / maxDist;
}

// Clavier
window.addEventListener("keydown", e => { if(keys.hasOwnProperty(e.key)) keys[e.key] = true; });
window.addEventListener("keyup", e => { if(keys.hasOwnProperty(e.key)) keys[e.key] = false; });

// Tirs et Passes (Système Hybride)
let isCharging = false;
let chargeStartTime = 0;
let isDragging = false;
let dragCurrentX = 0, dragCurrentY = 0;
let isLob = false;

canvas.addEventListener("contextmenu", e => e.preventDefault());
canvas.addEventListener("mousedown", startCharge);
canvas.addEventListener("touchstart", (e) => { e.preventDefault(); startCharge(e.touches[0] || e); }, {passive: false});

function startCharge(e) {
    if(!isPlaying || !controlledPlayer) return;
    
    let rect = canvas.getBoundingClientRect();
    let cx = (e.clientX || e.clientX===0 ? e.clientX : e.touches[0].clientX) - rect.left + camX;
    let cy = (e.clientY || e.clientY===0 ? e.clientY : e.touches[0].clientY) - rect.top + camY;
    
    // Tacle direct si pas la balle
    if(ball.owner !== controlledPlayer) {
        
        // Tacle manuel
        let clickedEnemy = null;
        for(let e of enemyTeam) {
            if(Math.hypot(e.x - cx, e.y - cy) < 40) {
               clickedEnemy = e; break; 
            }
        }
        if(clickedEnemy) {
            let distToEnemy = Math.hypot(controlledPlayer.x - clickedEnemy.x, controlledPlayer.y - clickedEnemy.y);
            if(distToEnemy < 60) {
                // Tacle réussi
                if(ball.owner === clickedEnemy && !(clickedEnemy.tackleImmunity > 0)) {
                    ball.owner = controlledPlayer;
                    controlledPlayer.tackleImmunity = 30; // Immunité pour reculer
                } else {
                    clickedEnemy.speed = 0;
                    setTimeout(() => { clickedEnemy.speed = 2 + currentLevel * 0.5; }, 2000);
                }
            }
        }
        return;
    }

    // Sinon, on démarre la visée (Drag pour Mobile, Charge pour PC)
    isLob = (e.button === 2); // Détection clic droit
    if (e.type.startsWith('touch')) {
        isDragging = true;
        dragCurrentX = cx;
        dragCurrentY = cy;
    } else {
        isCharging = true;
        chargeStartTime = Date.now();
    }
}

canvas.addEventListener("mousemove", updateDrag);
canvas.addEventListener("touchmove", (e) => { e.preventDefault(); updateDrag(e.touches[0] || e); }, {passive: false});

function updateDrag(e) {
    if(!isDragging) return;
    let rect = canvas.getBoundingClientRect();
    dragCurrentX = (e.clientX || e.clientX===0 ? e.clientX : e.changedTouches?.[0].clientX) - rect.left + camX;
    dragCurrentY = (e.clientY || e.clientY===0 ? e.clientY : e.changedTouches?.[0].clientY) - rect.top + camY;
}

canvas.addEventListener("mouseup", endCharge);
canvas.addEventListener("touchend", (e) => { e.preventDefault(); endCharge(e.changedTouches[0] || e); }, {passive: false});

function endCharge(e) {
    if(!isPlaying || !controlledPlayer) return;
    let isTouch = e.type.startsWith('touch');

    let rect = canvas.getBoundingClientRect();
    let cx = (e.clientX || e.clientX===0 ? e.clientX : (e.changedTouches ? e.changedTouches[0].clientX : 0)) - rect.left + camX;
    let cy = (e.clientY || e.clientY===0 ? e.clientY : (e.changedTouches ? e.changedTouches[0].clientY : 0)) - rect.top + camY;

    if (isDragging && isTouch) {
        isDragging = false;
        if(ball.owner === controlledPlayer) {
            let dx = dragCurrentX - controlledPlayer.x;
            let dy = dragCurrentY - controlledPlayer.y;
            let dist = Math.hypot(dx, dy);
            let dirX = dist > 0 ? dx/dist : 0; 
            let dirY = dist > 0 ? dy/dist : -1;

            if(dist > 50) {
                // Frappe
                let power = Math.min(1, dist / 300); // 300px max
                let speed = 10 + power * 18; // Max 28
                ball.owner = null;
                ball.cooldown = 15;
                ball.vx = dirX * speed;
                ball.vy = dirY * speed;
                ball.vz = speed * 0.3; // Lob réduit pour éviter les lobs cheatés de bout en bout
            } else if(dist > 10) {
                // Passe douce
                ball.owner = null;
                ball.cooldown = 15;
                ball.vx = dirX * 8;
                ball.vy = dirY * 8;
                ball.vz = 3; // Petite cloche
            }
        }
    } else if (isCharging && !isTouch) {
        isCharging = false;
        if(ball.owner === controlledPlayer) {
            let duration = Date.now() - chargeStartTime;
            let dx = cx - controlledPlayer.x;
            let dy = cy - controlledPlayer.y;
            let dist = Math.hypot(dx, dy);
            let dirX = dist > 0 ? dx/dist : 0; 
            let dirY = dist > 0 ? dy/dist : -1;

            if(duration > 400) {
                // FRAPPE Puissante
                let speed = 8 + (duration / 5000) * 20; 
                if(speed > 28) speed = 28;
                
                ball.owner = null;
                ball.cooldown = 15;
                ball.vx = dirX * speed;
                ball.vy = dirY * speed;
                if(isLob) ball.vz = speed * 0.35; // Lob manuel réduit
            } else {
                // PASSE Douce
                let bestMate = null;
                let minDist = 9999;
                for(let p of myTeam) {
                    if(p === controlledPlayer) continue;
                    let d = Math.hypot(p.x - cx, p.y - cy);
                    if(d < minDist) { minDist = d; bestMate = p; }
                }
                if(bestMate) {
                    ball.owner = null;
                    ball.cooldown = 15;
                    let px = bestMate.x - controlledPlayer.x;
                    let py = bestMate.y - controlledPlayer.y;
                    let pd = Math.hypot(px, py);
                    let passSpeed = isLob ? 6 : 8; // Passe lobée plus lente et flottante
                    ball.vx = (px/pd) * passSpeed;
                    ball.vy = (py/pd) * passSpeed;
                    if(isLob) ball.vz = 5; 
                    controlledPlayer = bestMate; 
                }
            }
        }
    }
}




// Moteur Physique
function launchGame(level) {
    currentLevel = level;
    mainMenu.style.display = "none";
    hudLevel.innerText = currentLevel;
    isPlaying = true;
    
    CW = window.innerWidth;
    CH = window.innerHeight;
    canvas.width = CW;
    canvas.height = CH;

    myTeam = [];
    enemyTeam = [];
    
    // Spawn Team Bleue (3 joueurs)
    myTeam.push({ x: WORLD_W/2, y: WORLD_H - 200, color: "blue", speed: 5 });
    myTeam.push({ x: WORLD_W/2 - 100, y: WORLD_H - 350, color: "blue", speed: 4.5 });
    myTeam.push({ x: WORLD_W/2 + 100, y: WORLD_H - 350, color: "blue", speed: 4.5 });
    controlledPlayer = myTeam[0];

    // Spawn Team Rouge en fonction du niveau (Max 11 joueurs)
    let nbEnemies = Math.min(11, currentLevel + 1);
    let enemySpeed = Math.min(5.5, 2 + currentLevel * 0.15);
    for(let i=0; i<nbEnemies; i++) {
        enemyTeam.push({ x: WORLD_W/2 + (Math.random()-0.5)*WORLD_W*0.6, y: 150 + Math.random()*WORLD_H*0.4, color: "red", speed: enemySpeed });
    }
    let goalieSpeed = Math.min(7, 3 + currentLevel * 0.2);
    enemyGoalie = { x: WORLD_W/2, y: 50, color: "yellow", speed: goalieSpeed };
    myGoalie = { x: WORLD_W/2, y: WORLD_H - 50, color: "lightgreen", speed: 4 };

    ball.x = WORLD_W/2; ball.y = WORLD_H/2 + 200; ball.z = 0; ball.vx = 0; ball.vy = 0; ball.vz = 0; ball.owner = null;

    if(gameLoopId) cancelAnimationFrame(gameLoopId);
    gameLoop();
}

function endGame(win, isEnemyGoal = false) {
    isPlaying = false;
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.fillRect(0,0,CW,CH);
    ctx.fillStyle = "white";
    ctx.font = "bold 40px Arial";
    ctx.textAlign = "center";
    
    if(win) {
        ctx.fillStyle = "gold";
        ctx.fillText("BUT ! NIVEAU TERMINÉ 🏆", CW/2, CH/2);
        unlockNextLevel();
    } else {
        ctx.fillStyle = "red";
        if (isEnemyGoal) {
            ctx.fillText("BUT ENCAISSÉ ! PERDU 💥", CW/2, CH/2);
        } else {
            ctx.fillText("FIN DU MATCH", CW/2, CH/2);
        }
    }
    
    setTimeout(() => {
        initMenu();
    }, 2000);
}

function drawPitch() {
    ctx.fillStyle = "#27ae60"; // Gazon
    ctx.fillRect(0,0,WORLD_W,WORLD_H);
    // Lignes blanches
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 4;
    // Ligne médiane
    ctx.beginPath(); ctx.moveTo(0, WORLD_H/2); ctx.lineTo(WORLD_W, WORLD_H/2); ctx.stroke();
    // Rond central
    ctx.beginPath(); ctx.arc(WORLD_W/2, WORLD_H/2, 60, 0, Math.PI*2); ctx.stroke();
    // Surface réparation Ennemie
    ctx.strokeRect(WORLD_W/2 - 150, 0, 300, 150);
    // But Ennemi
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.fillRect(WORLD_W/2 - GOAL_WIDTH/2, 0, GOAL_WIDTH, 20);

    // Surface réparation Alliée
    ctx.strokeRect(WORLD_W/2 - 150, WORLD_H - 150, 300, 150);
    // But Allié
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.fillRect(WORLD_W/2 - GOAL_WIDTH/2, WORLD_H - 20, GOAL_WIDTH, 20);
}

function gameLoop() {
    if(!isPlaying) return;
    
    // Decrement immunities & stuns
    for(let p of myTeam) {
        if(p.tackleImmunity > 0) p.tackleImmunity--;
        if(p.stunned > 0) p.stunned--;
    }
    for(let e of enemyTeam) {
        if(e.tackleImmunity > 0) e.tackleImmunity--;
        // enemy stunned is decremented in their AI loop
    }

    // Remplir le fond hors monde
    ctx.fillStyle = "#111";
    ctx.fillRect(0,0,CW,CH);

    // Calcul de la caméra
    let targetCamX, targetCamY;
    if(controlledPlayer) {
        targetCamX = controlledPlayer.x - CW/2;
        targetCamY = controlledPlayer.y - CH/2;
    } else {
        targetCamX = ball.x - CW/2;
        targetCamY = ball.y - CH/2;
    }
    
    camX += (targetCamX - camX) * 0.1; // Smooth camera
    camY += (targetCamY - camY) * 0.1;
    
    let maxCamX = Math.max(0, WORLD_W - CW);
    let maxCamY = Math.max(0, WORLD_H - CH);

    camX = Math.max(0, Math.min(maxCamX, camX));
    camY = Math.max(0, Math.min(maxCamY, camY));

    // Si l'écran est plus grand que le terrain, on centre
    if(CW > WORLD_W) camX = -(CW - WORLD_W)/2;
    if(CH > WORLD_H) camY = -(CH - WORLD_H)/2;

    ctx.save();
    ctx.translate(-camX, -camY);

    drawPitch();

    // Mouvements Joueur Actif
    let dx = 0, dy = 0;
    if(keys.w || keys.z || keys.ArrowUp) dy -= 1;
    if(keys.s || keys.ArrowDown) dy += 1;
    if(keys.a || keys.q || keys.ArrowLeft) dx -= 1;
    if(keys.d || keys.ArrowRight) dx += 1;
    
    // Combinaison clavier + joystick
    dx += joyX; dy += joyY;
    
    // Normalisation si clavier diagonal
    if(dx !== 0 && dy !== 0 && joyX === 0) {
        let mag = Math.hypot(dx, dy);
        dx /= mag; dy /= mag;
    }

    if(controlledPlayer) {
        controlledPlayer.x += dx * controlledPlayer.speed;
        controlledPlayer.y += dy * controlledPlayer.speed;
        if(dx !== 0 || dy !== 0) controlledPlayer.animPhase = (controlledPlayer.animPhase || 0) + 0.3;

        // Frontières
        controlledPlayer.x = Math.max(15, Math.min(WORLD_W-15, controlledPlayer.x));
        controlledPlayer.y = Math.max(15, Math.min(WORLD_H-15, controlledPlayer.y));
    }

    // Dessin Joueurs AI Bleus
    for(let p of myTeam) {
        if(p === controlledPlayer) continue;
        let tx = p.x; let ty = p.y;
        // IA basique : monter avec le porteur
        if(ball.owner) {
            if(p === myTeam[0]) { tx = ball.x + 80; ty = ball.y; }
            if(p === myTeam[1]) { tx = ball.x - 80; ty = ball.y; }
            if(p === myTeam[2]) { tx = ball.x; ty = ball.y + 100; }
        }
        let dxAI = tx - p.x; let dyAI = ty - p.y;
        let dAI = Math.hypot(dxAI, dyAI);
        if(dAI > 5) {
            p.x += (dxAI/dAI) * (p.speed * 0.5);
            p.y += (dyAI/dAI) * (p.speed * 0.5);
            p.animPhase = (p.animPhase || 0) + 0.2;
        }
        p.x = Math.max(15, Math.min(WORLD_W-15, p.x));
        p.y = Math.max(15, Math.min(WORLD_H-15, p.y));
    }

    // IA Défenseurs
    // 1. Trouver qui est le plus proche de la balle
    let closestEnemy = null;
    let minDistEnemy = Infinity;
    for(let e of enemyTeam) {
        if(e.stunned > 0) { e.stunned--; continue; }
        if(ball.owner === e) {
            closestEnemy = e;
            minDistEnemy = 0;
            break;
        }
        let d = Math.hypot(ball.x - e.x, ball.y - e.y);
        if(d < minDistEnemy) { minDistEnemy = d; closestEnemy = e; }
    }

    // 2. Comportement des défenseurs
    for(let i=0; i<enemyTeam.length; i++) {
        let e = enemyTeam[i];
        if(e.stunned > 0) continue;
        
        let tx = e.x, ty = e.y;
        if(e === closestEnemy) {
            if (ball.owner === e) {
                // Fonce vers notre ligne de fond
                tx = WORLD_W/2; ty = WORLD_H;
            } else {
                // Le plus proche fonce sur la balle
                tx = ball.x; ty = ball.y;
            }
        } else {
            // Les autres se placent en retrait (ligne défensive)
            tx = WORLD_W/2 + (i - enemyTeam.length/2)*80;
            ty = ball.y - 150; // couvrent la profondeur
            if(ty < 150) ty = 150;
        }

        let ex = tx - e.x; let ey = ty - e.y;
        let dist = Math.hypot(ex, ey);
        if(dist > 5) {
            e.x += (ex/dist) * e.speed;
            e.y += (ey/dist) * e.speed;
            e.animPhase = (e.animPhase || 0) + 0.2;
        }

        // Si l'ennemi touche le porteur du ballon (Nous) -> Vol de balle (ou Perdu direct)
        // Laissons le vol de balle pour créer un vrai jeu de possession
        if(ball.owner && myTeam.includes(ball.owner)) {
            let pDist = Math.hypot(ball.owner.x - e.x, ball.owner.y - e.y);
            if(pDist < 20 && !(ball.owner.tackleImmunity > 0)) {
                ball.owner.stunned = 5; // On est assommé (5 frames = quasi instant)
                // controlledPlayer = null; <-- SUPPRIMÉ ! On ne meurt plus
                ball.owner = e; // L'ennemi prend la balle !
                e.tackleImmunity = 30; // L'ennemi est immunisé au tacle pdt 0.5s
            }
        }
    }
    
    // Si l'ennemi porte la balle, logique de Passe/Tir
    if(ball.owner && enemyTeam.includes(ball.owner)) {
        let e = ball.owner;
        let distToGoal = Math.hypot(WORLD_W/2 - e.x, WORLD_H - e.y);
        
        e.possessionTime = (e.possessionTime || 0) + 1;

        if(e.possessionTime > 20) {
            if(distToGoal < 400 && Math.random() < 0.1) {
                // Tir au but !
                let aimX = WORLD_W/2 + (Math.random() - 0.5) * GOAL_WIDTH * 0.8;
                let dx = aimX - e.x;
                let dy = WORLD_H - e.y;
                let mag = Math.hypot(dx, dy);
                ball.owner = null;
                ball.cooldown = 15;
                ball.vx = (dx/mag) * 22; // Frappe forte
                ball.vy = (dy/mag) * 22;
                ball.vz = Math.random() * 6; // Tir parfois flottant
                e.possessionTime = 0;
            } else if (Math.random() < 0.05) {
                // Tenter une passe à un coéquipier plus proche du but
                let bestMate = null;
                for(let mate of enemyTeam) {
                    if(mate === e) continue;
                    if(mate.y > e.y + 100) { // Un coéquipier plus en avant
                        bestMate = mate;
                        break;
                    }
                }
                if(bestMate) {
                    let dx = bestMate.x - e.x;
                    let dy = bestMate.y - e.y;
                    let mag = Math.hypot(dx, dy);
                    ball.owner = null;
                    ball.cooldown = 15;
                    ball.vx = (dx/mag) * 12;
                    ball.vy = (dy/mag) * 12;
                    e.possessionTime = 0;
                }
            }
        }
    } else {
        // Reset timer pour les ennemis
        for(let e of enemyTeam) e.possessionTime = 0;
    }

    // IA Gardien Ennemi avec Prédiction de Tir et Délai
    let targetGX = enemyGoalie.x;
    if(ball.vy < -1) {
        let timeToGoal = (enemyGoalie.y - ball.y) / ball.vy;
        if(timeToGoal > 0 && timeToGoal < 100) targetGX = ball.x + ball.vx * timeToGoal;
    } else {
        targetGX = ball.x; // Suit la balle lentement
    }
    // Rester dans les cages
    targetGX = Math.max(WORLD_W/2 - GOAL_WIDTH/2 + 15, Math.min(WORLD_W/2 + GOAL_WIDTH/2 - 15, targetGX));

    let dxG = targetGX - enemyGoalie.x;
    if(Math.abs(dxG) > 5) {
        enemyGoalie.x += Math.sign(dxG) * (enemyGoalie.speed * 0.8); // Vitesse limitée pour équilibrage
    }
    
    // Hitbox 3D Gardien Ennemi
    if(!enemyTeam.includes(ball.owner)) {
        let distG = Math.hypot(ball.x - enemyGoalie.x, ball.y - enemyGoalie.y);
        if(distG < 35) {
            let blocked = true;
            if(ball.z > 40) blocked = false; // Lob par-dessus
            if(ball.z < 15 && Math.abs(ball.x - enemyGoalie.x) < 12) blocked = false; // Petit pont
            
            if(blocked) {
                ball.vx *= -0.5; ball.vy *= -0.5; ball.owner = null;
            }
        }
    }

    // IA Gardien Allié
    let targetMyG = ball.x;
    if(Math.abs(targetMyG - myGoalie.x) > 5) {
        myGoalie.x += Math.sign(targetMyG - myGoalie.x) * myGoalie.speed;
    }
    // Hitbox 3D Gardien Allié
    if(!myTeam.includes(ball.owner)) {
        let distG = Math.hypot(ball.x - myGoalie.x, ball.y - myGoalie.y);
        if(distG < 35) {
            let blocked = true;
            if(ball.z > 40) blocked = false; // Lob
            if(ball.z < 15 && Math.abs(ball.x - myGoalie.x) < 12) blocked = false; // Petit pont
            
            if(blocked) {
                ball.vx *= -0.5; ball.vy *= -0.5; ball.owner = null;
            }
        }
    }

    // Mouvement Balle (3D)
    if(ball.cooldown > 0) ball.cooldown--;
    
    if(ball.owner) {
        ball.x = ball.owner.x;
        ball.y = ball.owner.y; 
        ball.z = 5; // Hauteur du genou/pied
        ball.vx = 0; ball.vy = 0; ball.vz = 0;
    } else {
        ball.x += ball.vx;
        ball.y += ball.vy;
        ball.z += ball.vz;
        
        // Gravité
        ball.vz -= 0.6;
        if (ball.z <= 0) {
            ball.z = 0;
            // Rebond au sol
            ball.vz *= -0.6;
            if (Math.abs(ball.vz) < 1.5) ball.vz = 0;
        }

        ball.vx *= 0.96; // Friction herbe
        ball.vy *= 0.96;

        // Rebond murs latéraux
        if(ball.x < 10) { ball.x = 10; ball.vx *= -1; }
        if(ball.x > WORLD_W-10) { ball.x = WORLD_W-10; ball.vx *= -1; }
        // Rebond haut et bas
        if(ball.y < 10) { ball.y = 10; ball.vy *= -1; }
        if(ball.y > WORLD_H-10) { ball.y = WORLD_H-10; ball.vy *= -1; }

        // Ramassage Balle
        let claimed = false;
        // On vérifie le joueur contrôlé d'abord
        if(ball.cooldown === 0 && controlledPlayer && !(controlledPlayer.stunned > 0) && Math.hypot(controlledPlayer.x - ball.x, controlledPlayer.y - ball.y) < 25) {
            ball.owner = controlledPlayer;
            claimed = true;
        }
        if(ball.cooldown === 0 && !claimed) {
            for(let p of myTeam) {
                if(!(p.stunned > 0) && Math.hypot(p.x - ball.x, p.y - ball.y) < 25) {
                    ball.owner = p;
                    controlledPlayer = p; // Switch automatique
                    claimed = true;
                    break;
                }
            }
        }
        if(ball.cooldown === 0 && !claimed) {
            for(let e of enemyTeam) {
                if(!(e.stunned > 0) && Math.hypot(e.x - ball.x, e.y - ball.y) < 25) {
                    ball.owner = e;
                    break;
                }
            }
        }
    }
    
    // Tacle Automatique par joueur contrôlé sur ennemi porteur
    if(controlledPlayer && ball.owner && enemyTeam.includes(ball.owner) && !(ball.owner.tackleImmunity > 0)) {
        if(Math.hypot(controlledPlayer.x - ball.owner.x, controlledPlayer.y - ball.owner.y) < 30) {
            ball.owner.stunned = 5; // Et bim ! (5 frames)
            ball.owner = controlledPlayer;
            controlledPlayer.tackleImmunity = 30; // On est immunisé au tacle pdt 0.5s
        }
    }

    // Condition Victoire (BUT)
    if(ball.y <= 20 && ball.x > WORLD_W/2 - GOAL_WIDTH/2 && ball.x < WORLD_W/2 + GOAL_WIDTH/2) {
        endGame(true);
        return;
    }
    // Condition Défaite (BUT ENNEMI)
    if(ball.y >= WORLD_H - 20 && ball.x > WORLD_W/2 - GOAL_WIDTH/2 && ball.x < WORLD_W/2 + GOAL_WIDTH/2) {
        endGame(false, true);
        return;
    }

    // Dessin Joueurs Animés
    for(let p of myTeam) {
        drawPlayer(ctx, p, p === controlledPlayer ? "cyan" : "blue", false);
        // Halo de possession/contrôle
        if(p === controlledPlayer) {
            ctx.beginPath();
            ctx.ellipse(p.x, p.y + 15, 20, 10, 0, 0, Math.PI*2);
            ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.stroke();
        }
    }

    for(let e of enemyTeam) {
        drawPlayer(ctx, e, "red", false);
    }

    // Gardiens
    drawPlayer(ctx, enemyGoalie, "yellow", true);
    drawPlayer(ctx, myGoalie, "lightgreen", true);

    // Dessin Balle avec hauteur (Z)
    // Ombre
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath(); ctx.ellipse(ball.x, ball.y, 8, 4, 0, 0, Math.PI*2); ctx.fill();
    // Balle
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("⚽", ball.x, ball.y - ball.z);

    // Dessin de la flèche de visée (Drag Mobile)
    if(isDragging && controlledPlayer && ball.owner === controlledPlayer) {
        let dx = dragCurrentX - controlledPlayer.x;
        let dy = dragCurrentY - controlledPlayer.y;
        let dist = Math.hypot(dx, dy);
        let maxDist = Math.min(300, dist);
        
        ctx.beginPath();
        ctx.moveTo(controlledPlayer.x, controlledPlayer.y);
        ctx.lineTo(controlledPlayer.x + (dist > 0 ? dx/dist : 0) * maxDist, controlledPlayer.y + (dist > 0 ? dy/dist : -1) * maxDist);
        let powerRatio = maxDist / 300;
        ctx.strokeStyle = `rgba(255, ${255 - powerRatio*255}, 0, 0.8)`; // Jaune -> Rouge
        ctx.lineWidth = 5;
        ctx.setLineDash([10, 10]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Dessin de la jauge de charge (PC)
    if(isCharging && controlledPlayer && ball.owner === controlledPlayer) {
        let duration = Date.now() - chargeStartTime;
        let powerRatio = Math.min(1, duration / 5000); // Max 5s
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(controlledPlayer.x - 20, controlledPlayer.y - 30, 40, 6);
        ctx.fillStyle = powerRatio < 0.3 ? "cyan" : (powerRatio < 0.7 ? "yellow" : "red");
        ctx.fillRect(controlledPlayer.x - 20, controlledPlayer.y - 30, 40 * powerRatio, 6);
    }
    
    ctx.restore();

    gameLoopId = requestAnimationFrame(gameLoop);
}

// Lancement au chargement
initMenu();

// Fonction de dessin procédural d'un joueur/gardien
function drawPlayer(ctx, p, color, isGoalie = false) {
    let anim = p.animPhase || 0;
    ctx.save();
    ctx.translate(p.x, p.y);
    
    // Ombre sous le joueur
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath(); ctx.ellipse(0, 15, 12, 6, 0, 0, Math.PI*2); ctx.fill();
    
    // Tête
    ctx.fillStyle = "#ffcc99"; // Peau
    ctx.beginPath(); ctx.arc(0, -20, 8, 0, Math.PI*2); ctx.fill();
    
    // Torse
    ctx.fillStyle = color;
    let width = isGoalie ? 22 : 16;
    ctx.fillRect(-width/2, -15, width, 20);
    
    // Bras (Balancier)
    ctx.strokeStyle = "#ffcc99";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    
    let armSwing = isGoalie ? 0 : Math.sin(anim) * 10;
    
    // Bras gauche
    ctx.beginPath(); ctx.moveTo(-width/2 - 2, -10); 
    if(isGoalie) ctx.lineTo(-width/2 - 15, -5); // Bras écartés (gardien)
    else ctx.lineTo(-width/2 - 2, 5 + armSwing);
    ctx.stroke();
    
    // Bras droit
    ctx.beginPath(); ctx.moveTo(width/2 + 2, -10); 
    if(isGoalie) ctx.lineTo(width/2 + 15, -5);
    else ctx.lineTo(width/2 + 2, 5 - armSwing);
    ctx.stroke();
    
    // Jambes
    ctx.strokeStyle = isGoalie ? "black" : "white"; // Short
    ctx.lineWidth = 6;
    let legSwing = isGoalie ? 0 : Math.sin(anim) * 12;
    
    // Jambe gauche
    ctx.beginPath(); ctx.moveTo(-5, 5);
    if(isGoalie) ctx.lineTo(-12, 20); // Jambes écartées
    else ctx.lineTo(-5, 20 - legSwing);
    ctx.stroke();
    
    // Jambe droite
    ctx.beginPath(); ctx.moveTo(5, 5);
    if(isGoalie) ctx.lineTo(12, 20);
    else ctx.lineTo(5, 20 + legSwing);
    ctx.stroke();
    
    // Retour du contexte
    ctx.restore();
}
