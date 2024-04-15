import dotenv from 'dotenv';
dotenv.config();
import { Connection, Keypair, VersionedTransaction, PublicKey } from '@solana/web3.js';
import fetch from 'cross-fetch';
import { Wallet } from '@project-serum/anchor';
import bs58 from 'bs58';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token'; // version 0.1.x



export async function getSPLBalance(connection, address, mint) {
    const addressKey = new PublicKey(address)
    const mintKey = new PublicKey(mint);
    let tokenAccounts = await connection.getParsedTokenAccountsByOwner(addressKey, { mint: mintKey });
    
    let amount = 0;
    let decimals = 0;
    let uiAmount = 0;
    if (tokenAccounts.value.length > 0) {

        for (const account of tokenAccounts.value) {
            const tokenAmount =  account.account.data.parsed.info.tokenAmount;
            amount += Number(tokenAmount.amount);
            uiAmount += tokenAmount.uiAmount;
            decimals = tokenAmount.decimals;
        }
    }
    return { amount, uiAmount, decimals };
}