import { Connection, Keypair, VersionedTransaction, ComputeBudgetProgram, TransactionExpiredBlockheightExceededError } from '@solana/web3.js';
import fetch from 'cross-fetch';
import bs58 from "bs58";
import promiseRetry from "promise-retry";
import Logger from '@youpaichris/logger';
const logger = new Logger();

const wait = (time) => new Promise((resolve) => setTimeout(resolve, time));

function getSignature(transaction) {
    const signature =
        "signature" in transaction
            ? transaction.signature
            : transaction.signatures[0];
    if (!signature) {
        throw new Error(
            "Missing transaction signature, the transaction was not signed by the fee payer"
        );
    }
    return bs58.encode(signature);
}

const SEND_OPTIONS = {
    replaceRecentBlockhash: true,
    commitment: "processed",
}
class Jupiter {
    constructor(connection, wallet) {
        this.connection = connection;
        this.wallet = wallet;
        this.baaseUrl = 'https://quote-api.jup.ag/v6';
    }


    async getQuote(inputMint, outputMint, amount, swapMode='ExactIn', slippageBps = 10000) {
        const quoteResponse = await (
            await fetch(`${this.baaseUrl}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&swapMode=${swapMode}`)
        ).json();
        return quoteResponse;
    }

    async transactionSenderAndConfirmationWaiter(serializedTransaction, blockhashWithExpiryBlockHeight) {

        // // 执行交易
        const txid = await this.connection.sendRawTransaction(serializedTransaction, {
            skipPreflight: true,
            maxRetries: 50
        });

        const controller = new AbortController();
        const abortSignal = controller.signal;

        const abortableResender = async () => {
            let txid;
            while (true) {
                await wait(2_000);
                if (abortSignal.aborted) return;
                try {
                    txid = await this.connection.sendRawTransaction(
                        serializedTransaction,
                        SEND_OPTIONS
                    );
                } catch (e) {
                    logger.warn(`Failed to resend transaction: ${e}`);
                }
            }
        };

        try {
            abortableResender();
            const lastValidBlockHeight = blockhashWithExpiryBlockHeight.lastValidBlockHeight - 150;
            await Promise.race([
                this.connection.confirmTransaction(
                    {
                        ...blockhashWithExpiryBlockHeight,
                        lastValidBlockHeight,
                        signature: txid,
                        abortSignal,
                    },
                    "confirmed"
                ),
                new Promise(async (resolve) => {
                    // in case ws socket died
                    while (!abortSignal.aborted) {
                        await wait(2_000);
                        const tx = await this.connection.getSignatureStatus(txid, {
                            searchTransactionHistory: false,
                        });
                        if (tx?.value?.confirmationStatus === "confirmed") {
                            resolve(tx);
                        }
                    }
                }),

            ]);

        } catch (e) {
            if (e instanceof TransactionExpiredBlockheightExceededError) {
                // we consume this error and getTransaction would return null
                return null;
            } else {
                // invalid state from web3.js
                throw e;
            }
        } finally {
            controller.abort();
        }

        // in case rpc is not synced yet, we add some retries
        const response = promiseRetry(
            async (retry) => {
                const response = await this.connection.getTransaction(txid, {
                    commitment: "confirmed",
                    maxSupportedTransactionVersion: 0,
                });
                if (!response) {
                    retry(response);
                }
                return response;
            },
            {
                retries: 50,
                minTimeout: 1e3,
            }
        );
        return response;
    }

    async swap(inputMint, outputMint, amount, swapMode='ExactIn', slippageBps = 1000) {
        const quoteResponse = await this.getQuote(inputMint, outputMint, amount, swapMode, slippageBps);

        if (quoteResponse.errorCode === 'COULD_NOT_FIND_ANY_ROUTE') {
            logger.error('getQuote.error:', quoteResponse.error);
            throw new Error(quoteResponse.error);
        };
        const swapResult = await (
            await fetch(`${this.baaseUrl}/swap`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    quoteResponse,
                    userPublicKey: this.wallet.publicKey.toString(),
                    wrapAndUnwrapSol: true,
                    prioritizationFeeLamports: "auto",
                    prioritizationFeeLamports: {
                        autoMultiplier: 2,
                    },
                    // computeUnitPriceMicroLamports: 250000,
                })
            })
        ).json();
        // // // 6. 反序列化交易，并签署交易
        const swapTransactionBuf = Buffer.from(swapResult.swapTransaction, 'base64');
        let transaction = VersionedTransaction.deserialize(swapTransactionBuf);

        // sign the transaction
        transaction.sign([this.wallet.payer]);
        const signature = getSignature(transaction);
        // 模拟交易是否会成功
        // We first simulate whether the transaction would be successful
        const { value: simulatedTransactionResponse } =
            await this.connection.simulateTransaction(transaction, SEND_OPTIONS);
        const { err, logs } = simulatedTransactionResponse;

        if (err) {
            // Simulation error, we can check the logs for more details
            // If you are getting an invalid account error, make sure that you have the input mint account to actually swap from.
            logger.error("Simulation Error:");
            logger.error({ err, logs });
            return;
        };

        const serializedTransaction = Buffer.from(transaction.serialize());
        const blockhash = transaction.message.recentBlockhash;

        const transactionResponse = await this.transactionSenderAndConfirmationWaiter(
            serializedTransaction,
            {
                blockhash,
                lastValidBlockHeight: swapResult.lastValidBlockHeight,
            },
        );
        // If we are not getting a response back, the transaction has not confirmed.
        if (!transactionResponse) {
            logger.error("Transaction not confirmed");
            return;
        }

        if (transactionResponse.meta?.err) {
            logger.error(transactionResponse.meta?.err);
        }

        return signature;



    }


}

export default Jupiter;