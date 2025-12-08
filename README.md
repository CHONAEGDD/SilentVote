# SilentVote

On-chain voting with encrypted ballots — your choice stays private, only results are revealed.

## FHEVM

Traditional on-chain voting exposes individual choices, enabling vote buying, coercion, and social pressure. SilentVote solves this:

- **Votes are encrypted** in the browser before submission
- **Computation happens on ciphertext** - the chain never sees plaintext
- **Only aggregate results** are decrypted after voting ends
- **Individual choices remain private** forever

## Features

- Create proposals with custom duration (1 min to 30 days)
- Encrypted voting using `@zama-fhe/relayer-sdk`
- Real-time countdown and status updates
- One-click result decryption via Zama Relayer
- Vote history tracking

## Contract

**Sepolia**: [`0x5B3101d2BE98651D7aD1641A65d433d2256f75e1`](https://sepolia.etherscan.io/address/0x5B3101d2BE98651D7aD1641A65d433d2256f75e1#code)

## Tech Stack

- **Frontend**: Next.js 14, RainbowKit, wagmi, TailwindCSS
- **Contracts**: Solidity 0.8.24, Zama FHEVM v0.9
- **Network**: Ethereum Sepolia

## Quick Start

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Contracts

```bash
cd contracts
npm install
npm test     # Run tests
npm run deploy
```

## Tests

Test strategy uses a Mock contract for business logic validation (local), with FHE operations tested on Sepolia.

```bash
npm test
```

```
  SilentVote
    Contract Interface
      ✔ Should have correct function signatures
      ✔ Should have correct event signatures
    Proposal Creation
      ✔ Should create proposal with valid parameters
      ✔ Should emit ProposalCreated event
      ✔ Should reject empty title
      ✔ Should reject duration < 1 minute
      ✔ Should reject duration > 30 days (43200 minutes)
      ✔ Should accept minimum duration (1 minute)
      ✔ Should accept maximum duration (30 days)
      ✔ Should increment proposalCount correctly
      ✔ Should set correct end time
    Voting
      ✔ Should allow voting on active proposal
      ✔ Should track hasVoted correctly
      ✔ Should prevent double voting
      ✔ Should reject voting on non-existent proposal
      ✔ Should reject voting after end time
      ✔ Should allow multiple users to vote
      ✔ Should correctly check isVotingActive
    Decryption Flow
      ✔ Should reject allowDecryption before voting ends
      ✔ Should allow decryption after voting ends
      ✔ Should update status to PendingDecryption
      ✔ Should reject allowDecryption on non-existent proposal
      ✔ Should reject double allowDecryption
    Result Finalization
      ✔ Should finalize results correctly
      ✔ Should update decrypted values
      ✔ Should reject finalize when not pending
    Edge Cases
      ✔ Should handle proposal with no votes
      ✔ Should handle all yes votes
      ✔ Should handle all no votes
      ✔ Should handle long title
      ✔ Should handle multiple proposals independently
    FHE Architecture (Documentation)
      ✔ Should document FHE encryption flow
      ✔ Should document FHE on-chain operations
      ✔ Should document FHE decryption flow
    Security Properties
      ✔ Should enforce one vote per address per proposal
      ✔ Should enforce time-based voting restrictions
      ✔ Should prevent decryption before voting ends
      ✔ Should track creator correctly

  38 passing (594ms)
```

### Test Coverage

| Category | Tests | Coverage |
|----------|-------|----------|
| Contract Interface | 2 | Function/event signatures |
| Proposal Creation | 9 | Parameters, bounds, events |
| Voting | 7 | State, double-vote, time |
| Decryption Flow | 5 | Status transitions |
| Result Finalization | 3 | Final state verification |
| Edge Cases | 5 | Boundaries, multi-proposal |
| FHE Architecture | 3 | Documentation |
| Security Properties | 4 | Access control |

### Sepolia Integration Tests

Manual FHE tests on deployed contract:

- ✅ `createProposal` - FHE-initialized counters
- ✅ `vote` - Encrypted votes via `externalEbool` + `inputProof`
- ✅ `getProposalHandles` - Valid FHE handles (bytes32)
- ✅ Public decryption via Zama Relayer API
- ✅ Double vote prevention
- ✅ Time-based voting restriction
- ✅ `FHE.select()` conditional accumulation

## License

MIT
