// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint64, ebool, externalEuint64 } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title SilentVote
 * @notice Privacy-preserving voting contract using FHE
 * @dev Votes are encrypted and only revealed after voting ends
 */
contract SilentVote is SepoliaConfig {
    
    enum ProposalStatus {
        Active,
        DecryptionInProgress,
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
    
    // Decryption request tracking
    mapping(uint256 => uint256) private requestToProposal;

    // Events
    event ProposalCreated(uint256 indexed proposalId, string title, address creator, uint256 endTime);
    event VoteCast(uint256 indexed proposalId, address voter);
    event DecryptionRequested(uint256 indexed proposalId);
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
     * @param _encryptedChoice Encrypted vote (1 for yes, 0 for no)
     * @param _inputProof Proof for the encrypted input
     */
    function vote(
        uint256 _proposalId,
        externalEuint64 _encryptedChoice,
        bytes calldata _inputProof
    ) external {
        Proposal storage proposal = proposals[_proposalId];
        
        require(proposal.status == ProposalStatus.Active, "Proposal not active");
        require(block.timestamp < proposal.endTime, "Voting ended");
        require(!hasVoted[_proposalId][msg.sender], "Already voted");

        // Convert external encrypted input to euint64
        euint64 choice = FHE.fromExternal(_encryptedChoice, _inputProof);
        
        // Determine if yes vote (choice > 0)
        ebool isYesVote = FHE.gt(choice, FHE.asEuint64(0));
        
        // Conditionally increment yes or no votes
        proposal.yesVotes = FHE.select(isYesVote, FHE.add(proposal.yesVotes, FHE.asEuint64(1)), proposal.yesVotes);
        proposal.noVotes = FHE.select(isYesVote, proposal.noVotes, FHE.add(proposal.noVotes, FHE.asEuint64(1)));
        
        FHE.allowThis(proposal.yesVotes);
        FHE.allowThis(proposal.noVotes);

        hasVoted[_proposalId][msg.sender] = true;

        emit VoteCast(_proposalId, msg.sender);
    }

    /**
     * @notice Request decryption of results after voting ends
     * @param _proposalId The proposal to decrypt
     */
    function requestDecryption(uint256 _proposalId) external {
        Proposal storage proposal = proposals[_proposalId];
        
        require(proposal.status == ProposalStatus.Active, "Not active");
        require(block.timestamp >= proposal.endTime, "Voting not ended");

        proposal.status = ProposalStatus.DecryptionInProgress;

        // Request decryption for both vote counts
        bytes32[] memory cts = new bytes32[](2);
        cts[0] = FHE.toBytes32(proposal.yesVotes);
        cts[1] = FHE.toBytes32(proposal.noVotes);

        uint256 requestId = FHE.requestDecryption(cts, this.decryptionCallback.selector);
        requestToProposal[requestId] = _proposalId;

        emit DecryptionRequested(_proposalId);
    }

    /**
     * @notice Callback function for decryption results
     */
    function decryptionCallback(
        uint256 requestId,
        uint64 decryptedYes,
        uint64 decryptedNo,
        bytes[] memory signatures
    ) external {
        FHE.checkSignatures(requestId, signatures);
        
        uint256 proposalId = requestToProposal[requestId];
        Proposal storage proposal = proposals[proposalId];

        proposal.decryptedYes = decryptedYes;
        proposal.decryptedNo = decryptedNo;
        proposal.status = ProposalStatus.Decrypted;

        emit ResultsDecrypted(proposalId, decryptedYes, decryptedNo);
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

    function hasUserVoted(uint256 _proposalId, address _user) external view returns (bool) {
        return hasVoted[_proposalId][_user];
    }

    function isVotingActive(uint256 _proposalId) external view returns (bool) {
        Proposal storage p = proposals[_proposalId];
        return p.status == ProposalStatus.Active && block.timestamp < p.endTime;
    }
}
