"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReadContract, usePublicClient } from "wagmi";
import { useAppStore, type Proposal } from "@/store/useAppStore";
import { ProposalCard } from "./ProposalCard";
import { CONTRACT_ADDRESS, SILENTVOTE_ABI } from "@/lib/contract";

export function ProposalList() {
  const { proposals, setProposals } = useAppStore();
  const [, setTick] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const publicClient = usePublicClient();

  // Read proposal count from chain
  const { data: proposalCount, refetch } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SILENTVOTE_ABI,
    functionName: "proposalCount",
  });

  // Sync proposals from chain (pure on-chain data, no caching)
  const syncFromChain = useCallback(async () => {
    if (!publicClient || !proposalCount) return;

    const count = Number(proposalCount);
    if (count === 0) {
      setProposals([]);
      setIsLoading(false);
      return;
    }

    try {
      const onchainProposals: Proposal[] = [];

      // Read all proposals from chain (newest first)
      for (let id = count; id >= 1 && id > count - 10; id--) {
        try {
          const data = await publicClient.readContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: SILENTVOTE_ABI,
            functionName: "getProposal",
            args: [BigInt(id)],
          }) as [string, string, bigint, number, bigint, bigint];

          onchainProposals.push({
            id,
            title: data[0],
            creator: data[1],
            endTime: Number(data[2]) * 1000, // Convert seconds to ms
            status: Number(data[3]),
            decryptedYes: Number(data[4]),
            decryptedNo: Number(data[5]),
          });
        } catch {
          // Skip invalid proposals
        }
      }

      setProposals(onchainProposals);
    } catch {
      // Sync failed silently
    } finally {
      setIsLoading(false);
    }
  }, [publicClient, proposalCount, setProposals]);

  // Initial sync and periodic refresh
  useEffect(() => {
    syncFromChain();
  }, [syncFromChain]);

  // Refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
      syncFromChain();
    }, 10000);
    return () => clearInterval(interval);
  }, [refetch, syncFromChain]);

  // Update timer every second
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="text-center py-20">
        <div className="text-2xl animate-pulse text-frost-400">Loading...</div>
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4 opacity-20">◇</div>
        <p className="text-sand-500">No proposals yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AnimatePresence mode="popLayout">
        {proposals.map((proposal, index) => (
          <motion.div
            key={proposal.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ delay: index * 0.1 }}
          >
            <ProposalCard proposal={proposal} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

