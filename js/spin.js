// spin.js

const wheel = document.getElementById("wheel");
const resultDisplay = document.getElementById("spin-result");
const spinSound = document.getElementById("spin-sound");
const winSound = document.getElementById("win-sound");
const errorSound = document.getElementById("error-sound");
const canvas = document.getElementById("confetti-canvas");

let isSpinning = false;

// Fake prize list (adjust as needed)
const prizes = ["₹168", "₹596", "₹991", "₹1047", "₹1579", "₹2039", "₹0", "₹5097"];

function spinWheel() {
  if (isSpinning) return;

  isSpinning = true;
  spinSound.play();

  // Random angle between 5 and 10 full spins
  const randomRotation = 360 * (5 + Math.floor(Math.random() * 5));
  const prizeIndex = Math.floor(Math.random() * prizes.length);
  const extraAngle = 360 / prizes.length * prizeIndex;

  // Total spin
  const totalRotation = randomRotation + extraAngle;

  wheel.style.transition = "transform 4s ease-out";
  wheel.style.transform = `rotate(${totalRotation}deg)`;

  // Wait for animation to finish
  setTimeout(() => {
    const prize = prizes[prizeIndex];

    if (prize !== "₹0") {
      winSound.play();
      resultDisplay.innerText = `🎉 You won ${prize}!`;
      launchConfetti();
    } else {
      errorSound.play();
      resultDisplay.innerText = "😢 Better luck next time!";
    }

    isSpinning = false;
  }, 4000);
}

// ----------- CONFETTI ANIMATION -------------
function launchConfetti() {
  const duration = 2 * 1000;
  const animationEnd = Date.now() + duration;
  const colors = ["#bb0000", "#ffffff", "#FFD700", "#00ffcc"];

  (function frame() {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) return;

    const confetti = document.createElement("div");
    confetti.className = "confetti";
    confetti.style.left = Math.random() * 100 + "vw";
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    document.body.appendChild(confetti);

    setTimeout(() => confetti.remove(), 2000);
    requestAnimationFrame(frame);
  })();
}
