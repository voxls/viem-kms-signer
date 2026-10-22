import * as asn1js from 'asn1js';
import { bytesToHex, getAddress, hexToBigInt, keccak256, toHex } from 'viem';

class InvalidSignatureError extends Error {
  constructor() {
    super('Invalid signature');
  }
}

class InvalidPublicKeyError extends Error {
  constructor() {
    super('Invalid public key');
  }
}

function parseSigFromBER(signature: Uint8Array) {
  const asn = asn1js.fromBER(signature);
  if (!(asn.result instanceof asn1js.Sequence)) {
    throw new InvalidSignatureError();
  }
  if (!(asn.result.valueBlock.value[0] instanceof asn1js.Integer)) {
    throw new InvalidSignatureError();
  }
  if (!(asn.result.valueBlock.value[1] instanceof asn1js.Integer)) {
    throw new InvalidSignatureError();
  }

  const r = asn.result.valueBlock.value[0].valueBlock.valueHexView;
  const s = asn.result.valueBlock.value[1].valueBlock.valueHexView;

  return { r: bytesToHex(r), s: bytesToHex(s) };
}

function findEthereumSig(signature: Uint8Array) {
  let { r, s } = parseSigFromBER(signature);

  const secp256k1N = BigInt(
    '0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141',
  ); // max value on the curve
  const secp256k1halfN = secp256k1N / BigInt(2); // half of the curve
  let sValue = hexToBigInt(s);
  // Because of EIP-2 not all elliptic curve signatures are accepted
  // the value of s needs to be SMALLER than half of the curve
  // i.e. we need to flip s if it's greater than half of the curve
  if (sValue > secp256k1halfN) {
    // According to EIP2 https://github.com/ethereum/EIPs/blob/master/EIPS/eip-2.md
    // if s < half the curve we need to invert it
    // s = curve.n - s
    sValue = secp256k1N - sValue;
    s = toHex(sValue);
  }
  // if s is less than half of the curve, we're on the "good" side of the curve, we can just return
  return { r, s };
}

function parseKeyFromBER(publicKey: Uint8Array): Uint8Array {
  const asn = asn1js.fromBER(publicKey);
  if (!(asn.result instanceof asn1js.Sequence)) {
    throw new InvalidPublicKeyError();
  }
  if (!(asn.result.valueBlock.value[1] instanceof asn1js.BitString)) {
    throw new InvalidPublicKeyError();
  }

  return asn.result.valueBlock.value[1].valueBlock.valueHexView;
}

function getEthereumAddress(publicKey: Uint8Array): `0x${string}` {
  // The public key is ASN1 encoded in a format according to
  // https://tools.ietf.org/html/rfc5480#section-2
  // I used https://lapo.it/asn1js to figure out how to parse this
  // and defined the schema in the EcdsaPubKey object
  let pubKey = parseKeyFromBER(publicKey);

  // The public key starts with a 0x04 prefix that needs to be removed
  // more info: https://www.oreilly.com/library/view/mastering-ethereum/9781491971932/ch04.html
  pubKey = pubKey.slice(1, pubKey.length);

  const hash = keccak256(pubKey, 'bytes'); // keccak256 hash of publicKey
  const EthAddr = bytesToHex(hash.slice(-20)); // take last 20 bytes as ethereum adress
  return getAddress(EthAddr);
}

export { findEthereumSig, getEthereumAddress };
