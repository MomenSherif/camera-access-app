import './style.css';
import { requestCameraAccess, stopCamera, detectBrowser, type CameraError } from './camera';

// Create the UI
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="container">
    <h1>Camera Access App</h1>
    <p class="subtitle">Click the button below to enable your camera</p>

    <div class="video-container">
      <video id="video" autoplay playsinline></video>
    </div>

    <div class="controls">
      <button id="toggle-camera" type="button" class="button">
        Enable Camera
      </button>
    </div>

    <div id="error-message" class="error-message hidden"></div>
    <div id="help-instructions" class="help-instructions hidden"></div>
  </div>
`;

// Get DOM elements
const video = document.querySelector<HTMLVideoElement>('#video')!;
const toggleButton = document.querySelector<HTMLButtonElement>('#toggle-camera')!;
const errorMessage = document.querySelector<HTMLDivElement>('#error-message')!;
const helpInstructions = document.querySelector<HTMLDivElement>('#help-instructions')!;

let isCameraActive = false;

// Hide error and help messages
function hideMessages(): void {
  errorMessage.classList.add('hidden');
  helpInstructions.classList.add('hidden');
}

// Show error message with browser-specific help
function showError(error: CameraError): void {
  errorMessage.classList.remove('hidden');
  errorMessage.innerHTML = `
    <strong>Error:</strong> ${error.message}
  `;

  if (error.type === 'permission-denied') {
    const browser = detectBrowser();
    helpInstructions.classList.remove('hidden');
    helpInstructions.innerHTML = `
      <h3>How to enable camera access in ${browser.name === 'unknown' ? 'your browser' : browser.name.charAt(0).toUpperCase() + browser.name.slice(1)}:</h3>
      <ol>
        ${browser.instructions.map(instruction => `<li>${instruction}</li>`).join('')}
      </ol>
    `;
  }
}

// Start camera
async function startCamera(): Promise<void> {
  try {
    toggleButton.disabled = true;
    toggleButton.textContent = 'Requesting access...';
    hideMessages();

    const stream = await requestCameraAccess();
    video.srcObject = stream;

    isCameraActive = true;
    toggleButton.textContent = 'Stop Camera';
    toggleButton.disabled = false;
    toggleButton.classList.add('active');
    video.classList.add('active');

  } catch (err) {
    const error = err as CameraError;
    showError(error);
    toggleButton.textContent = 'Enable Camera';
    toggleButton.disabled = false;
    toggleButton.classList.remove('active');
    video.classList.remove('active');
    isCameraActive = false;
  }
}

// Stop camera
function handleStopCamera(): void {
  stopCamera();
  video.srcObject = null;

  isCameraActive = false;
  toggleButton.textContent = 'Enable Camera';
  toggleButton.classList.remove('active');
  video.classList.remove('active');
  hideMessages();
}

// Toggle camera on/off
toggleButton.addEventListener('click', () => {
  if (isCameraActive) {
    handleStopCamera();
  } else {
    startCamera();
  }
});
