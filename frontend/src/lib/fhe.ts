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
  const timeout = setTimeout(() => controller.abort(), 30000);
  
  try {
    console.log("Requesting decryption for handles:", handles);
    
    const response = await fetch("/api/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handles }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Decrypt API error response:", errorText);
      if (errorText.includes("520") || errorText.includes("Web server")) {
        throw new Error("Zama Relayer is down");
      } else if (errorText.includes("not allowed")) {
        throw new Error("Not allowed for decryption");
      } else {
        throw new Error(`Relayer error: ${response.status}`);
      }
    }

    const result = await response.json();
    console.log("Decrypt API result:", JSON.stringify(result, null, 2));
    
    const values: bigint[] = [];
    
    // Try different response formats from Zama Relayer
    if (result.clearValues) {
      // Format: { clearValues: { "0x...handle": "value", ... } }
      for (const handle of handles) {
        const val = result.clearValues[handle];
        console.log(`Handle ${handle} -> value:`, val);
        if (val !== undefined && val !== null) {
          values.push(BigInt(val));
        } else {
          values.push(BigInt(0));
        }
      }
    } else if (result.decryptedValues) {
      // Format: { decryptedValues: { "0x...handle": value, ... } }
      for (const handle of handles) {
        const val = result.decryptedValues[handle];
        console.log(`Handle ${handle} -> decryptedValue:`, val);
        if (val !== undefined && val !== null) {
          values.push(BigInt(val));
        } else {
          values.push(BigInt(0));
        }
      }
    } else if (Array.isArray(result.values)) {
      // Format: { values: [value1, value2, ...] }
      for (const val of result.values) {
        values.push(BigInt(val));
      }
    } else if (Array.isArray(result)) {
      // Format: [value1, value2, ...]
      for (const val of result) {
        values.push(BigInt(val));
      }
    } else {
      // Try direct handle lookup
      for (const handle of handles) {
        const val = result[handle];
        console.log(`Direct lookup ${handle} ->`, val);
        if (val !== undefined && val !== null) {
          values.push(BigInt(val));
        } else {
          values.push(BigInt(0));
        }
      }
    }
    
    console.log("Final parsed values:", values.map(v => v.toString()));
    
    return { values };
  } catch (error: any) {
    clearTimeout(timeout);
    console.error("requestPublicDecryption error:", error);
    if (error.name === 'AbortError') {
      throw new Error("Decryption timeout (30s)");
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
