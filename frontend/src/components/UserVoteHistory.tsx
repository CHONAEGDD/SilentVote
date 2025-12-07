"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/store/useAppStore";

export function UserVoteHistory() {
  const { userVotes, proposals } = useAppStore();

  const getProposalTitle = (proposalId: number) => {
    const proposal = proposals.find((p) => p.id === proposalId);
    return proposal?.title || "Unknown Proposal";
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (userVotes.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4 opacity-20">◈</div>
        <p className="text-sand-500">No votes cast yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {userVotes.map((vote, index) => (
          <motion.div
            key={`${vote.proposalId}-${vote.timestamp}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ delay: index * 0.05 }}
            className="card flex items-center justify-between py-4"
          >
            <div className="flex-1">
              <p className="text-sand-200">{getProposalTitle(vote.proposalId)}</p>
              <p className="text-xs text-sand-500 mt-1">
                {formatTime(vote.timestamp)}
              </p>
            </div>
            <div
              className={`px-4 py-1.5 rounded-full text-sm ${
                vote.choice === "yes"
                  ? "bg-frost-800/50 text-frost-300"
                  : "bg-sand-800/50 text-sand-300"
              }`}
            >
              {vote.choice.toUpperCase()}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

