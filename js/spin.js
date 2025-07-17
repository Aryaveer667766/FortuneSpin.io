const wheel = document.getElementById("wheel");
const spinBtn = document.getElementById("spin-btn");
const spinSound = document.getElementById("spin-sound");
const winSound = document.getElementById("win-sound");

let deg = 0;

spinBtn.addEventListener("click", () => {
  spinSound.play();
  
  // Generate a random rotation
  const min = 1024;
  const max = 9999;
  const randomDeg = Math.floor(Math.random() * (max - min)) + min;

  deg += randomDeg;
  wheel.style.transform = `rotate(${deg}deg)`;

  // Play win sound after rotation
  setTimeout(() => {
    winSound.play();
    alert("🎉 You won!");
  }, 4000); // match transition time
});
