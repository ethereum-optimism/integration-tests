
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

}