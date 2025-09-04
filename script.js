let dom_score = document.querySelector("#score");
let dom_canvas = document.createElement("canvas");
document.querySelector("#canvas").appendChild(dom_canvas);
let CTX = dom_canvas.getContext("2d");

// Background flash images
let bgImages = [];
let bgFlash = 0;
let currentBgImage = null;

// load your custom background images
let imageSources = ["bg1.jpeg", "bg2.jpeg", "bg3.jpeg","bg4.jpeg"];
imageSources.forEach(src => {
  let img = new Image();
  img.src = src;
  bgImages.push(img);
});

// Canvas setup
const W = (dom_canvas.width = 800);
const H = (dom_canvas.height = 800);
let cells = 10; // more cells for smoother play
let cellSize = W / cells;

// Timing (FPS control)
let lastTime = 0;
let accumulator = 0;
let fps = 60;           // change this to 30 for faster play
let step = 1000 / fps;

// Game state
let snake, food, isGameOver = false, score = 0;
let maxScore = window.localStorage.getItem("maxScore") || 0;
let particles = [];
let splashingParticleCount = 20;
let requestID;

// Images
let snakeHeadImg = new Image();
snakeHeadImg.src = "snake_head.png"; // face image
let foodImg = new Image();
foodImg.src = "apple.png"; // apple image

// Sounds
let eatSound = new Audio("eat.mp3");
let gameOverSound = new Audio("gameover.mp3");

// Helpers
let helpers = {
  Vec: class {
    constructor(x, y) { this.x = x; this.y = y; }
    add(v) { this.x += v.x; this.y += v.y; return this; }
  },
  isCollision(v1, v2) { return v1.x === v2.x && v1.y === v2.y; },
  garbageCollector() { particles = particles.filter(p => p.size > 0); },
  drawGrid() {
    CTX.lineWidth = 1;
    CTX.strokeStyle = "#181825";
    for (let i = 1; i < cells; i++) {
      let f = (W / cells) * i;
      CTX.beginPath(); CTX.moveTo(f, 0); CTX.lineTo(f, H); CTX.stroke();
      CTX.beginPath(); CTX.moveTo(0, f); CTX.lineTo(W, f); CTX.stroke();
    }
  }
};

// Keyboard control
let KEY = {
  ArrowUp: false, ArrowRight: false, ArrowDown: false, ArrowLeft: false,
  resetState() { this.ArrowUp=this.ArrowRight=this.ArrowDown=this.ArrowLeft=false; },
  listen() {
    addEventListener("keydown", e => {
      if (e.key in this) {
        if ((e.key==="ArrowUp" && this.ArrowDown) ||
            (e.key==="ArrowDown" && this.ArrowUp) ||
            (e.key==="ArrowLeft" && this.ArrowRight) ||
            (e.key==="ArrowRight" && this.ArrowLeft)) return;
        this.resetState(); this[e.key] = true;
      }
    });
  }
};
KEY.listen();

// Snake
class Snake {
  constructor() {
    this.pos = new helpers.Vec(W/2, H/2);
    this.dir = new helpers.Vec(cellSize, 0); // start moving right
    this.size = cellSize;
    this.history = [];
    this.total = 1;
    this.delay = 7;
  }
  draw() {
    let {x,y} = this.pos;
    if (snakeHeadImg.complete && snakeHeadImg.naturalWidth !== 0) {
      CTX.save();
      CTX.translate(x + this.size/2, y + this.size/2);
      if (this.dir.x > 0) CTX.rotate(0);
      else if (this.dir.x < 0) CTX.rotate(Math.PI);
      else if (this.dir.y > 0) CTX.rotate(Math.PI/2);
      else if (this.dir.y < 0) CTX.rotate(-Math.PI/2);
      CTX.drawImage(snakeHeadImg, -this.size/2, -this.size/2, this.size, this.size);
      CTX.restore();
    } else {
      CTX.fillStyle = "lightgreen";
      CTX.fillRect(x,y,this.size,this.size);
    }
    if (this.total >= 2) {
      for (let i=0;i<this.history.length-1;i++) {
        let {x,y} = this.history[i];
        CTX.fillStyle = "lightgreen"; CTX.fillRect(x,y,this.size,this.size);
        CTX.strokeStyle = "black"; CTX.strokeRect(x,y,this.size,this.size);
      }
    }
  }
  walls() {
    let {x,y} = this.pos;
    if (x+cellSize>W) this.pos.x = 0;
    if (y+cellSize>H) this.pos.y = 0;
    if (y<0) this.pos.y = H-cellSize;
    if (x<0) this.pos.x = W-cellSize;
  }
  controlls() {
    let dir = this.size;
    if (KEY.ArrowUp) this.dir = new helpers.Vec(0,-dir);
    if (KEY.ArrowDown) this.dir = new helpers.Vec(0,dir);
    if (KEY.ArrowLeft) this.dir = new helpers.Vec(-dir,0);
    if (KEY.ArrowRight) this.dir = new helpers.Vec(dir,0);
  }
  selfCollision() {
    for (let p of this.history) {
      if (helpers.isCollision(this.pos,p)) {
        isGameOver = true;
        gameOverSound.play();
      }
    }
  }
  update() {
    this.walls(); this.controlls();
    if (!this.delay--) {
      if (helpers.isCollision(this.pos, food.pos)) {
        score++; dom_score.innerText = score.toString().padStart(2,"0");
        particleSplash(); food.spawn(); this.total++;
        eatSound.currentTime=0; eatSound.play();

        // background image flash
        currentBgImage = bgImages[Math.floor(Math.random() * bgImages.length)];
        bgFlash = 1;
      }
      this.history[this.total-1] = new helpers.Vec(this.pos.x,this.pos.y);
      for (let i=0;i<this.total-1;i++) this.history[i]=this.history[i+1];
      this.pos.add(this.dir);
      this.delay = 7;
      if (this.total > 3) this.selfCollision();
    }
  }
}

