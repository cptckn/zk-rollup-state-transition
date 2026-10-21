# ZK-Rollup State-Transition Circuit

[![Circom circuit and mutation tests](https://github.com/cptckn/zk-rollup-state-transition/actions/workflows/ci.yml/badge.svg)](https://github.com/cptckn/zk-rollup-state-transition/actions/workflows/ci.yml)

A Circom 2 implementation of a **single-account state-update consistency relation** over the BN254 scalar field, with Rust fixture generation, R1CS witness tests, and controlled constraint-mutation experiments.

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
| `tests/run-mutation-tests.cjs` | Three original-versus-mutant witness comparisons |
| `scripts/build-circuits.cjs` | Compiles baseline and mutated circuits |
| `.github/workflows/ci.yml` | Clean Linux build on pushes and pull requests |
| `docs/state_transition_design.md` | Exact mathematical statement and limitations |
| `docs/constraint_soundness_analysis.md` | Reasoning-based audit and security assumptions |

## Reproduce the 12 baseline tests and 3 mutation experiments

Prerequisites: **Circom 2.1+**, **Node.js/npm**, and optionally **Rust/Cargo** to regenerate the committed input fixtures. From the repository root:

```bash
npm ci
npm test
```

The `npm test` script compiles two baseline and three deliberately weakened circuits, runs 4 Merkle + 8 state-transition tests, and then verifies the three mutation experiments. On PowerShell, use `npm.cmd` if required by execution policy.

The two test runners check **4 Merkle** and **8 state-transition** positive/negative fixtures. Recreate the state-transition fixtures using:

```bash
cargo run --release --manifest-path rust/testgen/Cargo.toml --bin state_transition_input
# Optional: regenerate the 32-bit nonce-overflow counterexample
cargo run --release --manifest-path rust/testgen/Cargo.toml --bin nonce_overflow_input
```

## Reproducing the controlled mutation experiments

The intentionally insecure circuits `circuits/state_transition_no_*.circom` and their counterexample fixtures are checked side-by-side against the original implementation. Run the entire suite with `npm test`, or after `npm run build:circom` run `npm run test:mutations` separately.

| Experiment | Counterexample | Baseline | Mutated circuit |
| --- | --- | --- | --- |
| Unsigned-balance underflow | `tests/inputs/state_transition_invalid_underflow.json` (`newBalance=p-1`) | Reject | Accept without `newBalance` range check |
| 32-bit nonce overflow | `tests/mutations/nonce_overflow/nonce_overflow_counterexample.json` (`newNonce=2^32`) | Reject | Accept without `newNonce` range check |
| Incorrect public new root | `tests/inputs/state_transition_invalid_new_root.json` | Reject | Accept without `newRoot === newProof.root` |

Each test requires the *same* input to be rejected by the original witness calculator, then accepted by the mutant with `snarkjs wtns check` reporting a correct witness for that mutant's R1CS. The [constraint audit](docs/constraint_soundness_analysis.md#r1cs-level-reasoning-and-its-limits) separately explains the range and root-binding equations at the R1CS level, distinguishing fixed-fixture contradictions from claims about *all* possible private witnesses. These tests do **not** establish a formal soundness proof.

The clean Linux build is configured in [GitHub Actions](.github/workflows/ci.yml). A successful CI run, rather than merely the existence of test scripts, provides evidence that a fresh checkout builds and passes the suite.

## Security research and limitations

The source demonstrates why range checks, Merkle-root binding, and nonce consistency matter. The 12 baseline fixtures and three controlled constraint-removal experiments are separate checks. The mutation tests compare the original circuit with deliberately weakened variants; they do not imply a flaw in the original.

Passing R1CS witness tests is **not** a formal soundness proof. In particular, the circuit currently lacks: (1) account-owner authorization/signatures, (2) recipient-side changes and conservation across accounts, (3) a trusted on-chain root binding, and (4) Groth16 proof generation and verification. Its intended purpose is to study the **correctness of a narrowly specified arithmetic/Merkle relation**, not to protect assets.

See the [design specification](docs/state_transition_design.md) and [constraint audit](docs/constraint_soundness_analysis.md) for details.

## License

This repository is licensed under the [MIT License](LICENSE).
