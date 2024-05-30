const C = require("./config/const")
const DB = require("./helpers/dbOperations")
const mainRoutines = require("./mainRoutines")
const SCOperations = require("./blockchain/SCOperations")
const UNISWAP = require("./blockchain/uniswap")

const { errLog, infoLog } = require("./logger")
const mongoose = require("mongoose")
require("./models/Pairs")
require("./models/MatchingPairs")
const Pair = mongoose.model("pairs")
const MatchingPair = mongoose.model("matchingPairs")

//******************************* INIT **************************************

DeletePairsAndMatchingPairsFromDB = async () => {
    //### Delete Pair and MatchingPair collections
    await DB.DeletePairsFromNetworkAndDex(C.MaticNetwork, C.Quickswap)
    await DB.DeletePairsFromNetworkAndDex(C.MaticNetwork, C.Sushiswap)
    await DB.DeletePairsFromNetworkAndDex(C.MaticNetwork, C.Uniswap)

    await DB.DeleteMatchingPairsFromNetworkAndDex(C.MaticNetwork, C.Quickswap, C.Sushiswap)
    await DB.DeleteMatchingPairsFromNetworkAndDex(C.MaticNetwork, C.Quickswap, C.Uniswap)
    await DB.DeleteMatchingPairsFromNetworkAndDex(C.MaticNetwork, C.Sushiswap, C.Uniswap)
    console.log("CLEANUP DONE!")
}

GetPairsFromSubgraphAndAddToDB = async () => {
    //### Get specific pairs and add to DB
    await mainRoutines.AddPairsForNetworkAndDexToDB(C.QSSubgraph, C.PairsToRetrieve, C.MaticNetwork, C.Quickswap) //OK
    await mainRoutines.AddPairsForNetworkAndDexToDB(C.SushiSubgraph, C.PairsToRetrieve, C.MaticNetwork, C.Sushiswap) //OK
    await mainRoutines.AddPairsForNetworkAndDexToDB(C.UniSubgraph, C.PairsToRetrieve, C.MaticNetwork, C.Uniswap) //OK
    console.log("ADDING PAIRS DONE!")
}

GenerateMatchingPairs = async () => {
    //### Generate matching pairs
    await mainRoutines.AddMatchingPairsForNetworkAndDexToDB(C.MaticNetwork, C.Quickswap, C.Sushiswap) //OK
    await mainRoutines.AddMatchingPairsForNetworkAndDexToDB(C.MaticNetwork, C.Quickswap, C.Uniswap) //OK
    await mainRoutines.AddMatchingPairsForNetworkAndDexToDB(C.MaticNetwork, C.Sushiswap, C.Uniswap) //OK
    console.log("ADDING MATCHING PAIRS DONE!")
}

//******************************* TESTS **************************************

FetchPricesQSSushiUniForFirstPair = async () => {
    let [pair, priceData] = [null, null]
    //Quickswap
    //pair = await MatchingPair.findOne({ network: "matic", "dex0.name": C.Quickswap, "token0.symbol": "USDC" })
    pair = await MatchingPair.findOne({ network: "matic", "dex0.name": C.Quickswap, _id: "622bbb60b33d14dbae517321" })
    if (pair) {
        priceData = await GetPriceDataForMatchingPairAndUpdateDB("matic", pair)
        if (priceData) {
            console.log(`Prices for first QS pair(${pair.token0.symbol} - ${pair.token1.symbol}) : ${JSON.stringify(priceData)}`)
            //console.dir(priceData)
        } else {
            console.log(`Price data could not be fetched for pair: ${pair}`)
        }
    }

    //### test
    return

    //Sushiswap
    pair = await MatchingPair.findOne({ network: "matic", "dex0.name": C.Sushiswap, "token0.symbol": "USDC" })
    priceData = null
    //pair = await MatchingPair.findById('61fcff46ab2ae0e7f5755fab')
    if (pair) {
        priceData = await GetPriceDataForMatchingPairAndUpdateDB("matic", pair)
        if (priceData) {
            console.log(`Prices for first Sushiswap pair(${pair.token0.symbol} - ${pair.token1.symbol}) : ${JSON.stringify(priceData)}`)
        } else {
            console.log(`Price data could not be fetched for pair: ${pair}`)
        }
    }

    //Uniswap
    pair = await MatchingPair.findOne({ network: "matic", $or: [{ "dex0.name": "Uniswap" }, { "dex1.name": "Uniswap" }] })
    priceData = null
    if (pair) {
        priceData = await GetPriceDataForMatchingPairAndUpdateDB("matic", pair)
        if (priceData) {
            console.log(`Prices for first Uniswap pair(${pair.token0.symbol} - ${pair.token1.symbol}) : ${JSON.stringify(priceData)}`)
        } else {
            console.log(`Price data could not be fetched for pair: ${pair}`)
        }
    }
}

