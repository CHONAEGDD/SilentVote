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

```bash
cd contracts && npm test
```

**9 passing** — Interface validation + FHE architecture docs. Full FHE flow tested on Sepolia.

| Category | Tests |
|----------|-------|
| Contract Interface | 3 |
| FHE Architecture | 4 |
| Privacy Guarantees | 2 |

### Sepolia Integration

- ✅ Encrypted voting via `externalEbool` + `inputProof`
- ✅ `FHE.select()` conditional accumulation
- ✅ Public decryption via Zama Relayer API
- ✅ Double vote prevention & time restrictions

## License

MIT
