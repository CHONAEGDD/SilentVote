"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CreateProposal } from "./CreateProposal";
import { ProposalList } from "./ProposalList";
import { UserVoteHistory } from "./UserVoteHistory";
import { OperationStatus } from "./OperationStatus";

type Tab = "proposals" | "my-votes";

export function VotingApp() {
  const [activeTab, setActiveTab] = useState<Tab>("proposals");

  return (
    <section className="min-h-screen px-4 py-20">
      <div className="max-w-4xl mx-auto">
        {/* Operation Status Overlay */}
        <OperationStatus />

        {/* Create Proposal Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-12"
        >
          <CreateProposal />
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex gap-4 mb-8 border-b border-frost-800/30"
        >
          <button
            onClick={() => setActiveTab("proposals")}
            className={`pb-3 px-2 text-sm tracking-wide transition-all relative ${
              activeTab === "proposals"
                ? "text-frost-300"
                : "text-sand-500 hover:text-sand-300"
            }`}
          >
            All Proposals
            {activeTab === "proposals" && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-px bg-frost-500"
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab("my-votes")}
            className={`pb-3 px-2 text-sm tracking-wide transition-all relative ${
              activeTab === "my-votes"
                ? "text-frost-300"
                : "text-sand-500 hover:text-sand-300"
            }`}
          >
            My Votes
            {activeTab === "my-votes" && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-px bg-frost-500"
              />
            )}
          </button>
        </motion.div>

        {/* Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === "proposals" ? <ProposalList /> : <UserVoteHistory />}
        </motion.div>
      </div>
    </section>
  );
}

