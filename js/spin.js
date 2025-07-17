// 🎡 Spin Logic for FortuneSpin.io

const wheel = document.getElementById("wheel");
const resultText = document.getElementById("spin-result");
const spinButton = document.querySelector("button[onclick='spinWheel()']");

// 🎵 Load spin sound
const spinSound = new Audio("assets/spin.mp3");
spinSound.preload = "auto";

// 💸 Prize List
const prizes = ["₹168", "₹596", "₹991", "₹1047", "₹1579", "₹2039", "₹0", "₹5097"];

// Track rotation to avoid snapback
let currentRotation = 0;

// 🎯 Spin Function
function spinWheel() {
  spinButton.disabled = true;
  resultText.textContent = ""; // Clear previous result

  const prizeIndex = Math.floor(Math.random() * prizes.length);
  const prize = prizes[prizeIndex];

  const sliceAngle = 360 / prizes.length;
  const targetAngle = (prizes.length - prizeIndex) * sliceAngle;
  const extraSpins = 5 * 360; // 5 full rotations

  const finalRotation = currentRotation + extraSpins + targetAngle;

  // Apply rotation
  wheel.style.transition = "transform 4s ease-out";
  wheel.style.transform = `rotate(${finalRotation}deg)`;

  // Play sound
  spinSound.currentTime = 0;
  spinSound.play();

  // Result after spin
  setTimeout(() => {
    if (prize === "₹0") {
      resultText.textContent = "😢 Oops! You got ₹0!";
    } else {
      resultText.textContent = `🎉 You won ${prize}!`;
      triggerConfetti();
    }

    spinButton.disabled = false;
  }, 4000);

  currentRotation = finalRotation % 360; // Save new rotation
}

// 🎊 Confetti Effect (optional)
function triggerConfetti() {
  const duration = 2000;
  const animationEnd = Date.now() + duration;

  const interval = setInterval(() => {
    if (Date.now() > animationEnd) {
      return clearInterval(interval);
    }

    confetti({
      particleCount: 5,
      angle: 60,
      spread: 70,
      origin: { x: 0 }
    });

    confetti({
      particleCount: 5,
      angle: 120,
      spread: 70,
      origin: { x: 1 }
    });
  }, 200);
}
