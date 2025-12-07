"use client";

import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { Homepage } from "@/components/Homepage";
import { VotingApp } from "@/components/VotingApp";
import { StatusBar } from "@/components/StatusBar";
import { NoiseOverlay } from "@/components/NoiseOverlay";
import { useAppStore } from "@/store/useAppStore";

export default function Home() {
  const { isConnected } = useAccount();
  const votingRef = useRef<HTMLDivElement>(null);
  const { initFhevm, resetApp } = useAppStore();

  // Initialize FHE on page load
  useEffect(() => {
    initFhevm();
  }, [initFhevm]);

  // Reset when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      resetApp();
      // Re-init FHE after reset
      initFhevm();
    }
  }, [isConnected, resetApp, initFhevm]);

  const scrollToVoting = () => {
    votingRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main className="relative min-h-screen">
      <NoiseOverlay />
      <StatusBar />
      
      <Homepage onStart={scrollToVoting} />
      
      <div ref={votingRef}>
        {isConnected && <VotingApp />}
      </div>
    </main>
  );
}
