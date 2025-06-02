# Hello NEAR Contract

The smart contract exposes two methods to enable storing and retrieving a greeting in the NEAR network.

```ts
@NearBindgen({})
class HelloNear {
  greeting: string = "Hello";

  @view // This method is read-only and can be called for free
  get_greeting(): string {
    return this.greeting;
  }

  @call // This method changes the state, for which it cost gas
  set_greeting({ greeting }: { greeting: string }): void {
    // Record a log permanently to the blockchain!
    near.log(`Saving greeting ${greeting}`);
    this.greeting = greeting;
  }
}
```

<br />

# Quickstart

1. Make sure you have installed [node.js](https://nodejs.org/en/download/package-manager/) >= 16.
2. Install the [`NEAR CLI`](https://github.com/near/near-cli#setup)

<br />

## 1. Build and Test the Contract
You can automatically compile and test the contract by running:

```bash
npm run build
```

<br />

## 2. Create an Account and Deploy the Contract
You can create a new account and deploy the contract by running:

```bash
near create-account <your-account.testnet> --useFaucet
near deploy <your-account.testnet> build/release/hello_near.wasm
```

<br />


## 3. Retrieve the Greeting

`get_greeting` is a read-only method (aka `view` method).

`View` methods can be called for **free** by anyone, even people **without a NEAR account**!

```bash
# Use near-cli to get the greeting
near view <your-account.testnet> get_greeting
```

<br />

## 4. Store a New Greeting
`set_greeting` changes the contract's state, for which it is a `call` method.

`Call` methods can only be invoked using a NEAR account, since the account needs to pay GAS for the transaction.

```bash
# Use near-cli to set a new greeting
near call <your-account.testnet> set_greeting '{"greeting":"howdy"}' --accountId <your-account.testnet>
```

**Tip:** If you would like to call `set_greeting` using another account, first login into NEAR using:

```bash
# Use near-cli to login your NEAR account
near login
```

and then use the logged account to sign the transaction: `--accountId <another-account>`.
# Achievo - Certificate Management Smart Contract

A comprehensive certificate management system built on NEAR Protocol that handles user registration, organization verification, certificate issuance, rewards, and payments.

## Features

### User Management
- **Individual Registration**: Students can register with personal information
- **Organization Registration**: Educational institutions can register and get verified
- **Organization Verification**: Admin approval process for certificate issuers

### Certificate Management
- **Issue Certificates**: Verified organizations can issue digital certificates
- **Update Status**: Track certificate progress (pending → completed)
- **Revoke Certificates**: Handle violations or corrections
- **Certificate Validation**: Public verification of certificate authenticity
- **History Tracking**: Complete audit trail of certificate changes

### Rewards System
- **Milestone Rewards**: Automatic rewards for learning milestones
- **Reward Tracking**: View all rewards earned by a learner

### Payment Processing
- **NEAR Transfers**: Handle payments between users and organizations

## Contract Methods

### View Methods (Free to call)
```typescript
// Get user information
get_individual({ account_id: string }): Individual | null
get_organization({ account_id: string }): Organization | null
get_certificate({ certificate_id: string }): Certificate | null

// Validate certificates
validate_certificate({ certificate_id: string }): CertificateMetadata | null
get_certificate_history({ certificate_id: string }): UpdateLog[]

// List rewards
list_rewards({ learner_id: string }): Reward[]
```

### Call Methods (Require gas)
```typescript
// Registration
register_individual({ name: string, dob: string, email: string }): void
register_organization({ name: string, contact_info: string }): void
verify_organization({ organization_id: string }): void

// Certificate management
issue_certificate({ learner_id: string, course_id: string, metadata: CertificateMetadata }): string
update_certificate_status({ certificate_id: string, new_status: string }): void
revoke_certificate({ certificate_id: string, reason: string }): void

// Rewards
grant_reward({ learner_id: string, milestone: string }): string

// Payments
process_payment({ recipient_id: string, amount: string }): void
```

## Deployment Guide

### Prerequisites
1. Install [Node.js](https://nodejs.org/) >= 16
2. Install [NEAR CLI](https://github.com/near/near-cli)
3. Create a NEAR testnet account

### Build and Deploy
```bash
# Install dependencies
npm install

# Build the contract
npm run build

# Deploy to testnet
near deploy --wasmFile build/achievo.wasm --accountId your-account.testnet

# Initialize if needed
near call your-account.testnet new '{}' --accountId your-account.testnet
```

### Frontend Integration with Meteor Wallet

```javascript
// Connect to Meteor Wallet
import { connect, Contract } from 'near-api-js';

const contract = new Contract(wallet.account(), 'your-contract.testnet', {
  viewMethods: ['validate_certificate', 'list_rewards', 'get_individual'],
  changeMethods: ['register_individual', 'issue_certificate', 'process_payment']
});

// Register individual
await contract.register_individual({
  name: "John Doe",
  dob: "1990-01-01", 
  email: "john@example.com"
});

// Issue certificate (organization only)
const certId = await contract.issue_certificate({
  learner_id: "learner.testnet",
  course_id: "blockchain-101",
  metadata: {
    course_name: "Blockchain Fundamentals",
    completion_date: "2024-01-15",
    skills: ["blockchain", "cryptocurrency"],
    grade: "A"
  }
});
```

## Workflow Examples

### Student Registration Flow
1. Student connects Meteor Wallet on frontend
2. Student fills registration form
3. Frontend calls `register_individual()`
4. Contract stores student data on blockchain

### Certificate Issuance Flow
1. Organization registers and gets verified
2. Student completes course requirements
3. Organization calls `issue_certificate()` with student ID and course data
4. Certificate is minted with "pending" status
5. When milestones are met, status updates to "completed"

### Payment Flow
1. User initiates payment on frontend
2. Meteor Wallet prompts for transaction approval
3. User signs transaction
4. Contract transfers NEAR tokens to recipient
5. Transaction is recorded on blockchain

## Testing

```bash
# Run tests
npm test

# Test specific functions
near call your-contract.testnet validate_certificate '{"certificate_id": "cert_1"}' --accountId your-account.testnet
```

## Security Considerations

- Organizations must be verified before issuing certificates
- Only certificate issuers can update their certificates
- Payment amounts are validated against attached deposits
- All state changes are logged for audit trails

## Network Configuration

- **Testnet**: Use for development and testing
- **Mainnet**: Deploy for production use
- **Wallet**: Meteor Wallet integration for user authentication
