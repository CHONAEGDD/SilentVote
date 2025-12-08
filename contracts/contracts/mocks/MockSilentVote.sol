// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockSilentVote
 * @notice Mock contract for testing non-FHE business logic
 * @dev Simulates SilentVote without FHE dependencies for local testing
 */
contract MockSilentVote {
    
    enum ProposalStatus {
        Active,
        PendingDecryption,
        Decrypted
    }

    struct Proposal {
        string title;
        address creator;
        uint256 endTime;
        uint256 yesVotes;  // Plain uint for testing
        uint256 noVotes;
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
    event DecryptionReady(uint256 indexed proposalId);
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

        proposals[proposalId] = Proposal({
            title: _title,
            creator: msg.sender,
            endTime: block.timestamp + (_durationMinutes * 1 minutes),
            yesVotes: 0,
            noVotes: 0,
            status: ProposalStatus.Active,
            decryptedYes: 0,
            decryptedNo: 0
        });

        emit ProposalCreated(proposalId, _title, msg.sender, proposals[proposalId].endTime);
        return proposalId;
    }

    /**
     * @notice Cast a vote (mock version - accepts plain bool)
     */
    function vote(uint256 _proposalId, bool _isYes) external {
        Proposal storage proposal = proposals[_proposalId];
        
        require(proposal.creator != address(0), "Proposal not found");
        require(proposal.status == ProposalStatus.Active, "Proposal not active");
        require(block.timestamp < proposal.endTime, "Voting ended");
        require(!hasVoted[_proposalId][msg.sender], "Already voted");

        if (_isYes) {
            proposal.yesVotes++;
        } else {
            proposal.noVotes++;
        }

        hasVoted[_proposalId][msg.sender] = true;
        emit VoteCast(_proposalId, msg.sender);
    }

    /**
     * @notice Allow decryption after voting ends
     */
    function allowDecryption(uint256 _proposalId) external {
        Proposal storage proposal = proposals[_proposalId];
        
        require(proposal.creator != address(0), "Proposal not found");
        require(proposal.status == ProposalStatus.Active, "Not active");
        require(block.timestamp >= proposal.endTime, "Voting not ended");

        proposal.status = ProposalStatus.PendingDecryption;
        emit DecryptionReady(_proposalId);
    }

    /**
     * @notice Finalize results (mock - just copies values)
     */
    function finalizeResults(uint256 _proposalId) external {
        Proposal storage proposal = proposals[_proposalId];
        
        require(proposal.status == ProposalStatus.PendingDecryption, "Not pending");

        proposal.decryptedYes = uint64(proposal.yesVotes);
        proposal.decryptedNo = uint64(proposal.noVotes);
        proposal.status = ProposalStatus.Decrypted;

        emit ResultsDecrypted(_proposalId, proposal.decryptedYes, proposal.decryptedNo);
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
