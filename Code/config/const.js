const ethers = require("ethers")
const { Percent: UNIPercent } = require("@uniswap/sdk-core")
const { Percent: QSPercent } = require("quickswap-sdk")
const { Percent: SushiPercent } = require("@sushiswap/sdk")

//Success - Failure
const SF = {
    Failure: 0,
    Success: 1,
}

module.exports = {
    //### those values should be fetched from DB
    DAI: "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063",
    WETH: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", //0x7ceb23fd6bc0add59e62ac25578270cff1b9f619
    USDC: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
    MATIC: "0x0000000000000000000000000000000000001010",
    AAVE: "0xd6df932a45c0f255f85145f286ea0b292b21c90b",

    //SC Addresses
    QuoterContract: ethers.utils.getAddress("0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6"),

    //UNISWAP
    V3_ROUTER_ADDRESS: ethers.utils.getAddress("0xE592427A0AEce92De3Edee1F18E0157C05861564"), //for exactInputSingle trades (defined in SDK-V3) - eg: WETH => USDC
    SWAP_ROUTER_ADDRESSES: ethers.utils.getAddress("0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"), //for multicall trades (defined inn SDK-Router) - eg: USDC => WETH

    //BC Data: Router, addresses...
    MaticNetwork: "matic", //used for Infura
    RinkebyNetwork: "rinkeby",
    RopstenNetwork: "ropsten",
    MaticChainId: 137,
    RinkebyChainId: 4,
    RopstenChainId: 3,
    QSRouter: ethers.utils.getAddress("0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"),
    UniRouter: ethers.utils.getAddress("0xe592427a0aece92de3edee1f18e0157c05861564"),
    SushiRouter: ethers.utils.getAddress("0x1b02da8cb0d097eb8d57a175b88c7d8b47997506"),
    ApeRouter: ethers.utils.getAddress("0xC0788A3aD43d79aa53B09c2EaCc313A787d1d607"),

    //Dexes
    Quickswap: "Quickswap",
    Uniswap: "Uniswap",
    Sushiswap: "Sushiswap",
    Apeswap: "Apeswap",

    InfuraProjectId: "d4ce1fd32ba54b3ab5e3e3f156ce2312",
    AlchemyAPI: "2_F7dgp4mWUW4d089X4Ttyi0JUAESl_0",
    WalletAddress: ethers.utils.getAddress("0x9A2Aa18bBAAA7CA86EAE3B8edDd8090Ab6D0b8Ca"),
    PKEY: "ADD_KEY", 

    //GraphQL
    QSSubgraph: "https://api.thegraph.com/subgraphs/name/sameepsi/quickswap06",
    SushiSubgraph: "https://api.thegraph.com/subgraphs/name/sushiswap/matic-exchange",
    UniSubgraph: "https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-v3-polygon", //### pairs is called pools
    ApeSubgraph: "https://graph.apeswap.finance/subgraphs/name/ape-swap/apeswap-subgraph",

    PairsToRetrieve: 1000,
    MinReserveETH: 3,
    //defaultAmountForPriceFetch: 10 ** 18, // 1000000000000000000,

    //Tokens
    MustIncludeTokenSymbols: ["WETH", "WMATIC", "USDC", "USDT"],
    MustIncludeTokens: [
        "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
        "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
        "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
        "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
    ],

    ForbiddenTokenSymbols: [
        "ETH2x-FLI-P",
        "iETHV",
        "maWETH",
        "rMATIC",
        "upMATIC",
        "BabyMatic",
        "sETH",
        "invETHDOM",
        "miMATIC",
        "ETHDOM-SEP22",
        "mETHDOOM",
        "mETHMOON",
        "pBTC",
        "iBTCV",
        "BTCV",
        "BTCpx",
        "DEI",
        "IXT",
        "Yf-DAI",
        "1MIL",
        "maDAI",
    ],

    StableCoins: ["USDC", "USDT", "TUSD", "DAI", "UST"],

    TokenCurrency: ["usd"],

    TransactionType: { Trade: "trade", Approve: "approve" },
    MaxTradeAmountUSD: 1000,

    //Trading Parameters
    GasLimit: "350000", // is this always sufficient ???
    MinGasFeeMaticInWei: ethers.BigNumber.from(80 * 10 ** 9), //min gas fee in GWEI
    Deadline: Math.floor(Date.now() / 1000) + 60 * 4,
    SlippageToleranceUNI: new UNIPercent(300, 10000),
    SlippageToleranceQS: new QSPercent(300, 10000),
    SlippageToleranceSushi: new SushiPercent(300, 10000),
    MaxTryUNIAlphaRouterTrade: 15,

    MongoURI: "mongodb://127.0.0.1:27017/ArbitrageBot",

    //Other constants
    SF,
}
