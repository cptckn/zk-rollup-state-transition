
# Constraint Soundness Analysis

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
were generated using the Rust test generator.

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
not a vulnerability in the original circuit.


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
