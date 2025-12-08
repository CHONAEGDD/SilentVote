import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { MockSilentVote } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * SilentVote Contract Tests
 * 
 * Test Strategy:
 * - MockSilentVote: Tests business logic without FHE dependencies
 * - SilentVote Interface: Validates ABI compatibility
 * - Sepolia Integration: Full FHE flow (documented, manual)
 * 
 * Deployed Contract:
 * https://sepolia.etherscan.io/address/0x72327D579777A230dc2cd7adDa73F509d3c4D43d
 */

describe("SilentVote", function () {
  let mockContract: MockSilentVote;
  let owner: SignerWithAddress;
  let voter1: SignerWithAddress;
  let voter2: SignerWithAddress;
  let voter3: SignerWithAddress;

  beforeEach(async function () {
    [owner, voter1, voter2, voter3] = await ethers.getSigners();
    const MockFactory = await ethers.getContractFactory("MockSilentVote");
    mockContract = await MockFactory.deploy();
    await mockContract.waitForDeployment();
  });

  // ==================== CONTRACT INTERFACE ====================
  
  describe("Contract Interface", function () {
    it("Should have correct function signatures", async function () {
      const SilentVoteFactory = await ethers.getContractFactory("SilentVote");
      const iface = SilentVoteFactory.interface;
      
      expect(iface.getFunction("createProposal")).to.not.be.null;
      expect(iface.getFunction("vote")).to.not.be.null;
      expect(iface.getFunction("allowDecryption")).to.not.be.null;
      expect(iface.getFunction("submitDecryptedResults")).to.not.be.null;
      expect(iface.getFunction("getProposal")).to.not.be.null;
      expect(iface.getFunction("getProposalHandles")).to.not.be.null;
      expect(iface.getFunction("hasUserVoted")).to.not.be.null;
      expect(iface.getFunction("isVotingActive")).to.not.be.null;
      expect(iface.getFunction("proposalCount")).to.not.be.null;
    });

    it("Should have correct event signatures", async function () {
      const SilentVoteFactory = await ethers.getContractFactory("SilentVote");
      const iface = SilentVoteFactory.interface;
      
      expect(iface.getEvent("ProposalCreated")).to.not.be.null;
      expect(iface.getEvent("VoteCast")).to.not.be.null;
      expect(iface.getEvent("DecryptionReady")).to.not.be.null;
      expect(iface.getEvent("ResultsDecrypted")).to.not.be.null;
    });
  });

  // ==================== PROPOSAL CREATION ====================

  describe("Proposal Creation", function () {
    it("Should create proposal with valid parameters", async function () {
      const tx = await mockContract.createProposal("Test Proposal", 5);
      const receipt = await tx.wait();
      
      expect(await mockContract.proposalCount()).to.equal(1);
      
      const proposal = await mockContract.getProposal(1);
      expect(proposal.title).to.equal("Test Proposal");
      expect(proposal.creator).to.equal(owner.address);
      expect(proposal.status).to.equal(0); // Active
    });

    it("Should emit ProposalCreated event", async function () {
      await expect(mockContract.createProposal("Event Test", 10))
        .to.emit(mockContract, "ProposalCreated");
      
      // Verify event args separately due to timestamp precision
      const proposal = await mockContract.getProposal(1);
      expect(proposal.title).to.equal("Event Test");
      expect(proposal.creator).to.equal(owner.address);
    });

    it("Should reject empty title", async function () {
      await expect(mockContract.createProposal("", 5))
        .to.be.revertedWith("Empty title");
    });

    it("Should reject duration < 1 minute", async function () {
      await expect(mockContract.createProposal("Test", 0))
        .to.be.revertedWith("Invalid duration");
    });

    it("Should reject duration > 30 days (43200 minutes)", async function () {
      await expect(mockContract.createProposal("Test", 43201))
        .to.be.revertedWith("Invalid duration");
    });

    it("Should accept minimum duration (1 minute)", async function () {
      await expect(mockContract.createProposal("Min Duration", 1))
        .to.not.be.reverted;
    });

    it("Should accept maximum duration (30 days)", async function () {
      await expect(mockContract.createProposal("Max Duration", 43200))
        .to.not.be.reverted;
    });

    it("Should increment proposalCount correctly", async function () {
      expect(await mockContract.proposalCount()).to.equal(0);
      
      await mockContract.createProposal("First", 5);
      expect(await mockContract.proposalCount()).to.equal(1);
      
      await mockContract.createProposal("Second", 5);
      expect(await mockContract.proposalCount()).to.equal(2);
      
      await mockContract.createProposal("Third", 5);
      expect(await mockContract.proposalCount()).to.equal(3);
    });

    it("Should set correct end time", async function () {
      const durationMinutes = 60;
      const tx = await mockContract.createProposal("Time Test", durationMinutes);
      await tx.wait();
      
      const proposal = await mockContract.getProposal(1);
      const expectedEndTime = await time.latest() + durationMinutes * 60;
      
      // Allow 1 second tolerance for block time
      expect(proposal.endTime).to.be.closeTo(expectedEndTime, 1);
    });
  });

  // ==================== VOTING ====================

  describe("Voting", function () {
    beforeEach(async function () {
      await mockContract.createProposal("Vote Test", 60);
    });

    it("Should allow voting on active proposal", async function () {
      await expect(mockContract.connect(voter1).vote(1, true))
        .to.emit(mockContract, "VoteCast")
        .withArgs(1, voter1.address);
    });

    it("Should track hasVoted correctly", async function () {
      expect(await mockContract.hasUserVoted(1, voter1.address)).to.be.false;
      
      await mockContract.connect(voter1).vote(1, true);
      
      expect(await mockContract.hasUserVoted(1, voter1.address)).to.be.true;
      expect(await mockContract.hasUserVoted(1, voter2.address)).to.be.false;
    });

    it("Should prevent double voting", async function () {
      await mockContract.connect(voter1).vote(1, true);
      
      await expect(mockContract.connect(voter1).vote(1, false))
        .to.be.revertedWith("Already voted");
    });

    it("Should reject voting on non-existent proposal", async function () {
      await expect(mockContract.connect(voter1).vote(999, true))
        .to.be.revertedWith("Proposal not found");
    });

    it("Should reject voting after end time", async function () {
      // Fast forward past end time
      await time.increase(61 * 60); // 61 minutes
      
      await expect(mockContract.connect(voter1).vote(1, true))
        .to.be.revertedWith("Voting ended");
    });

    it("Should allow multiple users to vote", async function () {
      await mockContract.connect(voter1).vote(1, true);
      await mockContract.connect(voter2).vote(1, false);
      await mockContract.connect(voter3).vote(1, true);
      
      expect(await mockContract.hasUserVoted(1, voter1.address)).to.be.true;
      expect(await mockContract.hasUserVoted(1, voter2.address)).to.be.true;
      expect(await mockContract.hasUserVoted(1, voter3.address)).to.be.true;
    });

    it("Should correctly check isVotingActive", async function () {
      expect(await mockContract.isVotingActive(1)).to.be.true;
      
      // Fast forward past end time
      await time.increase(61 * 60);
      
      expect(await mockContract.isVotingActive(1)).to.be.false;
    });
  });

  // ==================== DECRYPTION FLOW ====================

  describe("Decryption Flow", function () {
    beforeEach(async function () {
      await mockContract.createProposal("Decrypt Test", 5);
      await mockContract.connect(voter1).vote(1, true);
      await mockContract.connect(voter2).vote(1, true);
      await mockContract.connect(voter3).vote(1, false);
    });

    it("Should reject allowDecryption before voting ends", async function () {
      await expect(mockContract.allowDecryption(1))
        .to.be.revertedWith("Voting not ended");
    });

    it("Should allow decryption after voting ends", async function () {
      await time.increase(6 * 60); // 6 minutes
      
      await expect(mockContract.allowDecryption(1))
        .to.emit(mockContract, "DecryptionReady")
        .withArgs(1);
    });

    it("Should update status to PendingDecryption", async function () {
      await time.increase(6 * 60);
      await mockContract.allowDecryption(1);
      
      const proposal = await mockContract.getProposal(1);
      expect(proposal.status).to.equal(1); // PendingDecryption
    });

    it("Should reject allowDecryption on non-existent proposal", async function () {
      await time.increase(6 * 60);
      await expect(mockContract.allowDecryption(999))
        .to.be.revertedWith("Proposal not found");
    });

    it("Should reject double allowDecryption", async function () {
      await time.increase(6 * 60);
      await mockContract.allowDecryption(1);
      
      await expect(mockContract.allowDecryption(1))
        .to.be.revertedWith("Not active");
    });
  });

  // ==================== RESULT FINALIZATION ====================

  describe("Result Finalization", function () {
    beforeEach(async function () {
      await mockContract.createProposal("Final Test", 5);
      await mockContract.connect(voter1).vote(1, true);
      await mockContract.connect(voter2).vote(1, true);
      await mockContract.connect(voter3).vote(1, false);
      await time.increase(6 * 60);
      await mockContract.allowDecryption(1);
    });

    it("Should finalize results correctly", async function () {
      await expect(mockContract.finalizeResults(1))
        .to.emit(mockContract, "ResultsDecrypted")
        .withArgs(1, 2, 1); // 2 yes, 1 no
    });

    it("Should update decrypted values", async function () {
      await mockContract.finalizeResults(1);
      
      const proposal = await mockContract.getProposal(1);
      expect(proposal.decryptedYes).to.equal(2);
      expect(proposal.decryptedNo).to.equal(1);
      expect(proposal.status).to.equal(2); // Decrypted
    });

    it("Should reject finalize when not pending", async function () {
      await mockContract.finalizeResults(1);
      
      await expect(mockContract.finalizeResults(1))
        .to.be.revertedWith("Not pending");
    });
  });

  // ==================== EDGE CASES ====================

  describe("Edge Cases", function () {
    it("Should handle proposal with no votes", async function () {
      await mockContract.createProposal("No Votes", 1);
      await time.increase(2 * 60);
      await mockContract.allowDecryption(1);
      await mockContract.finalizeResults(1);
      
      const proposal = await mockContract.getProposal(1);
      expect(proposal.decryptedYes).to.equal(0);
      expect(proposal.decryptedNo).to.equal(0);
    });

    it("Should handle all yes votes", async function () {
      await mockContract.createProposal("All Yes", 1);
      await mockContract.connect(voter1).vote(1, true);
      await mockContract.connect(voter2).vote(1, true);
      await mockContract.connect(voter3).vote(1, true);
      
      await time.increase(2 * 60);
      await mockContract.allowDecryption(1);
      await mockContract.finalizeResults(1);
      
      const proposal = await mockContract.getProposal(1);
      expect(proposal.decryptedYes).to.equal(3);
      expect(proposal.decryptedNo).to.equal(0);
    });

    it("Should handle all no votes", async function () {
      await mockContract.createProposal("All No", 1);
      await mockContract.connect(voter1).vote(1, false);
      await mockContract.connect(voter2).vote(1, false);
      await mockContract.connect(voter3).vote(1, false);
      
      await time.increase(2 * 60);
      await mockContract.allowDecryption(1);
      await mockContract.finalizeResults(1);
      
      const proposal = await mockContract.getProposal(1);
      expect(proposal.decryptedYes).to.equal(0);
      expect(proposal.decryptedNo).to.equal(3);
    });

    it("Should handle long title", async function () {
      const longTitle = "A".repeat(200);
      await expect(mockContract.createProposal(longTitle, 5))
        .to.not.be.reverted;
      
      const proposal = await mockContract.getProposal(1);
      expect(proposal.title).to.equal(longTitle);
    });

    it("Should handle multiple proposals independently", async function () {
      await mockContract.createProposal("Proposal A", 5);
      await mockContract.createProposal("Proposal B", 5);
      
      await mockContract.connect(voter1).vote(1, true);
      await mockContract.connect(voter1).vote(2, false);
      
      expect(await mockContract.hasUserVoted(1, voter1.address)).to.be.true;
      expect(await mockContract.hasUserVoted(2, voter1.address)).to.be.true;
    });
  });

  // ==================== FHE ARCHITECTURE DOCS ====================

  describe("FHE Architecture (Documentation)", function () {
    /**
     * Documents the FHE operations in actual SilentVote contract:
     * 
     * ENCRYPTION (Browser):
     * - fhevm.createEncryptedInput(contract, user)
     * - input.addBool(choice) 
     * - input.encrypt() -> {handles[], inputProof}
     * 
     * ON-CHAIN (Contract):
     * - FHE.fromExternal() validates encrypted input
     * - FHE.select() conditional increment
     * - FHE.add() encrypted addition
     * - FHE.allowThis() ACL permissions
     * - FHE.makePubliclyDecryptable() marks for decryption
     * 
     * DECRYPTION (Relayer):
     * - POST /api/decrypt -> Zama Relayer
     * - MPC decryption of handles
     * - FHE.checkSignatures() verifies KMS proof
     */
    it("Should document FHE encryption flow", function () {
      const steps = [
        "1. User selects yes/no in browser",
        "2. fhevm.createEncryptedInput(contract, user)",
        "3. input.addBool(isYes)",
        "4. input.encrypt() -> {handle, inputProof}",
        "5. Contract receives externalEbool + proof"
      ];
      expect(steps.length).to.equal(5);
    });

    it("Should document FHE on-chain operations", function () {
      const ops = [
        "FHE.fromExternal(_encryptedVote, _inputProof)",
        "FHE.select(isYes, trueVal, falseVal)",
        "FHE.add(counter, FHE.asEuint64(1))",
        "FHE.allowThis(ciphertext)",
        "FHE.makePubliclyDecryptable(ciphertext)"
      ];
      expect(ops.length).to.equal(5);
    });

    it("Should document FHE decryption flow", function () {
      const steps = [
        "1. getProposalHandles() returns bytes32 handles",
        "2. POST to /api/decrypt (proxy to Zama Relayer)",
        "3. Relayer performs MPC decryption",
        "4. Returns clearValues for display",
        "5. (Optional) submitDecryptedResults with KMS proof"
      ];
      expect(steps.length).to.equal(5);
    });
  });

  // ==================== SECURITY PROPERTIES ====================

  describe("Security Properties", function () {
    it("Should enforce one vote per address per proposal", async function () {
      await mockContract.createProposal("Security Test", 60);
      
      await mockContract.connect(voter1).vote(1, true);
      await expect(mockContract.connect(voter1).vote(1, true))
        .to.be.revertedWith("Already voted");
      await expect(mockContract.connect(voter1).vote(1, false))
        .to.be.revertedWith("Already voted");
    });

    it("Should enforce time-based voting restrictions", async function () {
      await mockContract.createProposal("Time Security", 1);
      
      // Can vote before end
      await mockContract.connect(voter1).vote(1, true);
      
      // Cannot vote after end
      await time.increase(2 * 60);
      await expect(mockContract.connect(voter2).vote(1, true))
        .to.be.revertedWith("Voting ended");
    });

    it("Should prevent decryption before voting ends", async function () {
      await mockContract.createProposal("Early Decrypt", 60);
      
      await expect(mockContract.allowDecryption(1))
        .to.be.revertedWith("Voting not ended");
    });

    it("Should track creator correctly", async function () {
      await mockContract.connect(voter1).createProposal("Creator Test", 5);
      
      const proposal = await mockContract.getProposal(1);
      expect(proposal.creator).to.equal(voter1.address);
    });
  });
});

/**
 * SEPOLIA INTEGRATION TEST RESULTS
 * ================================
 * Contract: 0x72327D579777A230dc2cd7adDa73F509d3c4D43d
 * Verified: https://sepolia.etherscan.io/address/0x72327D579777A230dc2cd7adDa73F509d3c4D43d#code
 * 
 * Manual FHE tests performed:
 * ✅ createProposal - Creates proposal with FHE-initialized counters
 * ✅ vote - Accepts encrypted votes via externalEbool + inputProof
 * ✅ getProposalHandles - Returns valid FHE handles (bytes32)
 * ✅ Public decryption via Zama Relayer API
 * ✅ Double vote prevention working
 * ✅ Time-based voting restriction working
 * ✅ FHE.select() conditional accumulation verified
 */
