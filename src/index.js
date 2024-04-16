
import dotenv from 'dotenv';
dotenv.config();
import { Connection, Keypair } from '@solana/web3.js';
import { Wallet } from '@project-serum/anchor';
import bs58 from 'bs58';
import { sleep, convertCSVToObjectSync, decryptUsingAESGCM, appendObjectToCSV } from './utils.js';
import Jupiter from './jupiter/jupiter.js';
import { getSPLBalance } from './spl.js';
import readlineSync from 'readline-sync';
import Logger from '@youpaichris/logger';
const logger = new Logger();

const pwd = readlineSync.question('Please enter your password: ', {
    hideEchoBack: true // 密码不回显
});

const connection = new Connection(''); // RPC，到https://www.helius.dev/注册获取
const wallet_path = './SOLTestWalle.csv'; // 钱包文件路径
const tokenIn = 'So11111111111111111111111111111111111111112';  // 支付Token，SOL Token 地址
const tokenOut = 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN'; // 获得Token，JUP Token 地址
const minAmount = 10 * 10 ** 6; // 最少买入jup数量
const maxAmount = 15 * 10 ** 6; // 最多买入jup数量

const wallets = convertCSVToObjectSync(wallet_path);

; (async () => {


    // 遍历钱包
    for (let i = 0; i < wallets.length; i++) {
        const wt = wallets[i];
        const privateKey = decryptUsingAESGCM(wt.a, wt.e, wt.i, wt.s, pwd)
        const wallet = new Wallet(Keypair.fromSecretKey(bs58.decode(privateKey)));
        const jupiter = new Jupiter(connection, wallet);

        const MAX_RETRY = 5;
        let num = 0;
        let date;
        while (num < MAX_RETRY) {
            // 查询SOL余额
            const SOLBalance = await connection.getBalance(wallet.publicKey);
            if (SOLBalance < 0.0003 * 10 ** 9) {
                logger.error('SOL余额不足');
                break;
            }
            const amount = Math.floor(Math.random() * (maxAmount - minAmount) + minAmount);

            logger.info('wallet address', wt.Address, 'SOLBalance:', SOLBalance, 'trade amount:', amount);
            let txid = await jupiter.swap(tokenIn, tokenOut, amount, 'ExactOut');
            if (txid) {
                logger.success(`交易成功:https://solscan.io/tx/${txid}`)
                getSPLBalance(connection, wallet.publicKey, tokenOut).then(balance => {
                    logger.info(`JUP余额: ${balance.uiAmount}`);
                })
                // 获取当前本地时间
                date = new Date().toLocaleString();
                await appendObjectToCSV({ date, ...wt }, '../logs/Sucess.csv')
                break;
            } else {
                num++;
                logger.error('交易失败,休息6秒后重试...');
                await sleep(0.1);
                if (num === MAX_RETRY) {
                    logger.error('重试次数已达上限');
                    date = new Date().toLocaleString();
                    await appendObjectToCSV({ date, ...wt, Error: error }, '../logs/Error.csv')
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