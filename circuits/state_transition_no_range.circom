pragma circom 2.1.0;

include "./merkle_components.circom";
include "circomlib/circuits/bitify.circom";

// One-account state update (NOT an authorized transaction).
// Public: oldRoot, newRoot, amount.
// Private: account data and an 8-level Merkle authentication path.
// Semantics: change exactly one leaf from (pk, oldBalance, oldNonce)
//            to (pk, newBalance, newNonce), keeping the same siblings/path.
//            oldBalance = newBalance + amount, newNonce = oldNonce + 1.
// Range bounds prevent modular wraparound of balance/nonce arithmetic.
template SingleAccountStateTransition(depth) {
    signal input oldRoot;
    signal input newRoot;
    signal input amount;

    signal input pubkeyHash;
    signal input oldBalance;
    signal input newBalance;
    signal input oldNonce;
    signal input newNonce;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    // Public and private numerical values are unsigned, with fixed widths.
    component oldBalBits = Num2Bits(64);
    
    component amountBits = Num2Bits(64);
    component oldNonceBits = Num2Bits(32);
    component newNonceBits = Num2Bits(32);

    oldBalBits.in <== oldBalance;
    
    amountBits.in <== amount;
    oldNonceBits.in <== oldNonce;
    newNonceBits.in <== newNonce;

    // No underflow: newBalance and amount are each 64-bit;
    // their sum (<2^65) cannot wrap modulo the BN254 scalar field.
    oldBalance === newBalance + amount;
    // Overflow is disallowed because newNonce is constrained to 32 bits.
    newNonce === oldNonce + 1;

    component oldLeaf = AccountLeaf();
    oldLeaf.pubkeyHash <== pubkeyHash;
    oldLeaf.balance <== oldBalance;
    oldLeaf.nonce <== oldNonce;

    component newLeaf = AccountLeaf();
    newLeaf.pubkeyHash <== pubkeyHash;
    newLeaf.balance <== newBalance;
    newLeaf.nonce <== newNonce;

    component oldProof = MerkleTreeInclusionProof(depth);
    component newProof = MerkleTreeInclusionProof(depth);
    oldProof.leaf <== oldLeaf.leaf;
    newProof.leaf <== newLeaf.leaf;

    for (var i = 0; i < depth; i++) {
        oldProof.pathElements[i] <== pathElements[i];
        oldProof.pathIndices[i] <== pathIndices[i];
        newProof.pathElements[i] <== pathElements[i];
        newProof.pathIndices[i] <== pathIndices[i];
    }

    oldRoot === oldProof.root;
    newRoot === newProof.root;
}

component main {public [oldRoot, newRoot, amount]} = SingleAccountStateTransition(8);
