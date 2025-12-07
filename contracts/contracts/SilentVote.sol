// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint64, ebool, externalEbool } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title SilentVote
 * @notice Privacy-preserving voting contract using FHE
 * @dev Votes are encrypted and only revealed after voting ends
 */
contract SilentVote is ZamaEthereumConfig {
    
    enum ProposalStatus {
        Active,
        PendingDecryption,
        Decrypted
    }

    struct Proposal {
        string title;
        address creator;
        uint256 endTime;
        euint64 yesVotes;
        euint64 noVotes;
        ProposalStatus status;
        uint64 decryptedYes;
        uint64 decryptedNo;
    }

    // State
    uint256 public proposalCount;
    mapping(uint256 => Proposal) private proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    // Events
    event ProposalCreated(uint256 indexed proposalId, string title, address creator, uint256 endTime);
    event VoteCast(uint256 indexed proposalId, address voter);
    event DecryptionReady(uint256 indexed proposalId, bytes32 yesHandle, bytes32 noHandle);
    event ResultsDecrypted(uint256 indexed proposalId, uint64 yesVotes, uint64 noVotes);

    /**
     * @notice Create a new proposal
     * @param _title The proposal title
     * @param _durationMinutes Voting duration in minutes
     */
    function createProposal(string calldata _title, uint256 _durationMinutes) external returns (uint256) {
        require(bytes(_title).length > 0, "Empty title");
        require(_durationMinutes >= 1 && _durationMinutes <= 43200, "Invalid duration");

        proposalCount++;
        uint256 proposalId = proposalCount;

        // Initialize encrypted vote counters to 0
        euint64 zeroYes = FHE.asEuint64(0);
        euint64 zeroNo = FHE.asEuint64(0);
        
        FHE.allowThis(zeroYes);
        FHE.allowThis(zeroNo);

        proposals[proposalId] = Proposal({
            title: _title,
            creator: msg.sender,
            endTime: block.timestamp + (_durationMinutes * 1 minutes),
            yesVotes: zeroYes,
            noVotes: zeroNo,
            status: ProposalStatus.Active,
            decryptedYes: 0,
            decryptedNo: 0
        });

        emit ProposalCreated(proposalId, _title, msg.sender, proposals[proposalId].endTime);
        return proposalId;
    }

    /**
     * @notice Cast an encrypted vote
     * @param _proposalId The proposal to vote on
     * @param _encryptedVote Encrypted vote (true for yes, false for no)
     * @param _inputProof Proof for the encrypted input
     */
    function vote(
        uint256 _proposalId,
        externalEbool _encryptedVote,
        bytes calldata _inputProof
    ) external {
        Proposal storage proposal = proposals[_proposalId];
        
        require(proposal.status == ProposalStatus.Active, "Proposal not active");
        require(block.timestamp < proposal.endTime, "Voting ended");
        require(!hasVoted[_proposalId][msg.sender], "Already voted");

        // Convert external encrypted bool
        ebool isYesVote = FHE.fromExternal(_encryptedVote, _inputProof);
        
        // Conditionally increment yes or no votes
        proposal.yesVotes = FHE.select(isYesVote, FHE.add(proposal.yesVotes, FHE.asEuint64(1)), proposal.yesVotes);
        proposal.noVotes = FHE.select(isYesVote, proposal.noVotes, FHE.add(proposal.noVotes, FHE.asEuint64(1)));
        
        FHE.allowThis(proposal.yesVotes);
        FHE.allowThis(proposal.noVotes);
        
        // Pre-authorize public decryption - anyone can decrypt after voting ends
        FHE.makePubliclyDecryptable(proposal.yesVotes);
        FHE.makePubliclyDecryptable(proposal.noVotes);

        hasVoted[_proposalId][msg.sender] = true;

        emit VoteCast(_proposalId, msg.sender);
    }

    /**
     * @notice Allow decryption of results after voting ends
     * @param _proposalId The proposal to prepare for decryption
     */
    function allowDecryption(uint256 _proposalId) external {
        Proposal storage proposal = proposals[_proposalId];
        
        require(proposal.status == ProposalStatus.Active, "Not active");
        require(block.timestamp >= proposal.endTime, "Voting not ended");

        // Mark values as publicly decryptable
        FHE.makePubliclyDecryptable(proposal.yesVotes);
        FHE.makePubliclyDecryptable(proposal.noVotes);

        proposal.status = ProposalStatus.PendingDecryption;

        // Emit handles for frontend to request decryption
        emit DecryptionReady(
            _proposalId,
            FHE.toBytes32(proposal.yesVotes),
            FHE.toBytes32(proposal.noVotes)
        );
    }

    /**
     * @notice Submit decrypted results with proof
     * @param _proposalId The proposal ID
     * @param _decryptedYes Decrypted yes vote count
     * @param _decryptedNo Decrypted no vote count
     * @param _decryptionProof KMS proof for verification
     */
    function submitDecryptedResults(
        uint256 _proposalId,
        uint64 _decryptedYes,
        uint64 _decryptedNo,
        bytes calldata _decryptionProof
    ) external {
        Proposal storage proposal = proposals[_proposalId];
        
        require(proposal.status == ProposalStatus.PendingDecryption, "Not pending");

        // Prepare handles list for verification
        bytes32[] memory handlesList = new bytes32[](2);
        handlesList[0] = FHE.toBytes32(proposal.yesVotes);
        handlesList[1] = FHE.toBytes32(proposal.noVotes);

        // Encode cleartexts
        bytes memory abiEncodedCleartexts = abi.encode(_decryptedYes, _decryptedNo);

        // Verify KMS signatures
        FHE.checkSignatures(handlesList, abiEncodedCleartexts, _decryptionProof);

        // Store decrypted results
        proposal.decryptedYes = _decryptedYes;
        proposal.decryptedNo = _decryptedNo;
        proposal.status = ProposalStatus.Decrypted;

        emit ResultsDecrypted(_proposalId, _decryptedYes, _decryptedNo);
    }

    // View functions
    
    function getProposal(uint256 _proposalId) external view returns (
        string memory title,
        address creator,
        uint256 endTime,
        ProposalStatus status,
        uint64 decryptedYes,
        uint64 decryptedNo
    ) {
        Proposal storage p = proposals[_proposalId];
        return (
            p.title,
            p.creator,
            p.endTime,
            p.status,
            p.decryptedYes,
            p.decryptedNo
        );
    }

    function getProposalHandles(uint256 _proposalId) external view returns (
        bytes32 yesHandle,
        bytes32 noHandle
    ) {
        Proposal storage p = proposals[_proposalId];
        return (
            FHE.toBytes32(p.yesVotes),
            FHE.toBytes32(p.noVotes)
        );
    }

    function hasUserVoted(uint256 _proposalId, address _user) external view returns (bool) {
        return hasVoted[_proposalId][_user];
    }

    function isVotingActive(uint256 _proposalId) external view returns (bool) {
        Proposal storage p = proposals[_proposalId];
        return p.status == ProposalStatus.Active && block.timestamp < p.endTime;
    }
}
