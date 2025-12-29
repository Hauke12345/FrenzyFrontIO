/**
 * Mobile-specific optimizations for rendering performance.
 * Detects mobile devices and provides configuration for reduced visual fidelity.
 */

export interface MobileConfig {
  isMobile: boolean;
  isLowEnd: boolean;

  // Rendering quality settings
  devicePixelRatio: number; // Lower = faster rendering
  maxFPS: number; // Cap framerate
  skipProtomoleculeEffects: boolean; // Most expensive visual effect
  reducedParticles: boolean; // Fewer explosion particles
  simplifiedUnits: boolean; // Simpler unit rendering
  reducedAnimations: boolean; // Skip non-essential animations
  aggressiveCulling: boolean; // More aggressive viewport culling
  batchSize: number; // Objects per batch render
}

// Detect mobile device
function detectMobile(): boolean {
  if (typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent.toLowerCase();
  const mobileKeywords = [
    "android",
    "webos",
    "iphone",
    "ipad",
    "ipod",
    "blackberry",
    "windows phone",
    "opera mini",
    "mobile",
  ];

  return mobileKeywords.some((keyword) => userAgent.includes(keyword));
}

// Detect low-end device (rough heuristic)
function detectLowEnd(): boolean {
  if (typeof navigator === "undefined") return false;

  // Check for low memory (if available)
  const nav = navigator as any;
  if (nav.deviceMemory && nav.deviceMemory < 4) return true;

  // Check for low core count
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4)
    return true;

  // iOS devices before iPhone X are generally slower
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) {
    const match = ua.match(/iPhone OS (\d+)/);
    if (match && parseInt(match[1]) < 13) return true;
  }

  return false;
}

// Create mobile config based on device detection
function createMobileConfig(): MobileConfig {
  const isMobile = detectMobile();
  const isLowEnd = detectLowEnd();

  if (!isMobile) {
    // Desktop: full quality
    return {
      isMobile: false,
      isLowEnd: false,
      devicePixelRatio: window.devicePixelRatio || 1,
      maxFPS: 60,
      skipProtomoleculeEffects: false,
      reducedParticles: false,
      simplifiedUnits: false,
      reducedAnimations: false,
      aggressiveCulling: false,
      batchSize: 1000,
    };
  }

  if (isLowEnd) {
    // Low-end mobile: minimal quality
    return {
      isMobile: true,
      isLowEnd: true,
      devicePixelRatio: 1, // Render at 1x regardless of screen
      maxFPS: 30,
      skipProtomoleculeEffects: true,
      reducedParticles: true,
      simplifiedUnits: true,
      reducedAnimations: true,
      aggressiveCulling: true,
      batchSize: 200,
    };
  }

  // Standard mobile: balanced quality
  return {
    isMobile: true,
    isLowEnd: false,
    devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2), // Cap at 2x
    maxFPS: 45,
    skipProtomoleculeEffects: false,
    reducedParticles: true,
    simplifiedUnits: false,
    reducedAnimations: true,
    aggressiveCulling: true,
    batchSize: 500,
  };
}

// Singleton instance
let mobileConfig: MobileConfig | null = null;

export function getMobileConfig(): MobileConfig {
  if (!mobileConfig) {
    mobileConfig = createMobileConfig();
    console.log("Mobile optimization config:", mobileConfig);
  }
  return mobileConfig;
}

// Utility to check if we should skip expensive rendering
export function shouldSkipExpensiveEffect(): boolean {
  return getMobileConfig().skipProtomoleculeEffects;
}

// Utility to get effective device pixel ratio
export function getEffectivePixelRatio(): number {
  return getMobileConfig().devicePixelRatio;
}

// Check if on mobile
export function isMobileDevice(): boolean {
  return getMobileConfig().isMobile;
}
