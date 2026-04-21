// -- LOGIQUE DU JEU "DRIBBLE DE LA MORT" --
const dribbleCanvas = document.getElementById("dribbleCanvas");
if(dribbleCanvas) {
    const ctx = dribbleCanvas.getContext("2d");
    dribbleCanvas.width = 600;
    dribbleCanvas.height = 500;

    let player = { x: 300, y: 400, radius: 15 };
    let defenders = [];
    let frame = 0;
    let score = 0;
    let isGameOver = false;
    let isVictory = false;
    let hasStarted = false;
    
    function showStartScreen() {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0,0, dribbleCanvas.width, dribbleCanvas.height);
        ctx.fillStyle = "white";
        ctx.font = "bold 30px Arial";
        ctx.textAlign = "center";
        ctx.fillText("CLIQUE ICI POUR DÉMARRER", 300, 250);
    }
    
    // Mouse movement
    dribbleCanvas.addEventListener("mousemove", (e) => {
        const rect = dribbleCanvas.getBoundingClientRect();
        player.x = e.clientX - rect.left;
        player.y = e.clientY - rect.top;
    });

    function spawnDefender() {
        let x = Math.random() * dribbleCanvas.width;
        defenders.push({ x: x, y: -30, speed: Math.random() * 4 + 3 });
    }

    function drawPlayer() {
        ctx.font = "30px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("⚽", player.x, player.y);
    }

    function drawDefenders() {
        for(let d of defenders) {
            ctx.font = "28px Arial";
            ctx.fillText("🛡️", d.x, d.y);
        }
    }
    
    function drawGoal() {
        // Draw green zone at top
        ctx.fillStyle = "rgba(0, 255, 0, 0.5)";
        ctx.fillRect(150, 0, 300, 50);
        ctx.fillStyle = "white";
        ctx.font = "24px Arial";
        ctx.fillText("BUT !", 300, 25);
    }

    function detectCollision() {
        for(let d of defenders) {
            let dx = player.x - d.x;
            let dy = player.y - d.y;
            let distance = Math.sqrt(dx*dx + dy*dy);
            if(distance < 25) {
                isGameOver = true;
            }
        }
        
        // Victory if touching the goal zone (after score > 600 frames, ~10 seconds)
        if(score > 600 && player.y < 50 && player.x > 150 && player.x < 450) {
            isVictory = true;
        }
    }

    function updateGame() {
        if(isGameOver) {
            ctx.fillStyle = "rgba(200, 0, 0, 0.8)";
            ctx.fillRect(0,0, dribbleCanvas.width, dribbleCanvas.height);
            ctx.fillStyle = "white";
            ctx.font = "bold 40px Arial";
            ctx.fillText("TACCLÉ ! T'as perdu le ballon.", 300, 200);
            ctx.font = "20px Arial";
            ctx.fillText("Clique sur le terrain pour réessayer.", 300, 260);
            return;
        }
        if(isVictory) {
            ctx.fillStyle = "rgba(0, 200, 0, 0.8)";
            ctx.fillRect(0,0, dribbleCanvas.width, dribbleCanvas.height);
            ctx.fillStyle = "white";
            ctx.font = "bold 50px Arial";
            ctx.fillText("GOOOOOAAAL !!", 300, 200);
            ctx.font = "20px Arial";
            ctx.fillText("Magnifique but ! Clique pour rejouer.", 300, 260);
            return;
        }

        ctx.clearRect(0,0, dribbleCanvas.width, dribbleCanvas.height);
        
        frame++;
        score++;
        
        if(frame % 15 === 0) spawnDefender();
        
        for(let i=0; i<defenders.length; i++){
            defenders[i].y += defenders[i].speed;
            if(defenders[i].y > dribbleCanvas.height) {
                defenders.splice(i, 1);
                i--;
            }
        }
        
        drawGoalZone();
        drawDefenders();
        drawPlayer();
        
        detectCollision();
        requestAnimationFrame(updateGame);
    }
    
    function drawGoalZone() {
        if(score > 600) {
            drawGoal();
        } else {
             ctx.fillStyle = "rgba(255,255,255,0.8)";
             ctx.font = "bold 18px Arial";
             ctx.fillText("Survis " + Math.ceil((600 - score)/60) + " s pour ouvrir le but !", 300, 30);
        }
    }

    dribbleCanvas.addEventListener("click", () => {
        if(!hasStarted) {
            hasStarted = true;
            updateGame();
        } else if(isGameOver || isVictory) {
            isGameOver = false;
            isVictory = false;
            defenders = [];
            score = 0;
            frame = 0;
            player = { x: 300, y: 400, radius: 15 };
            updateGame();
        }
    });

    showStartScreen();
}