// Food
class Food {
  constructor() { this.size = cellSize; this.spawn(); }
  draw() {
    let {x,y} = this.pos;
    if (foodImg.complete && foodImg.naturalWidth !== 0) {
      CTX.save();
      CTX.shadowColor="rgba(255,0,0,0.7)"; CTX.shadowBlur=30;
      CTX.drawImage(foodImg,x,y,this.size,this.size);
      CTX.restore();
    } else {
      CTX.save();
      CTX.shadowColor="red"; CTX.shadowBlur=20;
      CTX.fillStyle="red"; CTX.beginPath();
      CTX.arc(x+this.size/2,y+this.size/2,this.size/2,0,Math.PI*2);
      CTX.fill(); CTX.restore();
    }
  }
  spawn() {
    let randX = ~~(Math.random()*cells)*cellSize;
    let randY = ~~(Math.random()*cells)*cellSize;
    this.pos = new helpers.Vec(randX,randY);
  }
}

// Particle
class Particle {
  constructor(pos,size,vel) {
    this.pos = pos; this.size = Math.abs(size/2);
    this.vel = vel; this.gravity = -0.2;
  }
  draw() { CTX.fillStyle="white"; CTX.fillRect(this.pos.x,this.pos.y,this.size,this.size); }
  update() { this.draw(); this.size-=0.3; this.pos.add(this.vel); this.vel.y -= this.gravity; }
}

function particleSplash() {
  for (let i=0;i<splashingParticleCount;i++) {
    let vel=new helpers.Vec(Math.random()*6-3,Math.random()*6-3);
    let position=new helpers.Vec(food.pos.x,food.pos.y);
    particles.push(new Particle(position,food.size,vel));
  }
}

// Main loop
function loop(timestamp = 0) {
  requestID = requestAnimationFrame(loop);

  let delta = timestamp - lastTime;
  lastTime = timestamp;
  accumulator += delta;

  while (accumulator >= step) {
    if (!isGameOver) {
      snake.update();
    } else {
      gameOver();
      return;
    }
    accumulator -= step;
  }

  // base background
  CTX.fillStyle = "#000";
  CTX.fillRect(0, 0, W, H);

  // flash image fade
  if (bgFlash > 0 && currentBgImage) {
    CTX.save();
    CTX.globalAlpha = bgFlash;
    CTX.drawImage(currentBgImage, 0, 0, W, H);
    CTX.restore();
    bgFlash -= 0.02;
  }

  // objects
  helpers.drawGrid();
  snake.draw();
  food.draw();

  for (let p of particles) p.update();
  helpers.garbageCollector();
}

function gameOver() {
  if (score > maxScore) maxScore = score;
  window.localStorage.setItem("maxScore", maxScore);

  CTX.fillStyle="#4cffd7"; CTX.textAlign="center";
  CTX.font="bold 30px Poppins, sans-serif";
  CTX.fillText("GAME OVER",W/2,H/2);
  CTX.font="15px Poppins, sans-serif";
  CTX.fillText(`SCORE ${score}`,W/2,H/2+60);
  CTX.fillText(`MAXSCORE ${maxScore}`,W/2,H/2+80);

  // Show restart button
  document.getElementById("restart").style.display = "block";
}


// mobile button controls
function pressKey(direction) {
  KEY.resetState();
  KEY[direction] = true;
}
document.querySelector("#U").addEventListener("click", () => pressKey("ArrowUp"));
document.querySelector("#D").addEventListener("click", () => pressKey("ArrowDown"));
document.querySelector("#L").addEventListener("click", () => pressKey("ArrowLeft"));
document.querySelector("#R").addEventListener("click", () => pressKey("ArrowRight"));

function initialize() {
  snake = new Snake();
  food = new Food();
  loop();
}

initialize();

