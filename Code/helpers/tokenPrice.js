const NodeCache = require("node-cache")
const CoinGecko = require("coingecko-api")

const tokenList = require("../ABIs/Token_ID_Gecko.json")
const DB = require("./dbOperations")
const C = require("../config/const")

const myCache = new NodeCache({ stdTTL: 600 })

GetTokenPrices = async (network) => {
    let tokenObj = []

    try {
        //get all tokens from matching pairs
        const matchingPairs = await DB.GetAllMatchingPairsForNetwork(network)
        if (matchingPairs) {
            for (const mp of matchingPairs) {
                let found = tokenObj.find((t) => {
                    return t.symbol === mp.token0.symbol
                })

                if (!found) {
                    found = tokenList.find((t) => {
                        return t.symbol.toLowerCase() === mp.token0.symbol.toLowerCase()
                    })
                    if (found) {
                        tokenObj.push({ geckoId: found.id, address: mp.token0.id, symbol: mp.token0.symbol, priceUSD: 0, numberOfTokens: 0 })
                    }
                }

                found = tokenObj.find((t) => {
                    return t.symbol === mp.token1.symbol
                })

                if (!found) {
                    found = tokenList.find((t) => {
                        return t.symbol.toLowerCase() === mp.token1.symbol.toLowerCase()
                    })
                    if (found) {
                        tokenObj.push({ geckoId: found.id, address: mp.token1.id, symbol: mp.token1.symbol, priceUSD: 0, numberOfTokens: 0 })
                    }
                }
            }
        }

        //get token prices from gecko
        const geckoIds = tokenObj.map((t) => {
            return t.geckoId
        })
        const tokenPrices = await GetTokenValuesFromGecko(geckoIds)

        //update tokenObj with prices
        tokenObj.forEach((t) => {
            const price = tokenPrices[t.geckoId][C.TokenCurrency[0]]
            t.priceUSD = price
            t.numberOfTokens = C.MaxTradeAmountUSD / price
        })

        return tokenObj
    } catch (err) {
        console.log("Error - GetTokenPrices: " + err.message)
        errLog.error(`GetTokenPrices: ${network} *** ERROR: ${err.message}`)
        return null
    }
}

//https://github.com/miscavage/CoinGecko-API
GetTokenValuesFromGecko = async (geckoIds) => {
    try {
        let tokenPrices = myCache.get("allTokenPrices")

        if (tokenPrices == null) {
            //console.log("Fetch new token prices...")
            const CoinGeckoClient = new CoinGecko()
            tokenPrices = await CoinGeckoClient.simple.price({
                ids: geckoIds,
                vs_currencies: C.TokenCurrency,
            })
            myCache.set("allTokenPrices", tokenPrices, 2000)
        } else {
            //console.log("Get token prices from cache...")
        }

        return tokenPrices.data
    } catch (err) {
        console.log("Error - GetTokenValuesFromGecko: " + err.message)
        errLog.error(`GetTokenValuesFromGecko: ${network} *** ERROR: ${err.message}`)
        return null
    }
}

module.exports = {
    GetTokenPrices,
}
