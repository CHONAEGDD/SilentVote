"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from "wagmi";
import { motion } from "framer-motion";
import { useAppStore, type Proposal } from "@/store/useAppStore";
import { CONTRACT_ADDRESS, SILENTVOTE_ABI } from "@/lib/contract";
import { encryptVote, requestPublicDecryption } from "@/lib/fhe";
import toast from "react-hot-toast";

interface ProposalCardProps {
  proposal: Proposal;
}

export function ProposalCard({ proposal }: ProposalCardProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { addUserVote, updateProposal, setCurrentOperation, userVotes, fhevmStatus } = useAppStore();
  const [timeLeft, setTimeLeft] = useState("");
  const [isExpired, setIsExpired] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [pendingDecrypt, setPendingDecrypt] = useState(false);
  const [localDecrypted, setLocalDecrypted] = useState<{ yes: number; no: number } | null>(null);

  // For voting
  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // For allowDecryption
  const { writeContract: writeAllowDecrypt, data: allowHash, isPending: isAllowPending, reset: resetAllow } = useWriteContract();
  const { isLoading: isAllowConfirming, isSuccess: isAllowSuccess } = useWaitForTransactionReceipt({ hash: allowHash });

  // Read proposal handles for decryption
  const { data: handles, refetch: refetchHandles } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SILENTVOTE_ABI,
    functionName: "getProposalHandles",
    args: [BigInt(proposal.id)],
    query: { enabled: isExpired }
  });

  const hasVoted = userVotes.some((v) => v.proposalId === proposal.id);

  // Load cached decryption result from localStorage
  useEffect(() => {
    const cached = localStorage.getItem(`silentvote_result_${proposal.id}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setLocalDecrypted(parsed);
      } catch {}
    }
  }, [proposal.id]);

  // Timer
  useEffect(() => {
    const updateTime = () => {
      const now = Date.now();
      const diff = proposal.endTime - now;

      if (diff <= 0) {
        setTimeLeft("Ended");
        setIsExpired(true);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        if (hours > 0) {
          setTimeLeft(`${hours}h ${minutes}m`);
        } else if (minutes > 0) {
          setTimeLeft(`${minutes}m ${seconds}s`);
        } else {
          setTimeLeft(`${seconds}s`);
        }
        setIsExpired(false);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [proposal.endTime]);

  // Handle vote transaction success
  useEffect(() => {
    if (isSuccess && isVoting) {
      setIsVoting(false);
      setCurrentOperation(null);
      toast.success("Vote submitted!");
      reset();
    }
  }, [isSuccess, isVoting, setCurrentOperation, reset]);

  // Handle allowDecryption success -> then decrypt
  useEffect(() => {
    if (isAllowSuccess && pendingDecrypt) {
      setPendingDecrypt(false);
      resetAllow();
      // Now call relayer for decryption
      performDecryption();
    }
  }, [isAllowSuccess, pendingDecrypt]);

  const performDecryption = async () => {
    setCurrentOperation("Decrypting results", 3);
    
    try {
      // Refetch handles to get fresh data
      const { data: freshHandles } = await refetchHandles();
      
      if (!freshHandles || freshHandles[0] === "0x0000000000000000000000000000000000000000000000000000000000000000") {
        toast.error("No votes to decrypt");
        setIsDecrypting(false);
        setCurrentOperation(null);
        return;
      }

      const [yesHandle, noHandle] = freshHandles as [string, string];
      
      console.log("Decrypting handles:", { yesHandle, noHandle });
      
      const { values } = await requestPublicDecryption([yesHandle, noHandle]);
      
      console.log("Decryption result:", values);

      const yesVotes = Number(values[0]);
      const noVotes = Number(values[1]);

      // Save to localStorage for persistence
      localStorage.setItem(`silentvote_result_${proposal.id}`, JSON.stringify({ yes: yesVotes, no: noVotes }));
      setLocalDecrypted({ yes: yesVotes, no: noVotes });

      // Update store
      updateProposal(proposal.id, { 
        status: 2, 
        decryptedYes: yesVotes, 
        decryptedNo: noVotes 
      });

      toast.success("Results ready!");
    } catch (error: any) {
      console.error("Decryption error:", error);
      const msg = error.message || "";
      if (msg.includes("520") || msg.includes("down")) {
        toast.error("Zama relayer is down (520)");
      } else if (msg.includes("timeout") || msg.includes("Timeout")) {
        toast.error("Zama relayer not responding (timeout)");
      } else {
        toast.error("Decryption failed: " + msg.slice(0, 30));
      }
    } finally {
      setIsDecrypting(false);
      setCurrentOperation(null);
    }
  };

  const handleVote = async (choice: "yes" | "no") => {
    if (hasVoted || !address) {
      toast.error("Already voted or not connected");
      return;
    }

    if (fhevmStatus !== "ready") {
      toast.error("FHE not ready");
      return;
    }

    setCurrentOperation("Encrypting vote", 1);
    setIsVoting(true);

    try {
      const encrypted = await encryptVote(CONTRACT_ADDRESS, address, choice === "yes");
      
      setCurrentOperation("Submitting vote", 2);

      // Add to local vote history first
      addUserVote({
        proposalId: proposal.id,
        choice,
        timestamp: Date.now(),
      });

      // Submit vote transaction with reasonable gas limit for FHE operations
      writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SILENTVOTE_ABI,
        functionName: "vote",
        args: [BigInt(proposal.id), encrypted.handle, encrypted.inputProof],
        gas: BigInt(5000000),
      });

    } catch (error: any) {
      setIsVoting(false);
      setCurrentOperation(null);
      toast.error(error.message?.slice(0, 50) || "Vote failed");
    }
  };

  /**
   * View results flow:
   * 1. Check on-chain status
   * 2. If Active (0) -> call allowDecryption (needs gas)
   * 3. If PendingDecryption (1) or after allowDecryption -> call relayer directly (no gas)
   */
  const handleViewResults = async () => {
    if (!address) {
      toast.error("Connect wallet first");
      return;
    }

    if (!handles) {
      toast.error("No votes yet");
      return;
    }

    setIsDecrypting(true);
    setCurrentOperation("Checking status", 1);
    
    try {
      // Read current on-chain status
      const onchainData = await publicClient?.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SILENTVOTE_ABI,
        functionName: "getProposal",
        args: [BigInt(proposal.id)],
      }) as [string, string, bigint, number, bigint, bigint];

      const onchainStatus = Number(onchainData[3]);
      
      console.log("On-chain status:", onchainStatus);

      if (onchainStatus === 2) {
        // Already decrypted on-chain, just read the values
        const yesVotes = Number(onchainData[4]);
        const noVotes = Number(onchainData[5]);
        
        localStorage.setItem(`silentvote_result_${proposal.id}`, JSON.stringify({ yes: yesVotes, no: noVotes }));
        setLocalDecrypted({ yes: yesVotes, no: noVotes });
        updateProposal(proposal.id, { status: 2, decryptedYes: yesVotes, decryptedNo: noVotes });
        
        toast.success("Results loaded!");
        setIsDecrypting(false);
        setCurrentOperation(null);
        return;
      }

      if (onchainStatus === 1) {
        // Already pending decryption, just call relayer (no gas needed)
        performDecryption();
        return;
      }

      // Status is 0 (Active), need to call allowDecryption first
      setCurrentOperation("Preparing decryption (gas required)", 2);
      setPendingDecrypt(true);
      
      writeAllowDecrypt({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SILENTVOTE_ABI,
        functionName: "allowDecryption",
        args: [BigInt(proposal.id)],
        gas: BigInt(3000000),
      });

    } catch (error: any) {
      console.error("View results error:", error);
      const msg = error.message || "";
      
      if (msg.includes("Not active") || msg.includes("Voting not ended")) {
        // Status check failed but voting ended, try direct decrypt
        performDecryption();
      } else if (msg.includes("rejected")) {
        toast.error("Transaction rejected");
        setIsDecrypting(false);
        setPendingDecrypt(false);
        setCurrentOperation(null);
      } else {
        toast.error("Failed: " + msg.slice(0, 40));
        setIsDecrypting(false);
        setPendingDecrypt(false);
        setCurrentOperation(null);
      }
    }
  };

  // Update operation status when allowDecryption is confirming
  useEffect(() => {
    if (isAllowConfirming && pendingDecrypt) {
      setCurrentOperation("Waiting for confirmation", 2);
    }
  }, [isAllowConfirming, pendingDecrypt]);

  // Use local decrypted values if available, otherwise use proposal values
  const displayYes = localDecrypted?.yes ?? proposal.decryptedYes;
  const displayNo = localDecrypted?.no ?? proposal.decryptedNo;
  const isDecryptedLocally = localDecrypted !== null;
  const showResults = proposal.status === 2 || isDecryptedLocally;

  const totalVotes = displayYes + displayNo;
  const yesPercent = totalVotes > 0 ? (displayYes / totalVotes) * 100 : 50;

  // Format date from endTime (subtract duration to get creation time approximation)
  const createdDate = new Date(proposal.endTime - 5 * 60 * 1000); // Assume 5min default
  const dateStr = createdDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="card group hover:border-frost-600/30 transition-all duration-300">
      {/* Header with ID and time */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-frost-500 font-mono">#{proposal.id}</span>
        <div
          className={`text-sm px-3 py-1 rounded-full ${
            isExpired
              ? "bg-sand-800/50 text-sand-400"
              : "bg-frost-800/50 text-frost-300"
          }`}
        >
          {timeLeft}
        </div>
      </div>
      
      {/* Title */}
      <h3 className="text-lg text-sand-100 font-medium mb-4">
        {proposal.title}
      </h3>

      {showResults ? (
        /* Decrypted Results */
        <div className="space-y-3">
          <div className="relative h-8 bg-void-800 rounded-lg overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${yesPercent}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-frost-600 to-frost-500"
            />
            <div className="absolute inset-0 flex items-center justify-between px-3 text-sm">
              <span className="text-sand-100">Yes: {displayYes}</span>
              <span className="text-sand-100">No: {displayNo}</span>
            </div>
          </div>
          <p className="text-center text-sand-400 text-sm">
            {displayYes > displayNo
              ? "✓ Passed"
              : displayYes < displayNo
              ? "✗ Rejected"
              : totalVotes === 0 
              ? "No votes"
              : "— Tied"}
          </p>
        </div>
      ) : isExpired ? (
        /* Ended - View Results */
        <div className="flex justify-center">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleViewResults}
            disabled={isDecrypting || !handles}
            className="btn-primary"
          >
            {isDecrypting ? "Decrypting..." : !handles ? "Loading..." : "View Results"}
          </motion.button>
        </div>
      ) : (
        /* Active - Show Vote Buttons */
        <div className="flex gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleVote("yes")}
            disabled={hasVoted || isPending || isConfirming || isVoting}
            className={`flex-1 py-3 rounded-lg transition-all ${
              hasVoted
                ? "bg-void-700 text-sand-500 cursor-not-allowed"
                : "bg-frost-800/50 text-frost-200 hover:bg-frost-700/50"
            }`}
          >
            {hasVoted ? "Voted" : isVoting ? "..." : "Yes"}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleVote("no")}
            disabled={hasVoted || isPending || isConfirming || isVoting}
            className={`flex-1 py-3 rounded-lg transition-all ${
              hasVoted
                ? "bg-void-700 text-sand-500 cursor-not-allowed"
                : "bg-sand-800/50 text-sand-200 hover:bg-sand-700/50"
            }`}
          >
            {hasVoted ? "Voted" : isVoting ? "..." : "No"}
          </motion.button>
        </div>
      )}

      {/* Creator info */}
      <div className="mt-4 pt-4 border-t border-frost-800/20 flex justify-between text-xs text-sand-500">
        <span>by {proposal.creator.slice(0, 6)}...{proposal.creator.slice(-4)}</span>
        <span>{dateStr}</span>
      </div>
    </div>
  );
}
