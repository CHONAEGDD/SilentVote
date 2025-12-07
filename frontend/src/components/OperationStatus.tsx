"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/store/useAppStore";

const stepIcons: { [key: string]: string[] } = {
  "Creating proposal": ["◇", "◈", "◆"],
  "Encrypting vote": ["🔐", "⏳", "✓"],
  "Submitting to chain": ["📤", "⏳", "✓"],
  "Confirming": ["⏳", "✓", "✓"],
  "Requesting decryption": ["🔓", "⏳", "✓"],
  "Decrypting results": ["⏳", "🔓", "✓"],
};

export function OperationStatus() {
  const { currentOperation, operationStep } = useAppStore();

  if (!currentOperation) return null;

  const icons = stepIcons[currentOperation] || ["◇", "◈", "◆"];
  const currentIcon = icons[Math.min(operationStep - 1, icons.length - 1)] || "◇";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-void-950/80 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="card text-center max-w-sm mx-4"
        >
          {/* Animated icon */}
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="text-5xl mb-6"
          >
            {currentIcon}
          </motion.div>

          {/* Operation text */}
          <p className="text-sand-200 text-lg mb-4">{currentOperation}</p>

          {/* Progress dots */}
          <div className="flex justify-center gap-2">
            {[1, 2, 3].map((step) => (
              <motion.div
                key={step}
                animate={{
                  scale: operationStep >= step ? 1 : 0.8,
                  opacity: operationStep >= step ? 1 : 0.3,
                }}
                className={`w-2 h-2 rounded-full ${
                  operationStep >= step ? "bg-frost-500" : "bg-sand-600"
                }`}
              />
            ))}
          </div>

          {/* Loading bar */}
          <div className="mt-6 h-1 bg-void-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "linear",
              }}
              className="h-full w-1/3 bg-gradient-to-r from-transparent via-frost-500 to-transparent"
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

