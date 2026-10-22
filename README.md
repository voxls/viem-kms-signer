# @voxls/viem-kms-signer

A viem `LocalAccount` backed by an AWS KMS `ECC_SECG_P256K1` key.

## Install

Published to GitHub Packages. Point the `@voxls` scope at it in `.npmrc`:

```ini
@voxls:registry=https://npm.pkg.github.com
```

```sh
pnpm add @voxls/viem-kms-signer viem @aws-sdk/client-kms
```

## Usage

```ts
import { createWalletClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { getKmsAccount } from '@voxls/viem-kms-signer';

const account = await getKmsAccount({
  keyId: 'arn:aws:kms:us-east-1:123456789012:key/…',
  region: 'us-east-1',
  // credentials: optional; defaults to the AWS SDK credential chain
  // nonceManager: optional viem NonceManager
});

const client = createWalletClient({ account, chain: mainnet, transport: http() });
```

The account supports `signMessage`, `signTransaction`, and `signTypedData`. The KMS key needs `kms:GetPublicKey` and `kms:Sign`.

## Publishing

`.github/workflows/publish.yml` runs on every push to `main` and publishes to GitHub Packages when the `version` in `package.json` has not been published yet. Bump the version to release.
