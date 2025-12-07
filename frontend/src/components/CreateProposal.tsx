"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { motion } from "framer-motion";
import { useAppStore } from "@/store/useAppStore";
import { CONTRACT_ADDRESS, SILENTVOTE_ABI } from "@/lib/contract";
import toast from "react-hot-toast";

export function CreateProposal() {
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(5); // minutes
  const { address } = useAccount();
  const { setCurrentOperation, fhevmStatus } = useAppStore();
  const processedHash = useRef<string | null>(null);
  
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Handle transaction success
  useEffect(() => {
    if (isSuccess && hash && processedHash.current !== hash) {
      processedHash.current = hash;
      
      // Just show success message - ProposalList will sync from chain
      setTitle("");
      setCurrentOperation(null);
      toast.success("Proposal created! Syncing...");
    }
  }, [isSuccess, hash, setCurrentOperation]);

  useEffect(() => {
    if (error) {
      setCurrentOperation(null);
      toast.error(error.message?.slice(0, 50) || "Transaction failed");
    }
  }, [error, setCurrentOperation]);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Enter a proposal title");
      return;
    }

    if (fhevmStatus !== "ready") {
      toast.error("FHE not ready");
      return;
    }

    if (!address) {
      toast.error("Connect wallet first");
      return;
    }

    setCurrentOperation("Creating proposal", 1);

    try {
      writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SILENTVOTE_ABI,
        functionName: "createProposal",
        args: [title.trim(), BigInt(duration)],
      });
    } catch {
      setCurrentOperation(null);
      toast.error("Failed to create proposal");
    }
  };

  return (
    <div className="card">
      <h2 className="text-xl text-sand-200 mb-6 tracking-wide">New Proposal</h2>
      
      <div className="space-y-4">
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What should we decide?"
            className="input-field"
            maxLength={100}
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-sm text-sand-500 mb-1 block">Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="input-field"
            >
              <option value={1}>1 minute</option>
              <option value={2}>2 minutes</option>
              <option value={5}>5 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={1440}>24 hours</option>
            </select>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCreate}
            disabled={!title.trim() || fhevmStatus !== "ready" || isPending || isConfirming || !address}
            className="btn-primary mt-6"
          >
            {isPending || isConfirming ? "..." : "Create"}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