// -- LOGIQUE DU JEU "TIRS AU BUT" --
const penaltyCanvas = document.getElementById("penaltyCanvas");
if(penaltyCanvas) {
    const ctx2 = penaltyCanvas.getContext("2d");
    penaltyCanvas.width = 600;
    penaltyCanvas.height = 300;

    let targetX = 0;
    let targetSpeed = 8;
    let targetWidth = 60;
    
    let ballY = 250;
    let ballX = 300;
    let isShooting = false;
    let isGoal = false;
    let isMissed = false;
    let hasStartedPenalty = false;

    function showStartScreenPenalty() {
        ctx2.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx2.fillRect(0,0, penaltyCanvas.width, penaltyCanvas.height);
        ctx2.fillStyle = "white";
        ctx2.font = "bold 30px Arial";
        ctx2.textAlign = "center";
        ctx2.fillText("CLIQUE ICI POUR DÉMARRER", 300, 150);
    }

    function resetPenalty() {
        isShooting = false;
        ballY = 250;
        isGoal = false;
        isMissed = false;
    }

    function updatePenaltyGame() {
        ctx2.clearRect(0,0, penaltyCanvas.width, penaltyCanvas.height);
        
        // Draw moving target if not resolved
        if(!isShooting || ballY > 40) {
            targetX += targetSpeed;
            if(targetX > penaltyCanvas.width - targetWidth || targetX < 0) {
                targetSpeed = -targetSpeed;
            }
        }
        
        ctx2.fillStyle = "#ff4444"; // Default goal is red (miss)
        ctx2.fillRect(0, 0, penaltyCanvas.width, 40);
        
        ctx2.fillStyle = "#00ff00"; // The valid green target area
        ctx2.fillRect(targetX, 0, targetWidth, 40);

        // Draw ball
        if(isShooting) {
            ballY -= 15;
            if(ballY <= 20) {
                // Check if hit
                if(ballX >= targetX && ballX <= targetX + targetWidth) {
                    isGoal = true;
                } else {
                    isMissed = true;
                }
                isShooting = false; // stop moving upwards
            }
        }
        
        ctx2.font = "30px Arial";
        ctx2.textAlign = "center";
        ctx2.textBaseline = "middle";
        ctx2.fillText("⚽", ballX, ballY);
        
        if(isGoal) {
            ctx2.fillStyle = "rgba(0, 255, 0, 0.8)";
            ctx2.fillRect(0,0, penaltyCanvas.width, penaltyCanvas.height);
            ctx2.fillStyle = "black";
            ctx2.font = "bold 50px Arial";
            ctx2.fillText("GOOOOOAAL !!", 300, 150);
            ctx2.font = "20px Arial";
            ctx2.fillText("Parfaitement dans la lucarne. Clique pour rejouer.", 300, 200);
        } else if (isMissed) {
             ctx2.fillStyle = "rgba(255, 0, 0, 0.8)";
            ctx2.fillRect(0,0, penaltyCanvas.width, penaltyCanvas.height);
            ctx2.fillStyle = "white";
            ctx2.font = "bold 40px Arial";
            ctx2.fillText("POTEAU... RATÉ !", 300, 150);
            ctx2.font = "20px Arial";
            ctx2.fillText("Une occasion gâchée. Clique pour réessayer.", 300, 200);
        } else if (!isShooting) {
             ctx2.fillStyle = "rgba(255, 255, 255, 0.8)";
             ctx2.font = "bold 20px Arial";
             ctx2.fillText("CLIQUE POUR TIRER", 300, 280);
        }

        requestAnimationFrame(updatePenaltyGame);
    }
    
    penaltyCanvas.addEventListener("click", () => {
        if(!hasStartedPenalty) {
            hasStartedPenalty = true;
            updatePenaltyGame();
        } else if(isGoal || isMissed) {
            resetPenalty();
        } else if (!isShooting) {
            isShooting = true;
        }
    });

    showStartScreenPenalty();
}
