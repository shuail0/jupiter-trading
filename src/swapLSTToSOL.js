
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

const successPath = path.join(logsPath, 'LSTTradingSuccess.csv');
const errorPath = path.join(logsPath, 'LSTTradingError.csv');

const logger = new Logger();
const pwd = readlineSync.question('Please enter your password: ', {
    hideEchoBack: true // 密码不回显
});

const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=aac42329-3edf-4433-94ec-870600c2ba9e'); // RPC，到https://www.helius.dev/注册获取
const wallet_path = '/Users/lishuai/Documents/crypto/bockchainbot/SOLTestWalle加密.csv'; // 钱包文件路径
const tokenOut = 'So11111111111111111111111111111111111111112';  // 支付Token，SOL Token 地址
const swapMode = 'ExactIn'; // 交易模式，ExactOut(按接收到的数量交易) 或 ExactIn （按支付的数量交易）
// LST Token 地址,遍历卖出。
const inputTokenList = [
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
        const wt = wallets[i];
        const privateKey = decryptUsingAESGCM(wt.a, wt.e, wt.i, wt.s, pwd)
        const wallet = new Wallet(Keypair.fromSecretKey(bs58.decode(privateKey)));
        const jupiter = new Jupiter(connection, wallet);
        for (const tokenIn of inputTokenList) {
            const tokenInBalanceInfo = await getSPLBalance(connection, wallet.publicKey, tokenIn);
            if (tokenInBalanceInfo.amount <= 0) {
                logger.error(`Token ${tokenIn} 余额为0,跳过`);
                continue;
            } else {
                logger.info(`Token ${tokenIn} 余额为:${tokenInBalanceInfo.uiAmount}, 开始交易`);
            }
            const MAX_RETRY = 5;
            let num = 0;
            let date;

            while (num < MAX_RETRY) {
                try {

                    const currentTokenOutBalanceInfo = await getSPLBalance(connection, wallet.publicKey, tokenIn);
                    if (currentTokenOutBalanceInfo.amount !== tokenInBalanceInfo.amount) {
                        logger.info(`钱包:${wt.Address}余额发生变化, 初始JUP余额:${tokenInBalanceInfo.uiAmount}, 当前JUP余额:${currentTokenOutBalanceInfo.uiAmount}`);
                        if (currentTokenOutBalanceInfo.amount < tokenInBalanceInfo.amount) {
                            logger.success(`当前jup余额大于初始余额,卖出成功`);
                            // 获取当前本地时间
                            date = new Date().toLocaleString();
                            await appendObjectToCSV({ date, ...wt }, successPath)
                            break;
                        }
                    }
                    let amount = tokenInBalanceInfo.amount;

                    logger.info('wallet address:', wt.Address, 'tokenIn:', tokenIn, ' trade amount:', amount, 'trade Token:', tokenOut);
                    let txid = await jupiter.swap(tokenIn, tokenOut, amount, swapMode);
                    if (txid) {
                        logger.success(`交易成功:https://solscan.io/tx/${txid}`)
                        // 获取当前本地时间
                        date = new Date().toLocaleString();
                        await appendObjectToCSV({ date, ...wt }, successPath)
                        break;
                    } else {
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
        }
        // if (i < wallets.length - 1) {
        //     // 随机暂停 5-10分钟
        //     const sleepTime = Math.floor(Math.random() * (10 - 5) + 5);
        //     logger.info(`休息${sleepTime}分钟后继续...`)
        //     await sleep(sleepTime);
        // }
    }

})();