/**
 * Device Fingerprinting & Info Utilities
 * Creates a consistent device ID using browser characteristics
 */

/**
 * Generates a stable device fingerprint based on browser/hardware properties.
 * Uses canvas fingerprinting + hardware info for uniqueness.
 */
async function getDeviceId() {
  // Check if we already have a stored device ID
  let stored = localStorage.getItem('deviceId');
  if (stored) return stored;

  // Build fingerprint from multiple sources
  const components = [];

  // Screen properties
  components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
  components.push(screen.pixelDepth || '');

  // Timezone
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone || '');

  // Language
  components.push(navigator.language || '');

  // Platform
  components.push(navigator.platform || '');

  // Hardware concurrency (CPU cores)
  components.push(navigator.hardwareConcurrency || '');

  // Canvas fingerprint
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 200;
    canvas.height = 50;
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('PDF Notes Platform 🔒', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Device Check', 4, 35);
    components.push(canvas.toDataURL().slice(-50));
  } catch(e) {}

  // Audio context fingerprint
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      const ac = new AudioContext();
      const osc = ac.createOscillator();
      const analyser = ac.createAnalyser();
      osc.connect(analyser);
      analyser.connect(ac.destination);
      osc.start(0);
      const data = new Float32Array(analyser.frequencyBinCount);
      analyser.getFloatFrequencyData(data);
      osc.stop();
      ac.close();
      components.push(data.slice(0, 10).join(','));
    }
  } catch(e) {}

  // Hash all components together
  const raw = components.join('|');
  const hash = await sha256(raw);
  
  localStorage.setItem('deviceId', hash);
  return hash;
}

/**
 * SHA-256 hash using Web Crypto API
 */
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Returns human-readable device info for admin display
 */
function getDeviceInfo() {
  const ua = navigator.userAgent;
  let device = 'Unknown Device';
  let os = 'Unknown OS';

  // Detect OS
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/iPhone|iPad/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Linux/.test(ua)) os = 'Linux';

  // Detect browser
  let browser = 'Browser';
  if (/Chrome\//.test(ua) && !/Chromium|Edge/.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
  else if (/Edg\//.test(ua)) browser = 'Edge';

  // Mobile?
  if (/Mobi|Android|iPhone|iPad/.test(ua)) device = 'Mobile';
  else device = 'Desktop';

  return `${device} · ${os} · ${browser}`;
}
