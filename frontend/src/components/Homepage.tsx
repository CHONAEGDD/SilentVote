"use client";

import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { motion } from "framer-motion";
import { RefreshIcon } from "./icons/RefreshIcon";
import { useAppStore } from "@/store/useAppStore";

interface HomepageProps {
  onStart: () => void;
}

export function Homepage({ onStart }: HomepageProps) {
  const { isConnected } = useAccount();
  const { fhevmStatus, resetApp, initFhevm } = useAppStore();

  const handleRefresh = () => {
    resetApp();
    initFhevm();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4">
      {/* Background strands */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="strand absolute w-px bg-gradient-to-b from-transparent via-frost-600/20 to-transparent"
            style={{
              left: `${20 + i * 20}%`,
              height: "60%",
              top: "20%",
            }}
          />
        ))}
      </div>

      {/* Refresh button */}
      <button
        onClick={handleRefresh}
        className="absolute top-6 right-6 p-3 rounded-full glass hover:bg-frost-900/30 transition-all duration-300 group z-10"
        title="Refresh"
      >
        <RefreshIcon className="w-5 h-5 text-frost-400 group-hover:text-frost-300 transition-colors" />
      </button>

      {/* Main content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center z-10"
      >
        <h1 className="text-6xl md:text-8xl font-light tracking-wider text-sand-100 mb-4">
          SILENT<span className="text-frost-400">VOTE</span>
        </h1>
        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="h-px w-32 mx-auto bg-gradient-to-r from-transparent via-frost-500 to-transparent mb-8"
        />

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-sand-400 text-lg mb-12 tracking-wide"
        >
          Privacy-preserving voting
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="flex flex-col items-center gap-6"
        >
          <ConnectButton.Custom>
            {({
              account,
              chain,
              openConnectModal,
              openAccountModal,
              mounted,
            }) => {
              const connected = mounted && account && chain;

              return (
                <div>
                  {!connected ? (
                    <button
                      onClick={openConnectModal}
                      className="btn-primary text-lg px-10 py-4"
                    >
                      Connect Wallet
                    </button>
                  ) : (
                    <button
                      onClick={openAccountModal}
                      className="btn-ghost px-6 py-3"
                    >
                      {account.displayName}
                    </button>
                  )}
                </div>
              );
            }}
          </ConnectButton.Custom>

          {isConnected && fhevmStatus === "ready" && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              onClick={onStart}
              className="btn-primary text-lg px-12 py-4 animate-glow"
            >
              Begin
            </motion.button>
          )}
        </motion.div>
      </motion.div>

      {/* Bottom gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-void-950 to-transparent pointer-events-none" />
    </section>
  );
}

