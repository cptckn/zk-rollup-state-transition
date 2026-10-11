# Single-account state transition — mathematical specification

This is an educational **consistency circuit**, not an authorized transaction or a complete rollup.

## Public statement

Public inputs: `oldRoot`, `newRoot`, `amount` (BN254 field elements).

Private witness: `pubkeyHash`, `oldBalance`, `newBalance`, `oldNonce`, `newNonce`, `pathElements[8]`, `pathIndices[8]`.

Define `leaf(pk,b,n) = Poseidon(pk,b,n)` and `MerkleRoot(leaf,P)` with the order determined by 8 binary path selectors.

A satisfying witness is required to obey:

- `oldRoot = MerkleRoot(leaf(pubkeyHash, oldBalance, oldNonce), P)`;
- `newRoot = MerkleRoot(leaf(pubkeyHash, newBalance, newNonce), P)`;
- `oldBalance = newBalance + amount`;
- `newNonce = oldNonce + 1`;
- `oldBalance`, `newBalance`, and `amount` are 64-bit unsigned integers;
- `oldNonce` and `newNonce` are 32-bit unsigned integers;
- every path selector is binary.

The 64-bit bounds avoid arithmetic wraparound: even the sum of two 64-bit integers is < 2^65, which is much smaller than the BN254 scalar-field modulus. The 32-bit nonce bound likewise prohibits wraparound and excludes incrementing the maximum representable nonce.

A *single-leaf replacement* can use the same sibling nodes on the path to the root, since the other leaves do not change.

## Important limitations

- **No authorization**: the account owner has not signed the update; any valid witness could induce a debit. Do not use this circuit to secure assets.
- **Not a two-account transfer**: there is no receiver, no conservation rule across accounts, and no batch consistency.
- **Not a complete security proof**: the test suite checks specific inputs; it does not establish formal soundness, Poseidon collision resistance, or SNARK soundness.
- **No account-key ownership binding**: `pubkeyHash` is a field identifier; no signature key relationship is checked.
- **No canonical system-level semantics**: only 64-bit balances and 32-bit nonces have ranges. The circuit makes no claims about external transaction formats or state availability.
- **No zero-knowledge proof yet**: witness computation and R1CS checking are not Groth16 proof generation.

## Reproducible test commands (PowerShell, repository root)

```powershell
# Make sure dependencies are installed (npm.cmd install).
circom circuits/merkle_tree.circom --r1cs --wasm --sym -l node_modules -o build
npm.cmd run test:merkle

circom circuits/state_transition.circom --r1cs --wasm --sym -l node_modules -o build
cargo run --release --manifest-path rust/testgen/Cargo.toml --bin state_transition_input
node tests/run-state-transition-tests.cjs
```

The generator creates **eight** fixtures: one valid case and seven negative cases. In particular, the underflow fixture sets `amount=501`, `newBalance=p-1` (the field representation of `-1`), and computes a matching `newRoot`. This deliberately preserves the field equation while violating the 64-bit range constraint.

Do not commit `build/`, `node_modules/`, or Rust `target/` directories.
