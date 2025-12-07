export interface CameraError {
  type: 'permission-denied' | 'not-found' | 'in-use' | 'not-supported' | 'unknown';
  message: string;
  originalError?: Error;
}

export interface BrowserInfo {
  name: 'chrome' | 'firefox' | 'safari' | 'edge' | 'unknown';
  instructions: string[];
}

let currentStream: MediaStream | null = null;

export async function requestCameraAccess(): Promise<MediaStream> {
  try {
    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const error: CameraError = {
        type: 'not-supported',
        message: 'Camera access is not supported in this browser. Please use a modern browser like Chrome, Firefox, Safari, or Edge.'
      };
      throw error;
    }

    // Request camera access
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });

    currentStream = stream;
    return stream;

  } catch (err) {
    const error = err as DOMException;
    let cameraError: CameraError;

    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        cameraError = {
          type: 'permission-denied',
          message: 'Camera access was denied. Please allow camera access to continue.',
          originalError: error
        };
        break;

      case 'NotFoundError':
      case 'DevicesNotFoundError':
        cameraError = {
          type: 'not-found',
          message: 'No camera device found. Please connect a camera and try again.',
          originalError: error
        };
        break;

      case 'NotReadableError':
      case 'TrackStartError':
        cameraError = {
          type: 'in-use',
          message: 'Camera is currently in use by another application. Please close other apps using the camera and try again.',
          originalError: error
        };
        break;

      default:
        cameraError = {
          type: 'unknown',
          message: `Unable to access camera: ${error.message || 'Unknown error'}`,
          originalError: error
        };
    }

    throw cameraError;
  }
}

export function stopCamera(): void {
  if (currentStream) {
    currentStream.getTracks().forEach(track => {
      track.stop();
    });
    currentStream = null;
  }
}

export function detectBrowser(): BrowserInfo {
  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes('edg/')) {
    return {
      name: 'edge',
      instructions: [
        'Click the lock icon in the address bar',
        'Click "Permissions for this site"',
        'Find "Camera" and select "Allow"',
        'Refresh the page and try again'
      ]
    };
  }

  if (userAgent.includes('chrome') && !userAgent.includes('edg')) {
    return {
      name: 'chrome',
      instructions: [
        'Click the camera icon in the address bar',
        'Select "Always allow camera access"',
        'Click "Done"',
        'Refresh the page and try again'
      ]
    };
  }

  if (userAgent.includes('firefox')) {
    return {
      name: 'firefox',
      instructions: [
        'Click the camera icon in the address bar',
        'Remove the blocked permission',
        'Click "Enable Camera" again to allow access'
      ]
    };
  }

  if (userAgent.includes('safari')) {
    return {
      name: 'safari',
      instructions: [
        'Go to Safari menu → Settings for This Website',
        'Find "Camera" and select "Allow"',
        'Refresh the page and try again'
      ]
    };
  }

  return {
    name: 'unknown',
    instructions: [
      'Look for a camera icon in your address bar',
      'Click it and allow camera access',
      'Refresh the page and try again'
    ]
  };
}
