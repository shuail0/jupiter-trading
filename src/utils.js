import { createLogger, format as _format, transports as _transports } from 'winston';
import { readFileSync, existsSync, writeFileSync, appendFileSync } from 'fs';
import pkg from 'papaparse';
const { parse } = pkg;
import crypto from 'crypto';


// 将CSV文件转换为Objects
export const convertCSVToObjectSync = (filePath) => {
    const fileData = readFileSync(filePath, 'utf-8');
    const parsedData = parse(fileData, {
        header: true,
        skipEmptyLines: true,
        transformHeader: header => header.trim(), // 移除头部字段周围的空格
        complete: (results) => results.data
    });

    return parsedData.data;
};


//  将objet保存为csv
export const saveObjectToCSV = (data, outputPath) => {
    // Check if the file already exists. If not, write headers.
    if (!existsSync(outputPath)) {
        const headers = Object.keys(data[0]).join(',');
        writeFileSync(outputPath, headers + '\n', 'utf8');
    }

    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        const values = Object.values(item).map(value => `"${value}"`).join(',');
        const csvRow = `${values}\n`;

        appendFileSync(outputPath, csvRow, 'utf8');
    }

    console.log(`Data saved to ${outputPath}`);
};

// 将单个对象追加到 CSV 文件
export const appendObjectToCSV = async (obj, outputPath) => {
    // Check if the file already exists. If not, write headers.
    if (!existsSync(outputPath)) {
        const headers = Object.keys(obj).filter(key => key !== 'wallet').join(',');
        writeFileSync(outputPath, headers + '\n', 'utf8');
    }
    const values = Object.values(obj).map(value => `"${value}"`).join(',');
    const csvRow = `${values}\n`;
    appendFileSync(outputPath, csvRow, 'utf8');

};

// 暂停函数
export const sleep = (minutes) => {
    const milliseconds = minutes * 60 * 1000;
    return new Promise(resolve => setTimeout(resolve, milliseconds));
};

// 在范围内随机获取浮点数
export const getRandomFloat = (min, max, precision = 18) => {
    const integerPrecision = 10 ** precision;
    const randomInteger = Math.floor(Math.random() * (max * integerPrecision - min * integerPrecision) + min * integerPrecision);
    return randomInteger / integerPrecision;
};



// 保存日志
export const saveLog = (projectName, message) => {
    const logger = createLogger({
        level: 'info',
        format: _format.simple(),
        transports: [
            new _transports.Console(),
            new _transports.File({ filename: `./${projectName}.log` }),
        ],
    });
    const currentTime = new Date().toISOString();
    logger.info(`${currentTime} ${message}`);
};

// 将字符串转换为64个字符的十六进制数据
export function formHexData(string) {
    // 确保数据是一个字符串
    if (typeof string !== 'string') {
        throw new Error('Input must be a string.');
    }
    // 如果字符前面有0x，去掉它
    if (string.startsWith('0x')) {
        string = string.slice(2);
    }

    // 如果字符串长度超过 64 个字符，则抛出错误
    if (string.length > 64) {
        throw new Error('String length exceeds 64 characters.');
    }

    // 在字符串前面添加零以达到 64 个字符的长度
    return '0'.repeat(64 - string.length) + string;
}



function getKeyFromPassword(password, salt) {
    const iterations = 100000;
    const keylen = 32;
    const digest = 'sha512';
    return crypto.pbkdf2Sync(password, salt, iterations, keylen, digest);
  }

export function decryptUsingAESGCM(a, e, i, s, password) {
    const key = getKeyFromPassword(password, Buffer.from(s, 'hex'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(i, 'hex'));
  
    decipher.setAuthTag(Buffer.from(a, 'hex'));
  
    const decryptedData = Buffer.concat([decipher.update(Buffer.from(e, 'hex')), decipher.final()]);
    return decryptedData.toString('utf8');
  };

// export default { convertCSVToObjectSync, sleep, getRandomFloat, saveLog, saveObjectToCSV, appendObjectToCSV, formHexData }