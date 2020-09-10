
export class Config {

  /* L1 */
  public static L1NodeUrlWithPort(): string {
    return process.env.L1_NODE_WEB3_URL
  }

  /* L2 */
  public static L2NodeUrlWithPort(): string {
    return process.env.L2_NODE_WEB3_URL
  }


  /* Postgres */
  public static PostgresHost(): string {
    return process.env.POSTGRES_HOST
  }

  public static PostgresUser(): string {
    return process.env.POSTGRES_USER
  }

  public static PostgresPassword(): string {
    return process.env.POSTGRES_PASSWORD
  }


  /* Contracts */
  public static L1ToL2TransactionQueueContractAddress(): string {
    return process.env.L1_TO_L2_TRANSACTION_QUEUE_CONTRACT_ADDRESS
  }

  public static SafetyTransactionQueueContractAddress(): string {
    return process.env.SAFETY_TRANSACTION_QUEUE_CONTRACT_ADDRESS
  }

  public static CanonicalTransactionChainContractAddress(): string {
    return process.env.CANONICAL_TRANSACTION_CHAIN_CONTRACT_ADDRESS
  }

  public static StateCommitmentChainContractAddress(): string {
    return process.env.STATE_COMMITMENT_CHAIN_CONTRACT_ADDRESS
  }

}