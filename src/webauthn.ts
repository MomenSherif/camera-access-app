// @ts-nocheck
export interface WebAuthnError {
  type:
    | 'not-supported'
    | 'not-allowed'
    | 'timeout'
    | 'invalid-state'
    | 'unknown';
  message: string;
  originalError?: Error;
}

export interface WebAuthnBrowserInfo {
  name: 'chrome' | 'firefox' | 'safari' | 'edge' | 'unknown';
  instructions: string[];
}

export interface AuthenticationResult {
  success: boolean;
  credential?: PublicKeyCredential;
  isNewRegistration?: boolean;
}

const CREDENTIAL_STORAGE_KEY = 'webauthn_credential_id';

// Check if WebAuthn is supported
export function checkWebAuthnSupport(): boolean {
  return !!(window.PublicKeyCredential && navigator.credentials);
}

// Generate random challenge
function generateChallenge(): Uint8Array {
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  return challenge;
}

// Generate random user ID
function generateUserId(): Uint8Array {
  const userId = new Uint8Array(16);
  crypto.getRandomValues(userId);
  return userId;
}

// Convert base64 string to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Convert Uint8Array to base64 string
function uint8ArrayToBase64(buffer: Uint8Array): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Get stored credential ID from localStorage
export function getStoredCredentialId(): Uint8Array | null {
  const stored = localStorage.getItem(CREDENTIAL_STORAGE_KEY);
  if (!stored) return null;

  try {
    return base64ToUint8Array(stored);
  } catch (error) {
    console.error('Failed to parse stored credential:', error);
    return null;
  }
}

// Store credential ID in localStorage
export function storeCredentialId(credentialId: ArrayBuffer): void {
  const uint8Array = new Uint8Array(credentialId);
  const base64 = uint8ArrayToBase64(uint8Array);
  localStorage.setItem(CREDENTIAL_STORAGE_KEY, base64);
}

// Clear stored credential
export function clearStoredCredential(): void {
  localStorage.removeItem(CREDENTIAL_STORAGE_KEY);
}

// Register a new credential (first-time users)
export async function registerCredential(): Promise<AuthenticationResult> {
  try {
    if (!checkWebAuthnSupport()) {
      const error: WebAuthnError = {
        type: 'not-supported',
        message:
          'WebAuthn is not supported in this browser. Please use a modern browser like Chrome, Firefox, Safari, or Edge.',
      };
      throw error;
    }

    const challenge = generateChallenge();
    const userId = generateUserId();

    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions =
      {
        challenge,
        rp: {
          name: 'Camera Access App 📸',
          id:
            window.location.hostname === 'localhost'
              ? 'localhost'
              : window.location.hostname,
        },
        user: {
          id: userId,
          name: 'user@example.com',
          displayName: 'Demo User',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60000,
        attestation: 'none',
      };

    const credential = (await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    })) as PublicKeyCredential;

    if (!credential) {
      const error: WebAuthnError = {
        type: 'unknown',
        message: 'Failed to create credential. Please try again.',
      };
      throw error;
    }

    // Store the credential ID for future authentication
    storeCredentialId(credential.rawId);

    return {
      success: true,
      credential,
      isNewRegistration: true,
    };
  } catch (err) {
    const error = err as Error & { name?: string };
    let webAuthnError: WebAuthnError;

    // Check if it's already a WebAuthnError
    if ((err as WebAuthnError).type) {
      throw err;
    }

    switch (error.name) {
      case 'NotAllowedError':
        webAuthnError = {
          type: 'not-allowed',
          message:
            'Biometric authentication was cancelled or denied. Please ensure you have Face ID, Touch ID, or Windows Hello set up on your device.',
          originalError: error,
        };
        break;

      case 'NotSupportedError':
        webAuthnError = {
          type: 'not-supported',
          message:
            'This device does not support biometric authentication. Please ensure Face ID, Touch ID, or Windows Hello is enabled.',
          originalError: error,
        };
        break;

      case 'InvalidStateError':
        webAuthnError = {
          type: 'invalid-state',
          message: 'A credential is already registered for this device.',
          originalError: error,
        };
        break;

      case 'TimeoutError':
      case 'AbortError':
        webAuthnError = {
          type: 'timeout',
          message:
            'Authentication timed out. Please try again and complete the biometric verification within 60 seconds.',
          originalError: error,
        };
        break;

      default:
        webAuthnError = {
          type: 'unknown',
          message: `Unable to register biometric authentication: ${
            error.message || 'Unknown error'
          }`,
          originalError: error,
        };
    }

    throw webAuthnError;
  }
}

