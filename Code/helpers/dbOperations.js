const { errLog, infoLog } = require("../logger")
const mongoose = require("mongoose")
const C = require("../config/const")
require("../models/Pairs")
require("../models/MatchingPairs")
require("../models/ApprovedTokens")
require("../models/Transactions")

const Pair = mongoose.model("pairs")
const MatchingPair = mongoose.model("matchingPairs")
const ApprovedToken = mongoose.model("approvedTokens")
const Transaction = mongoose.model("transactions")

//****************************** DELETE **************************************

DeleteAllPairsAndMatchingPairsForNetwork = async (network) => {
    await Pair.deleteMany({ network })
    await MatchingPair.deleteMany({ network })
}

DeletePairsFromNetworkAndDex = async (network, dex) => {
    await Pair.deleteMany({ network, dex })
}

DeleteMatchingPairsFromNetworkAndDex = async (network, dex0, dex1) => {
    await MatchingPair.deleteMany({ network, "dex0.name": dex0, "dex1.name": dex1 })
}

DeleteApprovedTokens = async (network, dex) => {
    if (dex && network) await ApprovedToken.deleteMany({ network, dex })
    else if (dex && !network) await ApprovedToken.deleteMany({ dex })
    else if (network && !dex) await ApprovedToken.deleteMany({ network })
    else await ApprovedToken.deleteMany()
}

DeleteTransactions = async (network) => {
    if (network) await Transaction.deleteMany({ network })
    else await Transaction.deleteMany({})
}

//****************************** GET **************************************

GetAllPairsForNetworkAndDex = async (network, dex) => {
    return await Pair.find({ network, dex })
}

GetAllMatchingPairsForNetwork = async (network) => {
    return await MatchingPair.find({ network })
}

GetAllMatchingPairsForNetworkndDexes = async (network, dex0, dex1) => {
    return await MatchingPair.find({ network, "dex0.name": dex0, "dex1.name": dex1 })
}

GetAllApprovedTokens = async (network, dex) => {
    return await ApprovedToken.find({ network, dex })
}

GetAllTransactions = async (network) => {
    return await Transaction.find({ network })
}

GetToken0AddressForPair = async (network, dex, pairAddress) => {
    const p = await Pair.findOne({ network, dex, id: pairAddress })
    if (p) {
        return p.token0.id
    } else {
        return null
    }
}

//****************************** ADD/CREATE **************************************
AddMatchingPairsForNetworkAndDexToDB = async (network, dex0, dex1) => {
    const pairsDex0 = await GetAllPairsForNetworkAndDex(network, dex0)
    const pairsDex1 = await GetAllPairsForNetworkAndDex(network, dex1)
    const allMatchingPairsForDexesAndNetwork = await MatchingPair.find({ network, "dex0.name": dex0, "dex1.name": dex1 })

    if (pairsDex0 && pairsDex1) {
        for (const p1 of pairsDex0) {
            const t0Id = p1.token0.id
            const t1Id = p1.token1.id
            const pairIdDex0 = p1.id
            const feeTierDex0 = p1.feeTier

            //compare both pairs (tokens) and verify if there is a match
            const foundPairDex1 = pairsDex1.find((el) => {
                return (el.token0.id === t0Id || el.token1.id === t0Id) && (el.token0.id === t1Id || el.token1.id === t1Id)
            })

            if (foundPairDex1) {
                //verify if the matching pair is already in the DB
                const mpFoundInDB = allMatchingPairsForDexesAndNetwork.find((el) => {
                    return (el.token0.id === t0Id || el.token1.id === t0Id) && (el.token0.id === t1Id || el.token1.id === t1Id)
                })

                if (!mpFoundInDB) {
                    const pairIdDex1 = foundPairDex1.id
                    const feeTierDex1 = foundPairDex1.feeTier
                    //add the pair/token info to our matching pairs table
                    const newMatchingPair = {
                        network: network,
                        dex0: {
                            pairId: pairIdDex0,
                            name: dex0,
                            feeTier: feeTierDex0,
                        },
                        dex1: {
                            pairId: pairIdDex1,
                            name: dex1,
                            feeTier: feeTierDex1,
                        },
                        token0: {
                            id: p1.token0.id,
                            symbol: p1.token0.symbol,
                            name: p1.token0.name,
                            decimals: p1.token0.decimals,
                        },
                        token1: {
                            id: p1.token1.id,
                            symbol: p1.token1.symbol,
                            name: p1.token1.name,
                            decimals: p1.token1.decimals,
                        },
                    }

                    const matchingPairAdded = await new MatchingPair(newMatchingPair).save()
                    console.log("MatchingPair added:" + matchingPairAdded.token0.symbol + " - " + matchingPairAdded.token1.symbol)
                }
            }
        }
    } else {
        console.log("ERROR - FindMatchingPairsForNetwork :: Either one or both pairs are empty")
    }
}

