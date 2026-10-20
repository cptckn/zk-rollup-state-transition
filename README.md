# ZK-Rollup State-Transition Circuit

A Circom 2 implementation of a **single-account state-update consistency relation** over the BN254 scalar field, with Rust fixture generation, R1CS witness tests, and an accompanying constraint analysis.

**Scope:** This is an educational research prototype, **not** a secure, deployable rollup or an authorized transaction system. In particular, it does not verify signatures or generate/verify SNARK proofs.

## Implemented relation

For a public tuple `(oldRoot, newRoot, amount)`, the circuit witnesses a private account and Merkle authentication path such that:

- `oldLeaf = Poseidon(pubkeyHash, oldBalance, oldNonce)` and `oldRoot` matches the corresponding 8-level Poseidon Merkle root.
- `newLeaf = Poseidon(pubkeyHash, newBalance, newNonce)` and `newRoot` matches the updated leaf on the **same** path.
- `oldBalance = newBalance + amount` and `newNonce = oldNonce + 1`.
- Both balances and `amount` are 64-bit unsigned integers; both nonces are 32-bit unsigned integers; Merkle selectors are binary.

The bounds prevent unintended modular wraparound in balance/nonce arithmetic. This is **not** a two-account transfer: there is no recipient or transaction authorization, and the old root must be trusted by the surrounding system.

## Components

| Location | Purpose |
| --- | --- |
| `circuits/merkle_components.circom` | Poseidon account leaf and Merkle inclusion templates |
| `circuits/merkle_tree.circom` | Account-inclusion circuit |
| `circuits/state_transition.circom` | Single-account consistency circuit |
| `rust/testgen/` | Rust Poseidon reference and test fixture generator |
| `tests/inputs/` | Valid and adversarial witness fixtures |
| `tests/run-merkle-tests.cjs` | Four Merkle membership tests |
| `tests/run-state-transition-tests.cjs` | Eight state-transition tests |
| `docs/state_transition_design.md` | Exact mathematical statement and limitations |
| `docs/constraint_soundness_analysis.md` | Reasoning-based audit and security assumptions |

## Reproduce the tests

Prerequisites: **Circom 2.1+**, **Node.js/npm**, and optionally **Rust/Cargo** to regenerate the committed input fixtures. From the repository root:

```bash
npm ci
mkdir -p build
circom circuits/merkle_tree.circom --r1cs --wasm --sym -l node_modules -o build
circom circuits/state_transition.circom --r1cs --wasm --sym -l node_modules -o build
npm test
```

PowerShell: use `New-Item -ItemType Directory -Force build | Out-Null` instead of `mkdir -p build`, and `npm.cmd` if required by PowerShell execution policy.

The two test runners check **4 Merkle** and **8 state-transition** positive/negative fixtures. Recreate the state-transition fixtures using:

```bash
cargo run --release --manifest-path rust/testgen/Cargo.toml --bin state_transition_input
```

## Security research and limitations

The source demonstrates why range checks, Merkle-root binding, and nonce consistency matter. Additional controlled constraint-removal experiments have been performed during development, but those mutations are **not included in the automated 12-fixture test suite**; their experimental results should not be confused with independently reproducible tests in this repository.

Passing R1CS witness tests is **not** a formal soundness proof. In particular, the circuit currently lacks: (1) account-owner authorization/signatures, (2) recipient-side changes and conservation across accounts, (3) a trusted on-chain root binding, and (4) Groth16 proof generation and verification. Its intended purpose is to study the **correctness of a narrowly specified arithmetic/Merkle relation**, not to protect assets.

See the [design specification](docs/state_transition_design.md) and [constraint audit](docs/constraint_soundness_analysis.md) for details.