GetFirstPairForDex = async (dex) => {
    //UNI WETH-USDC pool
    return await Pair.findOne({ network: "matic", dex, id: "0x45dda9cb7c25131df268515131f647d726f50608" })
}

GetFirstMatchPairForDex = async (dex) => {
    //UNI WETH-USDC pool
    return await MatchingPair.findOne({ network: "matic", "dex1.name": dex, "dex1.pairId": "0x45dda9cb7c25131df268515131f647d726f50608" })
}

GetPriceQuotes = async () => {
    await GetQSPriceQuotes()
    console.log("-----------------------------------------")
    await GetSushiPriceQuotes()
    console.log("-----------------------------------------")
    await GetUNIPriceQuotes()
}

GetQSPriceQuotes = async () => {
    let t0 = CreateTokenObjectForDex(C.Quickswap, C.USDC, 6)
    let t1 = CreateTokenObjectForDex(C.Quickswap, C.WETH, 18)
    console.log("QS USDC => WETH : ")
    let price = await SCOperations.GetTokenPriceForDex("matic", C.Quickswap, t0, t1, 1000, "0x853ee4b2a13f8a742d64c8f088be7ba2131f670d") //QS
    console.log(price + " => Reciprocal: " + 1 / price)

    console.log("QS WETH => USDC : ")
    price = await SCOperations.GetTokenPriceForDex("matic", C.Quickswap, t1, t0, 0.36, "0x853ee4b2a13f8a742d64c8f088be7ba2131f670d") //QS
    console.log(price + " => Reciprocal: " + 1 / price)
}

GetSushiPriceQuotes = async () => {
    let t0 = CreateTokenObjectForDex(C.Sushiswap, C.USDC, 6)
    let t1 = CreateTokenObjectForDex(C.Sushiswap, C.WETH, 18)
    console.log("SUSHI USDC => WETH : ")
    let price = await SCOperations.GetTokenPriceForDex("matic", C.Sushiswap, t0, t1, 1000, "0x34965ba0ac2451a34a0471f04cca3f990b8dea27") //Sushi
    console.log(price + " => Reciprocal: " + 1 / price)

    console.log("SUSHI WETH => USDC : ")
    price = await SCOperations.GetTokenPriceForDex("matic", C.Sushiswap, t1, t0, 0.36, "0x34965ba0ac2451a34a0471f04cca3f990b8dea27") //Sushi
    console.log(price + " => Reciprocal: " + 1 / price)
}

GetUNIPriceQuotes = async () => {
    console.log("UNI USDC => WETH : ")
    let price = await UNISWAP.UNI_GetV3QuotesForUnadjusted("matic", "0x45dda9cb7c25131df268515131f647d726f50608", C.USDC, C.WETH, 1, 6, 18, 500)
    console.log(price + " => Reciprocal: " + 1 / price)

    console.log("UNI WETH => USDC : ")
    price = await UNISWAP.UNI_GetV3QuotesForUnadjusted("matic", "0x45dda9cb7c25131df268515131f647d726f50608", C.WETH, C.USDC, 1, 18, 6, 500)
    console.log(price + " => Reciprocal: " + 1 / price)
}

module.exports = {
    DeletePairsAndMatchingPairsFromDB,
    GetPairsFromSubgraphAndAddToDB,
    GenerateMatchingPairs,
    FetchPricesQSSushiUniForFirstPair,
    GetFirstPairForDex,
    GetPriceQuotes,
}
