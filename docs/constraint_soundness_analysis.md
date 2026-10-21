
# Constraint Soundness Analysis
## Reproducing all three mutation experiments

From a clean checkout, install Circom 2.1.9 and Node.js/npm. Run:

```bash
npm ci
npm test
```

This command compiles the baseline and three deliberately weakened circuits and then runs the 12 ordinary fixture tests plus three side-by-side mutation checks. Each mutation check uses **the same malicious input** for both variants: the original must reject it with a witness-calculation assertion, while the weakened circuit must generate a witness that passes `snarkjs wtns check` against its R1CS. See [the CI workflow](../.github/workflows/ci.yml) and its GitHub Actions logs for an externally reproducible clean run.

The result illustrates the importance of the removed checks; it is not a formal proof of general soundness and does not show a flaw in the original circuit.



## R1CS-level reasoning and its limits

The test suite is a **differential regression test**: with identical JSON inputs,
the original witness calculator rejects a fixture, whereas a deliberately
weakened circuit produces a witness that satisfies its compiled R1CS. A
witness-calculator assertion alone is **not** a proof that the original R1CS
has no other satisfying witness. The observations below identify the actual
algebraic constraints and distinguish fixed-witness contradictions from
cryptographic assumptions needed when only public inputs are fixed.

**Range constraints.** In the intended Circom encoding,
`Num2Bits(k)` introduces Boolean wires `b_i` with
`b_i(b_i-1)=0` and reconstructs the signal as
`x = sum_{i=0}^{k-1} 2^i b_i` in the BN254 scalar field `F_p`.
Since `2^65 < p`, the 32- and 64-bit represented values, and
the sum of two 64-bit values, agree with ordinary nonnegative
integer arithmetic; the relevant equations cannot silently wrap
modulo `p`.

1. **Balance underflow:** In the counterexample the fixed account opening
   has `oldBalance=500` and public `amount=501`. The baseline
   imposes `oldBalance = newBalance + amount` and
   `0 <= newBalance < 2^64`. Thus for this fixed opening the
   required integer equation would be `500 = newBalance + 501`,
   which has no nonnegative solution. The mutant permits
   `newBalance=p-1`, satisfying the field equation modulo `p`.
2. **Nonce overflow:** With the counterexample's fixed account opening,
   `oldNonce=2^32-1`. Baseline constraints impose both
   `newNonce=oldNonce+1` and `0 <= newNonce < 2^32`.
   The only integer continuation is `2^32`, which the baseline
   disallows; the mutant lacking the `newNonce` range check
   accepts it. **This is an integer-range invariant violation,
   not a demonstrated replay attack**: the current prototype has
   no authorization/signature mechanism.
3. **New-root binding:** For the counterexample's fixed leaf and
   authentication path, `newProof.root` is a deterministic field
   value, different from the supplied public `newRoot=0`.
   The baseline R1CS includes `newRoot - newProof.root = 0`,
   so that *fixed opening* cannot satisfy the equation. The mutant
   removes the equality, allowing that public root to be unrelated
   to its privately computed updated root.

**Scope of the argument.** These are algebraic contradictions **for
the displayed account openings and Merkle paths**. In the implemented
statement only `oldRoot`, `newRoot`, and `amount` are public; account
fields and path are private. Therefore, showing that *no other private
witness* can satisfy the original circuit for the same public tuple
is a stronger claim, **not** established by the calculator failures or
the preceding fixed-opening algebra. Treating the roots as binding
commitments to their intended openings requires cryptographic
assumptions (e.g. collision/second-preimage resistance of the
Poseidon-based Merkle construction) and reasoning about feasible
adversaries; it does not turn the tests into an unconditional
unsatisfiability certificate or a formal proof of protocol soundness.

## Experiment 1: Modular Underflow

### Objective

Demonstrate why the 64-bit range constraint on
`newBalance` is necessary for the intended
unsigned-integer semantics.

### Mutation

Original circuit:

```circom
component newBalBits = Num2Bits(64);
newBalBits.in <== newBalance;
```

Experimental circuit:
Both lines are removed.

