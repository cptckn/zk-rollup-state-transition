
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