AddPairsForNetworkAndDexToDB = async (pairs, network, dex) => {
    //get all pairs for current network & dex
    const allPairsForDexAndNetwork = await Pair.find({ network, dex })

    if (pairs) {
        //await does not work in forEach loop => if the array elements should be read in sequence, a for..of loop must be used
        //https://stackoverflow.com/questions/37576685/using-async-await-with-a-foreach-loop && https://zellwk.com/blog/async-await-in-loops/
        for (const p of pairs) {
            //console.log(p)

            //verify if this token has already been added => add pair only if it doesn't already exist: id, network, dex
            const found = allPairsForDexAndNetwork.find((el) => {
                return el.network === network && el.dex === dex && el.id === p.id
            })

            const valid = ValidatePair(p, dex)

            //console.log(found)
            if (!found && valid) {
                let reserveETH = 0
                let feeTier = 0
                if (dex == C.Uniswap) {
                    reserveETH = p.totalValueLockedETH
                    feeTier = p.feeTier
                } else reserveETH = p.trackedReserveETH

                const newPair = {
                    id: p.id,
                    network,
                    trackedReserveETH: reserveETH,
                    feeTier,
                    dex,
                    token0: {
                        id: p.token0.id,
                        symbol: p.token0.symbol,
                        name: p.token0.name,
                        decimals: p.token0.decimals,
                    },
                    token1: {
                        id: p.token1.id,
                        symbol: p.token1.symbol,
                        name: p.token1.name,
                        decimals: p.token1.decimals,
                    },
                }

                const pairAdded = await new Pair(newPair).save()
                //console.log('Pair added:' + pairAdded.id)
            }
        }
    } else {
        console.log("Pairs are undefined")
    }
}

AddTransaction = async (transactionId, network, typeOfTransaction) => {
    const newTransaction = {
        transactionId,
        network,
        typeOfTransaction,
    }
    return await new Transaction(newTransaction).save()
}

AddApprovedToken = async (network, dex, tokenId, symbol, amount) => {
    const foundApprToken = await ApprovedToken.findOne({ network, dex, tokenId })

    if (!foundApprToken) {
        const newApprToken = {
            network,
            dex,
            tokenId,
            symbol,
            amount,
        }
        return await new ApprovedToken(newApprToken).save()
    }
    return null
}

//****************************** UPDATE **************************************

UpdatePriceDataForMatchingPair = async (matchingPairId, priceData) => {
    try {
        const matchingPair = await MatchingPair.findById(matchingPairId)
        if (matchingPair) {
            matchingPair.dex0.T0T1Price = priceData.dex0T0T1Price
            matchingPair.dex0.T1T0Price = priceData.dex0T1T0Price
            matchingPair.dex1.T0T1Price = priceData.dex1T0T1Price
            matchingPair.dex1.T1T0Price = priceData.dex1T1T0Price
            matchingPair.bestTrade = priceData.bestTrade
            matchingPair.diffPercent = priceData.diffPercent
            await matchingPair.save()
        } else {
            console.log("Error - UpdatePriceDataForMatchingPair: No matching pair was found for the id: " + matchingPairId)
        }
    } catch (err) {
        //### write to DB
        console.log("Error - UpdatePriceDataForMatchingPair: " + err.message)
        return null
    }
}

//**************************************** PRIVATE ROUTINES *********************************************

const ValidatePair = (pair, dex) => {
    const t0Addr = pair.token0.id
    const t0Symbol = pair.token0.symbol
    const t1Addr = pair.token1.id
    const t1Symbol = pair.token1.symbol

    //reserve must be bigger than 100 ETH
    let reserveETH = 0
    if (dex == C.Uniswap) reserveETH = pair.totalValueLockedETH
    else reserveETH = pair.trackedReserveETH

    if (reserveETH < C.MinReserveETH) return false

    //neiter tO nor t1 must be in forbidden list: ForbiddenTokenSymbols
    if (C.ForbiddenTokenSymbols.includes(t0Symbol) || C.ForbiddenTokenSymbols.includes(t1Symbol)) return false

    //eiter tO or t1 must be in include list: MustIncludeTokens
    if (!C.MustIncludeTokens.includes(t0Addr) && !C.MustIncludeTokens.includes(t1Addr)) return false

    //a combination of stablecoins is not allowed: StableCoins
    if (C.StableCoins.includes(t0Symbol) && C.StableCoins.includes(t1Symbol)) return false

    //exclude all tokens that contain ETH, MATIC, USD and don't correspond with WETH, WMATIC, USDC, USDT addresses
    if (C.MustIncludeTokenSymbols.some((tok) => t0Symbol.toUpperCase().includes(tok)) && !C.MustIncludeTokens.includes(t0Addr)) return false

    if (C.MustIncludeTokenSymbols.some((tok) => t1Symbol.toUpperCase().includes(tok)) && !C.MustIncludeTokens.includes(t1Addr)) return false

    //exclude all tokens that contain BTC and don't correspond with WBTC addresses : 0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6
    if (
        (t0Symbol.toLowerCase().includes("btc") && t0Addr != "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6") ||
        (t1Symbol.toLowerCase().includes("btc") && t1Addr != "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6")
    )
        return false

    //exclude all tokens that contain EUR
    if (t0Symbol.toLowerCase().includes("eur") || t1Symbol.toLowerCase().includes("eur")) return false

    //all checks passed => return true
    return true
}

module.exports = {
    AddPairsForNetworkAndDexToDB,
    AddMatchingPairsForNetworkAndDexToDB,
    AddApprovedToken,
    AddTransaction,
    DeletePairsFromNetworkAndDex,
    DeleteMatchingPairsFromNetworkAndDex,
    GetAllPairsForNetworkAndDex,
    GetAllMatchingPairsForNetwork,
    GetAllMatchingPairsForNetworkndDexes,
    GetAllApprovedTokens,
    GetAllTransactions,
    UpdatePriceDataForMatchingPair,
    DeleteAllPairsAndMatchingPairsForNetwork,
    DeleteApprovedTokens,
    DeleteTransactions,
    GetToken0AddressForPair,
}
