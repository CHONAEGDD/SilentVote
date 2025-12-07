"use client";

// Polyfill for @zama-fhe/relayer-sdk
if (typeof window !== "undefined") {
  (window as any).global = window;
}

import * as React from "react";
import {
  RainbowKitProvider,
  connectorsForWallets,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import { injectedWallet } from "@rainbow-me/rainbowkit/wallets";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { Toaster } from "react-hot-toast";
import "@rainbow-me/rainbowkit/styles.css";

// Only injected wallet (MetaMask) - WalletConnect conflicts with COOP headers required by FHE
const connectors = connectorsForWallets(
  [
    {
      groupName: "Browser Wallet",
      wallets: [injectedWallet],
    },
  ],
  {
    appName: "SilentVote",
    projectId: "silentvote",
  }
);

const config = createConfig({
  connectors,
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          locale="en"
          theme={darkTheme({
            accentColor: "#627d98",
            accentColorForeground: "#f0f4f8",
            borderRadius: "medium",
            fontStack: "system",
            overlayBlur: "small",
          })}
          modalSize="compact"
        >
          {mounted && children}
          <Toaster
            position="bottom-center"
            toastOptions={{
              style: {
                background: "#151515",
                color: "#d9e2ec",
                border: "1px solid rgba(98, 125, 152, 0.2)",
              },
              success: {
                iconTheme: {
                  primary: "#627d98",
                  secondary: "#f0f4f8",
                },
              },
              error: {
                iconTheme: {
                  primary: "#ef4444",
                  secondary: "#f0f4f8",
                },
              },
            }}
          />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
