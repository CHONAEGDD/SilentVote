"use client";

import { useAppStore } from "@/store/useAppStore";
import { CONTRACT_ADDRESS } from "@/lib/contract";
import { motion } from "framer-motion";

export function StatusBar() {
  const { fhevmStatus, fhevmError } = useAppStore();

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const openExplorer = () => {
    window.open(`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`, "_blank");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 glass border-b border-frost-800/20"
    >
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between text-sm">
        {/* FHEVM Status */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                fhevmStatus === "ready"
                  ? "bg-green-500 animate-pulse"
                  : fhevmStatus === "checking"
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-red-500"
              }`}
            />
            <span className="text-sand-400">
              FHE:{" "}
              <span
                className={
                  fhevmStatus === "ready"
                    ? "text-green-400"
                    : fhevmStatus === "checking"
                    ? "text-yellow-400"
                    : "text-red-400"
                }
              >
                {fhevmStatus === "ready"
                  ? "Ready"
                  : fhevmStatus === "checking"
                  ? "Initializing..."
                  : "Error"}
              </span>
            </span>
          </div>
          {fhevmError && (
            <span className="text-red-400 text-xs ml-2" title={fhevmError}>
              ({fhevmError.slice(0, 30)}...)
            </span>
          )}
        </div>

        {/* Contract Address */}
        <button
          onClick={openExplorer}
          className="flex items-center gap-2 text-sand-400 hover:text-frost-300 transition-colors group"
        >
          <span className="text-sand-500">Contract:</span>
          <span className="font-mono group-hover:underline">
            {truncateAddress(CONTRACT_ADDRESS)}
          </span>
          <svg
            className="w-3 h-3 opacity-50 group-hover:opacity-100"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}
