import {
  GetPublicKeyCommand,
  KMSClient,
  type KMSClientConfig,
  SignCommand,
} from '@aws-sdk/client-kms';
import {
  type Hash,
  type HashTypedDataParameters,
  hashMessage,
  hashTypedData,
  hexToBytes,
  keccak256,
  type LocalAccount,
  type NonceManager,
  parseSignature,
  recoverAddress,
  serializeSignature,
  serializeTransaction,
} from 'viem';
import { type CustomSource, toAccount } from 'viem/accounts';

import { findEthereumSig, getEthereumAddress } from './asnutils.js';

export async function getKmsAccount(params: {
  keyId: string;
  region: string;
  credentials?: KMSClientConfig['credentials'];
  nonceManager?: NonceManager;
}): Promise<LocalAccount> {
  const { keyId, nonceManager, credentials, region } = params;
  const getPubKey = new GetPublicKeyCommand({
    KeyId: keyId,
  });

  const kms = new KMSClient({
    region,
    credentials,
  });

  const pubKey = await kms.send(getPubKey);
  if (!pubKey.PublicKey) {
    throw new Error('No public key');
  }

  const address = getEthereumAddress(pubKey.PublicKey);

  const getKmsSignature: (data: Hash) => Promise<Hash> = async (data) => {
    const command = new SignCommand({
      KeyId: keyId,
      Message: hexToBytes(data),
      MessageType: 'DIGEST',
      SigningAlgorithm: 'ECDSA_SHA_256',
    });
    const response = await kms.send(command);
    if (!response.Signature) {
      throw new Error('No signature');
    }

    const { r, s } = findEthereumSig(response.Signature);

    for (const v of [BigInt(27), BigInt(28)]) {
      const signature = serializeSignature({ r, s, v });

      const addr = await recoverAddress({
        hash: data,
        signature,
      });

      if (addr === address) {
        return signature;
      }
    }

    throw new Error('Could not recover address from signature');
  };

  const signMessage: CustomSource['signMessage'] = async ({ message }) => {
    const hash = hashMessage(message);
    return getKmsSignature(hash);
  };

  const signTransaction: CustomSource['signTransaction'] = async (
    transaction,
    args,
  ) => {
    const serializer = args?.serializer || serializeTransaction;
    const hash = keccak256(await serializer(transaction));
    const signature = await getKmsSignature(hash);
    return serializer(transaction, parseSignature(signature));
  };

  const signTypedData: CustomSource['signTypedData'] = async (typedData) => {
    const hash = hashTypedData(typedData as HashTypedDataParameters);

    return getKmsSignature(hash);
  };

  return toAccount({
    address,
    signMessage,
    signTransaction,
    signTypedData,
    nonceManager,
  });
}