// Authenticate with an existing credential
export async function authenticateUser(): Promise<AuthenticationResult> {
  try {
    if (!checkWebAuthnSupport()) {
      const error: WebAuthnError = {
        type: 'not-supported',
        message:
          'WebAuthn is not supported in this browser. Please use a modern browser like Chrome, Firefox, Safari, or Edge.',
      };
      throw error;
    }

    const storedCredentialId = getStoredCredentialId();
    if (!storedCredentialId) {
      const error: WebAuthnError = {
        type: 'invalid-state',
        message: 'No credential found. Please register first.',
      };
      throw error;
    }

    const challenge = generateChallenge();

    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions =
      {
        challenge,
        allowCredentials: [
          {
            type: 'public-key',
            id: storedCredentialId,
          },
        ],
        userVerification: 'required',
        timeout: 60000,
      };

    const credential = (await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    })) as PublicKeyCredential;

    if (!credential) {
      const error: WebAuthnError = {
        type: 'unknown',
        message: 'Failed to authenticate. Please try again.',
      };
      throw error;
    }

    return {
      success: true,
      credential,
      isNewRegistration: false,
    };
  } catch (err) {
    const error = err as Error & { name?: string };
    let webAuthnError: WebAuthnError;

    // Check if it's already a WebAuthnError
    if ((err as WebAuthnError).type) {
      throw err;
    }

    switch (error.name) {
      case 'NotAllowedError':
        webAuthnError = {
          type: 'not-allowed',
          message: 'Biometric authentication was cancelled or denied.',
          originalError: error,
        };
        break;

      case 'NotSupportedError':
        webAuthnError = {
          type: 'not-supported',
          message: 'This device does not support biometric authentication.',
          originalError: error,
        };
        break;

      case 'InvalidStateError':
        webAuthnError = {
          type: 'invalid-state',
          message: 'Invalid credential state. Please try registering again.',
          originalError: error,
        };
        break;

      case 'TimeoutError':
      case 'AbortError':
        webAuthnError = {
          type: 'timeout',
          message: 'Authentication timed out. Please try again.',
          originalError: error,
        };
        break;

      default:
        webAuthnError = {
          type: 'unknown',
          message: `Unable to authenticate: ${
            error.message || 'Unknown error'
          }`,
          originalError: error,
        };
    }

    throw webAuthnError;
  }
}

// Detect browser and provide specific help instructions
export function detectWebAuthnBrowser(): WebAuthnBrowserInfo {
  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes('edg/')) {
    return {
      name: 'edge',
      instructions: [
        'Go to Settings → Accounts → Sign-in options',
        'Set up Windows Hello (Face, Fingerprint, or PIN)',
        'Ensure "Use Windows Hello for passkey verification" is enabled',
        'Refresh the page and try again',
      ],
    };
  }

  if (userAgent.includes('chrome') && !userAgent.includes('edg')) {
    return {
      name: 'chrome',
      instructions: [
        'Ensure you have a screen lock set up (PIN, pattern, or password)',
        'On Windows: Set up Windows Hello in Settings',
        'On Mac: Ensure Touch ID is enabled in System Settings',
        'On mobile: Ensure biometric authentication is enabled',
        'Refresh the page and try again',
      ],
    };
  }

  if (userAgent.includes('firefox')) {
    return {
      name: 'firefox',
      instructions: [
        'Ensure you have biometric authentication configured on your device',
        'On Windows: Set up Windows Hello',
        'On Mac: Ensure Touch ID is enabled',
        'Allow Firefox to access your security key or biometric authenticator',
        'Refresh the page and try again',
      ],
    };
  }

  if (userAgent.includes('safari')) {
    return {
      name: 'safari',
      instructions: [
        'On Mac: Go to System Settings → Touch ID & Password',
        'Ensure Touch ID is enabled and configured',
        'On iPhone/iPad: Ensure Face ID or Touch ID is enabled in Settings',
        'Make sure Safari can use biometric authentication',
        'Refresh the page and try again',
      ],
    };
  }

  return {
    name: 'unknown',
    instructions: [
      'Ensure your device has biometric authentication enabled (Face ID, Touch ID, Windows Hello)',
      'Check that your browser is up to date',
      'Make sure your browser can access biometric authentication',
      'Try using Chrome, Safari, Firefox, or Edge for best compatibility',
    ],
  };
}
