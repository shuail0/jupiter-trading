# Jupiter Trading Bot
## 环境搭建
### 安装 Node.js
访问 Node.js 官网 下载最新的稳定版 Node.js。
打开下载的安装包，按照提示进行安装。

### 安装项目依赖
在项目的根目录下，打开终端，运行以下命令：
``` bash
npm install
```

这将会根据 package.json 文件中的列表，安装所有需要的依赖包。

## 运行项目

首先打开`src/index.js`文件，修改将下面的参数：

``` javascript
const connection = new Connection(''); // RPC，到https://www.helius.dev/注册获取
const wallet_path = './SOLTestWalle.csv'; // 钱包文件路径
const tokenIn = 'So11111111111111111111111111111111111111112';  // 支付Token，SOL Token 地址
const tokenOut = 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN'; // 获得Token，JUP Token 地址
const minAmount = 10 * 10 ** 6; // 最少买入jup数量
const maxAmount = 15 * 10 ** 6; // 最多买入jup数量
```



在项目的根目录下，打开终端，运行以下命令：

``` bash
node src/index.js
```

![X (formerly Twitter) Follow](https://img.shields.io/twitter/follow/crypto0xLeo)
