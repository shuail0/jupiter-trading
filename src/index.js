
import dotenv from 'dotenv';
dotenv.config();
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Wallet } from '@project-serum/anchor';
import bs58 from 'bs58';
import { sleep, convertCSVToObjectSync, decryptUsingAESGCM, appendObjectToCSV } from './utils.js';
import Jupiter from './jupiter/jupiter.js';
import { getSPLBalance } from './spl.js';
import readlineSync from 'readline-sync';
import Logger from '@youpaichris/logger';
import path from 'path';
import fs from 'fs';
import * as solanaWeb3 from '@solana/web3.js';
import { getMint } from '@solana/spl-token';

// 获取当前文件路径
const __filename = new URL(import.meta.url).pathname;
// 获取上级目录路径
const __dirname = path.dirname(path.dirname(__filename));
const logsPath = path.join(__dirname, 'logs');
// 如果logs文件夹不存在则创建
if (!fs.existsSync(logsPath)) {
    fs.mkdirSync(logsPath);
}

const successPath = path.join(logsPath, 'TradingSuccess.csv');
const errorPath = path.join(logsPath, 'TradingError.csv');

const logger = new Logger();
const pwd = readlineSync.question('Please enter your password: ', {
    hideEchoBack: true // 密码不回显
});

const connection = new Connection(''); // RPC，到https://www.helius.dev/注册获取
const wallet_path = ''; // 钱包文件路径
const tokenIn = 'So11111111111111111111111111111111111111112';  // 支付Token，SOL Token 地址
let minAmount = 0.1; // 最少收到币数
let maxAmount = 0.13; // 最多收到币数
// LST Token 地址,从中随机选择一个买入。
const outputTokenList = [
    '5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm', // Infinitie
    'BonK1YhkXEGLZzwtcvRTip3gAL9nCeQD7ppZBLXhtTs', // Bonksie
    'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1', // Jupitie
    'GRJQtWwdJmp5LLpy8JWjPgn5FnLyqSJGNhn5ZnCTFUwM', // Clockie
    'Dso1bDeDjCQxTrWHqUUi63oBvV7Mdm6WaobLbQ7gnPQ', // Driftie
    'he1iusmfkpAdwvxLNGV8Y1iSbj4rUy6yMhEA3fotn9A', // Helie
]


const wallets = convertCSVToObjectSync(wallet_path);

; (async () => {


    // 遍历钱包
    for (let i = 0; i < wallets.length; i++) {
        const tokenOut = outputTokenList[Math.floor(Math.random() * outputTokenList.length)];
        let tokenMint = await getMint(connection, new PublicKey(tokenOut));
        const randomMin = minAmount * 10 ** tokenMint.decimals; // 最少收到币数
        const randomMax = maxAmount * 10 ** tokenMint.decimals; // 最少收到币数

        const wt = wallets[i];
        const privateKey = decryptUsingAESGCM(wt.a, wt.e, wt.i, wt.s, pwd)
        const wallet = new Wallet(Keypair.fromSecretKey(bs58.decode(privateKey)));
        const jupiter = new Jupiter(connection, wallet);
        const tokenOutBalanceInfo = await getSPLBalance(connection, wallet.publicKey, tokenOut);
        const MAX_RETRY = 5;
        let num = 0;
        let date;

        while (num < MAX_RETRY) {
            try {
                // 查询SOL余额
                const SOLBalance = await connection.getBalance(wallet.publicKey);
                if (SOLBalance < 0.0003 * 10 ** 9) {
                    logger.error('SOL余额不足');
                    break;
                }
                const currentTokenOutBalanceInfo = await getSPLBalance(connection, wallet.publicKey, tokenOut);
                if (currentTokenOutBalanceInfo.amount !== tokenOutBalanceInfo.amount) {
                    logger.info(`钱包:${wt.Address}余额发生变化, SOL余额:${SOLBalance}, 初始JUP余额:${tokenOutBalanceInfo.uiAmount}, 当前JUP余额:${currentTokenOutBalanceInfo.uiAmount}`);
                    if (currentTokenOutBalanceInfo.amount > tokenOutBalanceInfo.amount) {
                        logger.success(`当前jup余额大于初始余额,购买成功`);
                        // 获取当前本地时间
                        date = new Date().toLocaleString();
                        await appendObjectToCSV({ date, ...wt }, successPath)
                        break;
                    }
                }
                let amount = Math.floor(Math.random() * (randomMax - randomMin) + randomMin);
                amount = Math.floor(amount / 10000) * 10000;

                logger.info('wallet address:', wt.Address, 'SOLBalance:', SOLBalance, 'tokenIn:', tokenIn, SOLBalance, 'trade Token:', tokenOut, ' trade amount:', amount);
                let txid = await jupiter.swap(tokenIn, tokenOut, amount, 'ExactOut');
                if (txid) {
                    logger.success(`交易成功:https://solscan.io/tx/${txid}`)
                    // 获取当前本地时间
                    date = new Date().toLocaleString();
                    await appendObjectToCSV({ date, ...wt }, successPath)
                    break;
                } else {
                    // num++;
                    // logger.error('交易失败,休息6秒后重试...');
                    // await sleep(0.1);
                    // if (num === MAX_RETRY) {
                    //     logger.error('重试次数已达上限');
                    //     date = new Date().toLocaleString();
                    //     await appendObjectToCSV({ date, ...wt, Error: '重试次数已达上限' }, errorPath)
                    //     break;
                    // }
                    throw new Error('交易失败');
                }
            } catch (error) {
                num++;
                logger.error(`交易报错:${error},息6秒后重试...`);
                await sleep(0.1);
                if (num === MAX_RETRY) {
                    logger.error('重试次数已达上限');
                    date = new Date().toLocaleString();
                    await appendObjectToCSV({ date, ...wt, Error: error }, errorPath)
                    break;
                }

            }
        }
        if (i < wallets.length - 1) {
            // 随机暂停 5-10分钟
            const sleepTime = Math.floor(Math.random() * (10 - 5) + 5);
            logger.info(`休息${sleepTime}分钟后继续...`)
            await sleep(sleepTime);
        }
    }

})();