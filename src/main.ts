import './style.css';
import {
  requestCameraAccess,
  stopCamera,
  detectBrowser,
  type CameraError,
} from './camera';
import {
  registerCredential,
  authenticateUser,
  getStoredCredentialId,
  detectWebAuthnBrowser,
  checkWebAuthnSupport,
  type WebAuthnError,
  type AuthenticationResult,
} from './webauthn';

// Create the UI
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="container">
    <h1>Camera Access App</h1>
    <p class="subtitle">Test camera and biometric authentication</p>

    <div class="video-container">
      <video id="video" autoplay playsinline></video>
    </div>

    <div class="controls">
      <button id="toggle-camera" type="button" class="button">
        Enable Camera
      </button>
      <button id="webauthn-button" type="button" class="button button-secondary">
        Authenticate with FaceID
      </button>
    </div>

    <div id="status-message" class="status-message hidden"></div>
    <div id="error-message" class="error-message hidden"></div>
    <div id="help-instructions" class="help-instructions hidden"></div>
  </div>
`;

// Get DOM elements
const video = document.querySelector<HTMLVideoElement>('#video')!;
const toggleButton =
  document.querySelector<HTMLButtonElement>('#toggle-camera')!;
const webauthnButton =
  document.querySelector<HTMLButtonElement>('#webauthn-button')!;
const statusMessage =
  document.querySelector<HTMLDivElement>('#status-message')!;
const errorMessage = document.querySelector<HTMLDivElement>('#error-message')!;
const helpInstructions =
  document.querySelector<HTMLDivElement>('#help-instructions')!;

let isCameraActive = false;
let isAuthenticating = false;
let isAuthenticated = false;

// Hide all messages
function hideMessages(): void {
  statusMessage.classList.add('hidden');
  errorMessage.classList.add('hidden');
  helpInstructions.classList.add('hidden');
}

// Show status message (success/info)
function showStatusMessage(
  message: string,
  type: 'success' | 'info' = 'success'
): void {
  statusMessage.classList.remove('hidden');
  if (type === 'info') {
    statusMessage.classList.add('info');
  } else {
    statusMessage.classList.remove('info');
  }
  statusMessage.textContent = message;
}

// Show error message with browser-specific help
function showError(error: CameraError | WebAuthnError): void {
  errorMessage.classList.remove('hidden');
  errorMessage.innerHTML = `
    <strong>Error:</strong> ${error.message}
  `;

  if (error.type === 'permission-denied') {
    const browser = detectBrowser();
    helpInstructions.classList.remove('hidden');
    helpInstructions.innerHTML = `
      <h3>How to enable camera access in ${
        browser.name === 'unknown'
          ? 'your browser'
          : browser.name.charAt(0).toUpperCase() + browser.name.slice(1)
      }:</h3>
      <ol>
        ${browser.instructions
          .map(instruction => `<li>${instruction}</li>`)
          .join('')}
      </ol>
    `;
  } else if (error.type === 'not-allowed' || error.type === 'not-supported') {
    // Show WebAuthn-specific help
    const browser = detectWebAuthnBrowser();
    helpInstructions.classList.remove('hidden');
    helpInstructions.innerHTML = `
      <h3>How to enable biometric authentication in ${
        browser.name === 'unknown'
          ? 'your browser'
          : browser.name.charAt(0).toUpperCase() + browser.name.slice(1)
      }:</h3>
      <ol>
        ${browser.instructions
          .map(instruction => `<li>${instruction}</li>`)
          .join('')}
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

// ============================================================
// FIXED: Handle WebAuthn authentication
// The key fix is to call WebAuthn IMMEDIATELY on click,
// before any async operations like camera access.
// Safari/iOS requires WebAuthn to be called synchronously
// within the user gesture (click event).
// ============================================================
async function handleWebAuthnAuthentication(): Promise<void> {
  if (isAuthenticating) return;

  try {
    isAuthenticating = true;
    webauthnButton.disabled = true;
    hideMessages();

    // Check if WebAuthn is supported
    if (!checkWebAuthnSupport()) {
      const error: WebAuthnError = {
        type: 'not-supported',
        message:
          'Your browser does not support biometric authentication. Please use a modern browser like Chrome, Safari, Firefox, or Edge.',
      };
      throw error;
    }

    // Check if user has a registered credential
    const hasCredential = getStoredCredentialId() !== null;

    if (hasCredential) {
      // ============================================================
      // AUTHENTICATION FLOW
      // IMPORTANT: Call WebAuthn FIRST, before camera access!
      // ============================================================
      webauthnButton.textContent = 'Authenticating...';

      // Perform authentication IMMEDIATELY - no async before this!
      const result: AuthenticationResult = await authenticateUser();

      // Only try camera AFTER WebAuthn succeeds
      if (result.success) {
        isAuthenticated = true;
        webauthnButton.textContent = 'Authenticated ✓';
        webauthnButton.classList.add('authenticated');
        showStatusMessage(
          'Authentication successful! You have been verified with biometrics.'
        );

        // Now we can optionally show camera (after WebAuthn)
        try {
          const stream = await requestCameraAccess();
          video.srcObject = stream;
          video.classList.add('active');
          
          // Auto-stop camera after 3 seconds
          setTimeout(() => {
            stopCamera();
            video.srcObject = null;
            video.classList.remove('active');
          }, 3000);
        } catch (cameraError) {
          console.warn('Camera access denied after authentication');
        }
      }
    } else {
      // ============================================================
      // REGISTRATION FLOW
      // IMPORTANT: Call WebAuthn FIRST, before camera access!
      // ============================================================
      webauthnButton.textContent = 'Registering...';

      // Perform registration IMMEDIATELY - no async before this!
      const result: AuthenticationResult = await registerCredential();

      // Only try camera AFTER WebAuthn succeeds
      if (result.success) {
        webauthnButton.textContent = 'Authenticate with FaceID';
        showStatusMessage(
          'Biometric credential registered successfully! Click "Authenticate with FaceID" again to verify.',
          'info'
        );

        // Now we can optionally show camera (after WebAuthn)
        try {
          const stream = await requestCameraAccess();
          video.srcObject = stream;
          video.classList.add('active');
          
          // Auto-stop camera after 3 seconds
          setTimeout(() => {
            stopCamera();
            video.srcObject = null;
            video.classList.remove('active');
          }, 3000);
        } catch (cameraError) {
          console.warn('Camera access denied after registration');
        }
      }
    }
  } catch (err) {
    const error = err as WebAuthnError;
    showError(error);
    webauthnButton.textContent = 'Authenticate with FaceID';
    webauthnButton.classList.remove('authenticated');
    isAuthenticated = false;

    // Stop camera if it was started
    if (video.srcObject) {
      stopCamera();
      video.srcObject = null;
      video.classList.remove('active');
    }
  } finally {
    isAuthenticating = false;
    webauthnButton.disabled = false;

    console.log(isAuthenticated);
  }
}

// WebAuthn button click handler
webauthnButton.addEventListener('click', () => {
  handleWebAuthnAuthentication();
});