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

**Sepolia**: [`0x600474A6a1F28A69F97CE988e593b99b025cDF68`](https://sepolia.etherscan.io/address/0x600474A6a1F28A69F97CE988e593b99b025cDF68)

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

```bash
npm test
```

```
  SilentVote
    Contract Interface
      ✔ Should have correct function signatures
      ✔ Should have correct event signatures
      ✔ Should encode createProposal correctly
      ✔ Should encode vote correctly
    Input Validation (Static Analysis)
      ✔ Should have title length check in createProposal
      ✔ Should have duration bounds (1 min to 30 days)
    FHE Architecture
      ✔ Should document encryption flow
      ✔ Should document on-chain FHE operations
      ✔ Should document decryption flow
    Security Properties
      ✔ Should never expose plaintext votes
      ✔ Should prevent double voting

  11 passing
```

> Note: Full FHE operations (vote, decrypt) require Zama infrastructure and are tested on Sepolia.

## License

MIT
