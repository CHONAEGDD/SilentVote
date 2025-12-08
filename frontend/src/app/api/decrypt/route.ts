import { NextRequest, NextResponse } from "next/server";

const RELAYER_URL = "https://relayer.testnet.zama.org";
const CHAIN_ID = 11155111;

export async function POST(request: NextRequest) {
  try {
    const { handles } = await request.json();
    
    console.log("Decrypt request for handles:", handles);
    
    const response = await fetch(`${RELAYER_URL}/v1/public-decrypt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chainId: CHAIN_ID,
        ciphertextHandles: handles,
        extraData: "0x00",
      }),
    });

    const responseText = await response.text();
    
    console.log("Relayer response status:", response.status);
    console.log("Relayer response body:", responseText);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Relayer error: ${response.status} - ${responseText}` },
        { status: response.status }
      );
    }

    const result = JSON.parse(responseText);
    
    // Log the parsed result for debugging
    console.log("Parsed relayer result:", JSON.stringify(result, null, 2));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Decrypt API error:", error);
    return NextResponse.json(
      { error: error.message || "Decryption failed" },
      { status: 500 }
    );
  }
}

