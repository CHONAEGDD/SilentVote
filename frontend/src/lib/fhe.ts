let instance: any = null;
let isInitialized = false;
let initError: string | null = null;
let isInitializing = false;

// Convert Uint8Array to hex string
function toHex(arr: Uint8Array): `0x${string}` {
  return `0x${Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

export async function initFhevm(): Promise<any> {
  if (typeof window === "undefined") {
    throw new Error("FHEVM can only be initialized in browser");
  }
  
  if (instance && isInitialized) return instance;
  if (initError) throw new Error(initError);
  if (isInitializing) {
    // Wait for existing initialization
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (isInitialized && instance) {
          clearInterval(checkInterval);
          resolve(instance);
        }
        if (initError) {
          clearInterval(checkInterval);
          reject(new Error(initError));
        }
      }, 100);
    });
  }

  isInitializing = true;

  try {
    // Dynamic import to avoid SSR issues
    const { initSDK, createInstance, SepoliaConfig } = await import("@zama-fhe/relayer-sdk/web");
    
    // Initialize with no threading to avoid Web Worker issues
    await initSDK({ thread: 0 });
    
    instance = await createInstance(SepoliaConfig);
    isInitialized = true;
    
    return instance;
  } catch (error: any) {
    initError = error.message || "Failed to initialize FHEVM";
    throw error;
  } finally {
    isInitializing = false;
  }
}

export function getFhevmInstance(): any {
  return instance;
}

export function isFhevmReady(): boolean {
  return isInitialized && instance !== null;
}

export function getFhevmError(): string | null {
  return initError;
}

/**
 * Encrypt vote choice as ebool (true = yes, false = no)
 * Contract uses externalEbool, so we use addBool
 */
export async function encryptVote(
  contractAddress: string,
  userAddress: string,
  isYes: boolean
): Promise<{ handle: `0x${string}`; inputProof: `0x${string}` }> {
  const fhevm = await initFhevm();
  const input = fhevm.createEncryptedInput(contractAddress, userAddress);
  input.addBool(isYes);
  const encrypted = await input.encrypt();
  
  return {
    handle: toHex(encrypted.handles[0]),
    inputProof: toHex(encrypted.inputProof),
  };
}

// Keep old function name for backward compatibility
export const encryptBool = encryptVote;

/**
 * Request public decryption of handles via local API proxy (avoids CORS)
 * Returns decrypted values - NO RETRY, fail fast
 */
export async function requestPublicDecryption(
  handles: string[]
): Promise<{ values: bigint[] }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  
  try {
    const response = await fetch("/api/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handles }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      if (errorText.includes("520") || errorText.includes("Web server")) {
        throw new Error("Zama Relayer is down");
      } else if (errorText.includes("not allowed")) {
        throw new Error("Not allowed for decryption");
      } else {
        throw new Error(`Relayer error: ${response.status}`);
      }
    }

    const result = await response.json();
    const values: bigint[] = [];
    
    if (result.clearValues) {
      for (const handle of handles) {
        const val = result.clearValues[handle];
        if (typeof val === 'bigint') values.push(val);
        else if (typeof val === 'number') values.push(BigInt(val));
        else if (typeof val === 'string') values.push(BigInt(val));
        else values.push(BigInt(0));
      }
    } else if (Array.isArray(result.values)) {
      for (const val of result.values) {
        values.push(BigInt(val));
      }
    } else {
      for (const handle of handles) {
        const val = result[handle];
        if (val !== undefined) values.push(BigInt(val));
        else values.push(BigInt(0));
      }
    }
    
    return { values };
  } catch (error: any) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error("Decryption timeout (20s)");
    }
    throw error;
  }
}

export function resetFhevm() {
  instance = null;
  isInitialized = false;
  initError = null;
  isInitializing = false;
}
