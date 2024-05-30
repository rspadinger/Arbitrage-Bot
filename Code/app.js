const express = require("express")
const mongoose = require("mongoose")
const bodyParser = require("body-parser")
const QS = require("quickswap-sdk")
const UNISDK = require("@uniswap/v3-sdk")
const UNI = require("@uniswap/sdk-core")
const Sushi = require("@sushiswap/sdk")
const ethers = require("ethers")
const JSBI = require("jsbi")
const res = require("express/lib/response")

const { errLog, infoLog } = require("./logger")
const SCOperations = require("./blockchain/SCOperations")
const UNISWAP = require("./blockchain/uniswap")
const C = require("./config/const")
const T = require("./config/mainTokens")
const graphQueries = require("./config/graphQueries")
const { GetPairData } = require("./helpers/graphql")
const DB = require("./helpers/dbOperations")
const mainRoutines = require("./mainRoutines")
const initAndTests = require("./initMatic")
const H = require("./helpers/generalHelpers")
const tokenPrice = require("./helpers/tokenPrice")

const app = express()

//Connect to DB
mongoose.Promise = global.Promise
mongoose
    .connect(C.MongoURI)
    .then
    //() => console.log("MongoDB Connected")
    ()
    .catch((err) => console.log(err))

//get required objects and db-models
//### for testing only
require("./models/Pairs")
require("./models/MatchingPairs")
require("./models/ApprovedTokens")
require("./models/Transactions")
const Pair = mongoose.model("pairs")
const MatchingPair = mongoose.model("matchingPairs")
const ApprovedToken = mongoose.model("approvedTokens")
const Transaction = mongoose.model("transactions")

;(async () => {})()

//DB Init & running variousTests
const InitAndTest = async () => {
    let res

    //const pairsQS = await GetPairData(C.QSSubgraph, 5, "Quickswap")
    //console.log(pairsQS)

    await initAndTests.DeletePairsAndMatchingPairsFromDB()
    await initAndTests.GetPairsFromSubgraphAndAddToDB()
    await initAndTests.GenerateMatchingPairs()

    await initAndTests.FetchPricesQSSushiUniForFirstPair()

    //### sort: { 'diffPercent': 'desc' }
    await mainRoutines.GetPriceDataForAllMatchingPairsOnNetworkAndUpdateDB(C.MaticNetwork)
    console.log("Price Update Finished!")

    await initAndTests.GetPriceQuotes()

    //DiffPercent: { $gte: 0.95 }
    const top = await MatchingPair.find({ DiffPercent: { $gte: 0.7 } })

    //$$$ Allowance & Approval
    res = await SCOperations.GetAllowanceForToken("matic", "Uniswap", "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063", 18)
    res = await SCOperations.GetAllowanceForToken("matic", "Quickswap", "0x2791bca1f2de4661ed88a30c99a7a9449aa84174", 6)
    res = await SCOperations.GetAllowanceForToken("matic", "Sushiswap", "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", 18)
    // console.log(res)

    res = await ApproveTokenForDex("matic", "Uniswap", "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", 18, "WETH", 1000);
    res = await ApproveTokenForDex("matic", "Quickswap", "0x2791bca1f2de4661ed88a30c99a7a9449aa84174", 6, "USDC", 1000)
    res = await ApproveTokenForDex("matic", "Sushiswap", "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", 18, "WETH", 1)
    //console.log("Txn Status: " + res.status)
    //console.log("Txn Hash: " + res.transactionHash)

    //$$$ Token Balance on Wallet
    res = await GetTokenBalanceOnWallet ('matic', C.WalletAddress, '0xd6df932a45c0f255f85145f286ea0b292b21c90b', 18)
    res = await GetTokenBalanceOnWallet ('matic', C.WalletAddress, T.MATIC.WETH.tokenId, T.MATIC.WETH.decimals)
    //console.log(res)

    //res = await GetTokenDecimals('matic', '0xd6df932a45c0f255f85145f286ea0b292b21c90b')
    //console.log(res)
    //const status = await GetTransactionStatus('matic', '0x6328c899a61f445c0c10cb25cd108bb12b871528872b899723cf690f84462d37')
    //console.log(status)
    res = await tokenPrice.GetTokenPrices("matic")
    //console.log(res)

    //$$$ Trade
    //### Error: Fail with error 'TransferHelper: TRANSFER_FROM_FAILED' => Token needs approval
    res = await UNI_MainTrade("matic", "0x45dda9cb7c25131df268515131f647d726f50608", C.WETH, C.USDC, 0.0005)
    //console.log("UNI WETH => USDC: " + res)
    res = await UNI_MainTrade("matic", "0x45dda9cb7c25131df268515131f647d726f50608", C.USDC, C.WETH, 1)
    //console.log("UNI USDC => WETH: " + res)

    res = await ExecuteQSSushiTrade("matic", C.Quickswap, "0x853ee4b2a13f8a742d64c8f088be7ba2131f670d", C.USDC, C.WETH, 1, 6, 18)
    //console.log("QS USDC => WETH: " + res)
    res = await ExecuteQSSushiTrade("matic", C.Quickswap, "0x853ee4b2a13f8a742d64c8f088be7ba2131f670d", C.WETH, C.USDC, 0.0005, 18, 6)
    //console.log("QS WETH => USDC: " + res)

    res = await ExecuteQSSushiTrade("matic", C.Sushiswap, "0x853ee4b2a13f8a742d64c8f088be7ba2131f670d", C.USDC, C.WETH, 1, 6, 18)
    // console.log("SUSHI USDC => WETH: " + res)
    res = await ExecuteQSSushiTrade("matic", C.Sushiswap, "0x853ee4b2a13f8a742d64c8f088be7ba2131f670d", C.WETH, C.USDC, 0.0005, 18, 6)
    // console.log("SUSHI WETH => USDC: " + res)
}

InitAndTest()

app.get("/", async (req, res) => {
    const today = new Date()
    const time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds()
    res.send("Time: " + time)
})

const port = 5000

app.listen(port, () => {
    //console.log(`Server started on port ${port}`)
})