The modified circuit is saved as
`circuits/state_transition_no_range.circom`.

This experimental circuit is intentionally unsafe.

### Counterexample

Let p be the BN254 scalar-field modulus.

- oldBalance = 500
- amount = 501
- newBalance = p - 1

In F_p:

500 = (p - 1) + 501 (mod p).

However, p - 1 exceeds the maximum unsigned
64-bit integer.

The witness therefore satisfies the field
equation but violates the intended balance
semantics.

### Experimental Results

Original circuit:
- 4,720 nonlinear constraints
- 5,073 linear constraints
- Underflow test rejected

Modified circuit:
- 4,656 nonlinear constraints
- 5,072 linear constraints
- Underflow witness accepted
- snarkJS: WITNESS IS CORRECT

The mutation removes 65 R1CS constraints.

### Conclusion

Removing the new-balance range constraint admits
a witness representing an invalid unsigned
64-bit balance transition.

This is a controlled mutation experiment,
not a vulnerability in the original circuit.

The experiment demonstrates the necessity
of range constraints when implementing integer
arithmetic over finite fields.

## Experiment 2: Nonce Range Constraint

### Objective

Demonstrate why the 32-bit range constraint on
`newNonce` is necessary for the intended
nonce-update semantics.

### Mutation

Removed the following statements from
`state_transition.circom`:

```circom
component newNonceBits = Num2Bits(32);
newNonceBits.in <== newNonce;
```

The modified circuit is stored in
`circuits/state_transition_no_nonce_range.circom`.

### Counterexample

Let:

- oldNonce = 4294967295 = 2^32 - 1
- newNonce = 4294967296 = 2^32

The field equation

newNonce = oldNonce + 1

is satisfied, but newNonce exceeds the maximum
unsigned 32-bit integer.

The corresponding Poseidon-based Merkle roots
were generated using the Rust test generator. The committed fixture is
`tests/mutations/nonce_overflow/nonce_overflow_counterexample.json`,
recreated by running `cargo run --release --manifest-path rust/testgen/Cargo.toml --bin nonce_overflow_input`.

### Experimental Results

Original circuit:
- 9,793 R1CS constraints
- Witness generation rejected with Assert Failed
- Failure occurred in Num2Bits

Modified circuit:
- 9,760 R1CS constraints
- 33 fewer constraints
- Witness generated successfully
- snarkJS reported WITNESS IS CORRECT

### Conclusion

Removing the newNonce range constraint permits
a witness that violates the intended unsigned
32-bit nonce semantics while satisfying the
modified R1CS.

This is a controlled mutation experiment,
not a vulnerability in the original circuit. It establishes a violated
32-bit integer-range invariant; because the prototype does not authenticate
state updates, it is not evidence of a replay attack.


## Experiment 3: New Merkle Root Binding

### Objective

Demonstrate that the public newRoot must be
constrained to equal the Merkle root computed
from the updated account state.

### Mutation

Removed the following constraint:

    newRoot === newProof.root;

Experimental circuit:
`circuits/state_transition_no_new_root_check.circom`

### Counterexample

Input fixture:
`tests/inputs/state_transition_invalid_new_root.json`

The fixture supplies an invalid public newRoot
while retaining the other state-transition inputs.

In the original circuit, the public newRoot must
equal the root reconstructed from the updated leaf
and the Merkle authentication path.

In the mutated circuit, this equality is absent.

### Experimental Results

Original circuit:
- Invalid newRoot rejected (existing negative test).

Modified circuit:
- Compilation succeeded.
- 9,793 R1CS constraints.
- Witness generation succeeded.
- snarkJS reported WITNESS IS CORRECT.

The total R1CS constraint count is unchanged
after compilation; this does not establish
equivalence between the two circuits.

### Conclusion

Removing the new-root equality allows a
satisfying witness with a public newRoot
that does not represent the computed updated state.

This demonstrates that the binding between
the public commitment and the constrained state
transition is essential.

The experiment is a controlled mutation, not
a vulnerability in the original circuit.

It does not establish general circuit soundness
or cryptographic proof-system soundness.
