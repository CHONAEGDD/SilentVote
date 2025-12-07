import { create } from "zustand";
import { initFhevm, resetFhevm, isFhevmReady } from "@/lib/fhe";

export interface Proposal {
  id: number;
  title: string;
  creator: string;
  endTime: number;
  status: number; // 0: Active, 1: PendingDecryption, 2: Decrypted
  decryptedYes: number;
  decryptedNo: number;
  yesHandle?: string;
  noHandle?: string;
}

export interface UserVote {
  proposalId: number;
  choice: "yes" | "no";
  timestamp: number;
}

interface AppState {
  // FHEVM
  fhevmInstance: any;
  fhevmStatus: "checking" | "ready" | "error";
  fhevmError: string | null;

  // Proposals
  proposals: Proposal[];
  userVotes: UserVote[];
  
  // UI State
  currentOperation: string | null;
  operationStep: number;
  isLoading: boolean;

  // Actions
  initFhevm: () => Promise<void>;
  setFhevmStatus: (status: "checking" | "ready" | "error", error?: string) => void;
  setProposals: (proposals: Proposal[]) => void;
  addProposal: (proposal: Proposal) => void;
  updateProposal: (id: number, data: Partial<Proposal>) => void;
  addUserVote: (vote: UserVote) => void;
  setCurrentOperation: (op: string | null, step?: number) => void;
  setLoading: (loading: boolean) => void;
  resetApp: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  fhevmInstance: null,
  fhevmStatus: "checking",
  fhevmError: null,
  proposals: [],
  userVotes: [],
  currentOperation: null,
  operationStep: 0,
  isLoading: false,

  initFhevm: async () => {
    if (isFhevmReady()) {
      set({ fhevmStatus: "ready" });
      return;
    }

    set({ fhevmStatus: "checking", fhevmError: null });

    try {
      const instance = await initFhevm();
      set({ fhevmInstance: instance, fhevmStatus: "ready" });
    } catch (error: any) {
      set({ 
        fhevmStatus: "error", 
        fhevmError: error.message || "Failed to initialize FHEVM" 
      });
    }
  },

  setFhevmStatus: (status, error) => set({ fhevmStatus: status, fhevmError: error || null }),

  setProposals: (proposals) => set({ proposals }),

  addProposal: (proposal) => set((state) => ({
    proposals: [proposal, ...state.proposals]
  })),

  updateProposal: (id, data) => set((state) => ({
    proposals: state.proposals.map((p) => 
      p.id === id ? { ...p, ...data } : p
    )
  })),

  addUserVote: (vote) => set((state) => ({
    userVotes: [vote, ...state.userVotes]
  })),

  setCurrentOperation: (op, step = 0) => set({ 
    currentOperation: op, 
    operationStep: step 
  }),

  setLoading: (loading) => set({ isLoading: loading }),

  resetApp: () => {
    resetFhevm();
    set({
      fhevmInstance: null,
      fhevmStatus: "checking",
      fhevmError: null,
      proposals: [],
      userVotes: [],
      currentOperation: null,
      operationStep: 0,
      isLoading: false,
    });
  },
}));
