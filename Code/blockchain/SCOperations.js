const QSSDK = require("quickswap-sdk")
const UNIV3SDK = require("@uniswap/v3-sdk")
const UNISDKCORE = require("@uniswap/sdk-core")
const univ3prices = require("@thanpolas/univ3prices")
const Sushi = require("@sushiswap/sdk")
const { ethers, BigNumber, utils } = require("ethers")
const JSBI = require("jsbi")

const { Token, Currency, CurrencyAmount, TradeType, Percent } = require("@uniswap/sdk-core")
const { Pool: UniV3Pool, Route: UniV3Route, Trade: UniV3Trade, SwapRouter: UniV3SwapRouter } = require("@uniswap/v3-sdk")
const { abi: UniV2PairABI } = require("@uniswap/v2-core/build/IUniswapV2Pair.json")
const { abi: QuoterABI } = require("@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json")
const { abi: UniV3PoolABI } = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json")

const { errLog, infoLog } = require("../logger")
const C = require("../config/const")
const providers = require("../config/providers")
const DB = require("../helpers/dbOperations")
const UNISWAP = require("./uniswap")

//global variables
const deadline = C.Deadline
const myWallet = C.WalletAddress
const gasLimit = C.GasLimit
let currentNonce = 0

//********************************** GET PRICE DATA *******************************************

GetPriceDataForMatchingPair = async (network, matchingPair) => {
    try {
        const [d0T0, d0T1, d1T0, d1T1] = GetTokenPairsForBothDexes(matchingPair)
        let [dex0T0T1Price, dex0T1T0Price, dex1T0T1Price, dex1T1T0Price] = [0, 0, 0, 0]
        const t0Addr = matchingPair.token0.id
        const t1Addr = matchingPair.token1.id
        const t0Dec = matchingPair.token0.decimals
        const t1Dec = matchingPair.token1.decimals
        const dex0 = matchingPair.dex0.name
        const dex1 = matchingPair.dex1.name
        const dex0PoolId = matchingPair.dex0.pairId
        const dex1PoolId = matchingPair.dex1.pairId
        const dex0Fee = matchingPair.dex0.feeTier
        const dex1Fee = matchingPair.dex1.feeTier

        if (dex0 === C.Uniswap) {
            dex0T0T1Price = await UNISWAP.UNI_GetV3QuotesForUnadjusted(network, dex0PoolId, t0Addr, t1Addr, 1, t0Dec, t1Dec, dex0Fee)
            dex0T1T0Price = await UNISWAP.UNI_GetV3QuotesForUnadjusted(network, dex0PoolId, t1Addr, t0Addr, 1, t1Dec, t0Dec, dex0Fee)
        } else {
            dex0T0T1Price = await GetTokenPriceForDex(network, dex0, d0T0, d0T1, 1, dex0PoolId)
            dex0T1T0Price = await GetTokenPriceForDex(network, dex0, d0T1, d0T0, 1, dex0PoolId)
        }

        if (dex1 === C.Uniswap) {
            dex1T0T1Price = await UNISWAP.UNI_GetV3QuotesForUnadjusted(network, dex1PoolId, t0Addr, t1Addr, 1, t0Dec, t1Dec, dex1Fee)
            dex1T1T0Price = await UNISWAP.UNI_GetV3QuotesForUnadjusted(network, dex1PoolId, t1Addr, t0Addr, 1, t1Dec, t0Dec, dex1Fee)
        } else {
            dex1T0T1Price = await GetTokenPriceForDex(network, dex1, d1T0, d1T1, 1, dex1PoolId)
            dex1T1T0Price = await GetTokenPriceForDex(network, dex1, d1T1, d1T0, 1, dex1PoolId)
        }

        if (dex0T0T1Price == null || dex0T1T0Price == null || dex1T0T1Price == null || dex1T1T0Price == null) {
            errLog.error(`FAILURE :: GetPriceDataForMatchingPair: ${network} --- Could not get price data for one or both tokens`)
            console.log("ERROR - GetPriceDataForMatchingPair: Could not get price data for one or both tokens")
            return null
        } else {
            //get best trade
            let diffPercent = 0
            let [diff1, diff2] = [0, 0]
            let bestTrade = ""

            let res1 = 1 - dex1T1T0Price * dex0T0T1Price
            //### delete this
            //res1 = -0.1
            if (res1 < 0) {
                diff1 = Math.abs(res1) * 100
            } else {
                diff1 = res1 * -100
            }

            let res2 = 1 - dex1T0T1Price * dex0T1T0Price
            if (res2 < 0) {
                diff2 = Math.abs(res2) * 100
            } else {
                diff2 = res2 * -100
            }

            if (diff1 > 0 || diff2 > 0) {
                if (diff1 > diff2) {
                    diffPercent = diff1
                    bestTrade = [
                        {
                            dex: dex0,
                            tokenFromAddr: t0Addr,
                            tokenFromDec: t0Dec,
                            tokenToAddr: t1Addr,
                            tokenToDec: t1Dec,
                        },
                        {
                            dex: dex1,
                            tokenFromAddr: t1Addr,
                            tokenFromDec: t1Dec,
                            tokenToAddr: t0Addr,
                            tokenToDec: t0Dec,
                        },
                    ]
                } else {
                    diffPercent = diff2
                    bestTrade = [
                        {
                            dex: dex0,
                            tokenFromAddr: t1Addr,
                            tokenFromDec: t1Dec,
                            tokenToAddr: t0Addr,
                            tokenToDec: t0Dec,
                        },
                        {
                            dex: dex1,
                            tokenFromAddr: t0Addr,
                            tokenFromDec: t0Dec,
                            tokenToAddr: t1Addr,
                            tokenToDec: t1Dec,
                        },
                    ]
                }
            } else {
                diffPercent = Math.max(diff1, diff2)
            }

            if (bestTrade != "") {
                bestTrade = JSON.stringify(bestTrade)
            }

            console.log(diffPercent)

            const priceData = {
                dex0T0T1Price: parseFloat(dex0T0T1Price),
                dex0T1T0Price: parseFloat(dex0T1T0Price),
                dex1T0T1Price: parseFloat(dex1T0T1Price),
                dex1T1T0Price: parseFloat(dex1T1T0Price),
                bestTrade,
                diffPercent,
            }

            return priceData
        }
    } catch (err) {
        errLog.error(`ERROR :: GetPriceDataForMatchingPair: ${network} --- Error: ${err.message}`)
        console.log("Error - GetPriceDataForMatchingPair: " + err.message)
        return null
    }
}

GetTokenPriceForDex = async (network, dex, tokenFrom, tokenTo, amount, pairId) => {
    const provider = GetProviderForNetwork(network)

    try {
        const adjustedAmount = amount * 10 ** tokenFrom.decimals
        let [pair, route, trade] = [null, null, null]

        if (dex == C.Quickswap || dex == C.Sushiswap) {
            ;[pair, route, trade] = await CreateTradeObjectForDex(network, dex, tokenFrom, tokenTo, adjustedAmount, pairId)
            // } else if (dex == C.Uniswap) {
            //     //use UNI_GetV3QuotesForUnadjusted
            //     const poolContract = new ethers.Contract(pairId, UniV3PoolABI, provider)
            //     const slot0 = await poolContract.slot0()
            //     //seems like there is a bug in the library => we need to reverse the token price to get the ration for TokenFrom/TokenTo
            //     const priceToken0 = univ3prices([tokenFrom.decimals, tokenTo.decimals], slot0[0]).toAuto({ reverse: false })
            //     //console.log("Uni Price: " + priceToken0);
            //     return priceToken0
        } else {
            errLog.error(`FAILURE :: GetTokenPriceForDex: DEX: ${dex} is currently not supported`)
            console.log("ERROR - GetTokenPriceForDex: Add additional exchanges")
            return null
        }

        //console.log("Mid Price WETH --> DAI:", route.midPrice.toSignificant(6))
        //console.log("Mid Price DAI --> WETH:", route.midPrice.invert().toSignificant(6))

        if (trade.executionPrice.toSignificant(6) > 1) return trade.executionPrice.toFixed(2)
        else return trade.executionPrice.toSignificant(6)
    } catch (err) {
        errLog.error(`ERROR :: GetTokenPriceForDex: ${network} - ${dex} : TokenFrom: ${tokenFrom}, TokenTo: ${tokenTo} --- Error: ${err.message}`)
        console.log("Error - GetTokenPriceForDex: " + err.message)
        return null
    }
}

GetGasFees = async (network) => {
    try {
        const provider = GetProviderForNetwork(network)
        //https://github.com/ethers-io/ethers.js/issues/1610 => Keep in mind gasPrice and maxFeePerGas are incompatible. You cannot use both
        const gasFees = await provider.getFeeData()
        // console.log("Max Fee: " + ethers.utils.formatUnits(gasFees.maxFeePerGas, "gwei"))

        let maxFee = ethers.BigNumber.from(gasFees.maxFeePerGas)
        let maxPriorityFee = ethers.BigNumber.from(gasFees.maxPriorityFeePerGas)

        const minGasFee = C.MinGasFeeMaticInWei //min gas fee in GWEI
        //take a security margin to avoid long running txn
        if (minGasFee.gt(maxFee.mul(2))) {
            maxFee = minGasFee
        } else {
            maxFee = maxFee.mul(2)
        }

        //### make the maxPriorityFeePerGas 20% ??? lower than maxFeePerGas
        maxPriorityFee = ethers.BigNumber.from(maxFee - maxFee * 0.2)

        return {
            maxFeePerGas: maxFee,
            maxPriorityFeePerGas: maxPriorityFee,
        }
    } catch (err) {
        console.log("Error - GetGasFees: " + err.message)
        errLog.error(`GetGasFees: ${network} *** ERROR: ${err.message}`)
        return null
    }
}

GetCurrentNonce = async (network) => {
    try {
        const provider = GetProviderForNetwork(network)
        let nonce = await provider.getTransactionCount(myWallet)
        if (nonce === currentNonce) {
            nonce += 1
            console.log("!!! Increased Current Nonce !!!")
        }
        currentNonce = nonce

        return nonce
    } catch (err) {
        console.log("Error - GetCurrentNonce: " + err.message)
        errLog.error(`GetCurrentNonce: ${network} *** ERROR: ${err.message}`)
        return null
    }
}

//********************************** Token Approval *******************************************

ApproveTokenForDex = async (network, dex, tokenId, decimals, symbol, amountToApprove) => {
    const provider = GetProviderForNetwork(network)
    const routerAddr = GetRouterAddressForDex(network, dex)
    const signerAccount = GetSignerAccount(network)
    let txn = null

    const erc20ApproveABI = ["function approve(address spender, uint value) external returns (bool)"]

    try {
        let gasFees = await GetGasFees(network)
        const tokenContract = new ethers.Contract(utils.getAddress(tokenId), erc20ApproveABI, signerAccount)
        const maxApprove = QSSDK.JSBI.BigInt(amountToApprove * 10 ** decimals)

        txn = await tokenContract.approve(routerAddr, String(maxApprove), {
            maxFeePerGas: gasFees.maxFeePerGas,
            maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas,
        })

        let txnHash = txn ? txn.hash : "No Txn Hash"
        infoLog.info(`ApproveTokenForDex: ${network} - ${dex} - ${tokenId} --- Hash: ${txnHash}`)
        const receipt = await txn.wait()

        if (receipt.status == 1) {
            await DB.AddApprovedToken(network, dex, tokenId, symbol, amountToApprove)
            await DB.AddTransaction(receipt.transactionHash, network, C.TransactionType.Approve)
        } else {
            errLog.error(`FAILURE :: ApproveTokenForDex: ${network} - ${dex} - ${tokenId} --- Hash: ${txnHash}`)
        }

        return receipt
    } catch (err) {
        let txnHash = txn ? txn.hash : "No Txn Hash"
        errLog.error(`ApproveTokenForDex: ${network} - ${dex} - ${tokenId} --- Hash: ${txnHash} *** ERROR: ${err.message}`)
        console.log("Error - ApproveTokenForDex: " + err.message)
        return null
    }
}

GetAllowanceForToken = async (network, dex, tokenId, decimals) => {
    const provider = GetProviderForNetwork(network)
    const router = GetRouterAddressForDex(network, dex)
    const erc20AllowanceABI = ["function allowance(address owner, address spender) external view returns (uint256)"]

    try {
        const tokenContract = new ethers.Contract(ethers.utils.getAddress(tokenId), erc20AllowanceABI, provider)

        let myAllowance = await tokenContract.allowance(C.WalletAddress, router)

        myAllowance = QSSDK.JSBI.BigInt(myAllowance) / QSSDK.JSBI.BigInt(10 ** decimals)
        return myAllowance
    } catch (err) {
        console.log("Error - GetAllowanceForToken: " + err.message)
        errLog.error(`ApproveTokenForDex: ${network} - ${dex} - ${tokenId} *** ERROR: ${err.message}`)
        return null
    }
}

GetTokenBalanceOnWallet = async (network, walletAddress, tokenId, decimals) => {
    const provider = GetProviderForNetwork(network)
    const erc20BalanceABI = ["function balanceOf(address account) external view returns (uint256)"]

    try {
        const tokenContract = new ethers.Contract(ethers.utils.getAddress(tokenId), erc20BalanceABI, provider)

        let mybalance = await tokenContract.balanceOf(C.WalletAddress)

        mybalance = QSSDK.JSBI.BigInt(mybalance) / QSSDK.JSBI.BigInt(10 ** decimals)
        return mybalance
    } catch (err) {
        console.log("Error - GetTokenBalanceOnWallet: " + err.message)
        errLog.error(`ApproveTokenForDex: ${network} - ${tokenId} *** ERROR: ${err.message}`)
        return null
    }
}

GetTokenDecimals = async (network, tokenId) => {
    const provider = GetProviderForNetwork(network)
    const erc20DecimalsABI = ["function decimals() view returns (uint8)"]

    try {
        const tokenContract = new ethers.Contract(ethers.utils.getAddress(tokenId), erc20DecimalsABI, provider)

        return await tokenContract.decimals()
    } catch (err) {
        console.log("Error - GetTokenDecimals: " + err.message)
        errLog.error(`ApproveTokenForDex: ${network} - ${tokenId} *** ERROR: ${err.message}`)
        return 0
    }
}

GetTransactionStatus = async (network, txnId) => {
    const provider = GetProviderForNetwork(network)
    try {
        const txn = await provider.getTransactionReceipt(txnId)
        if (txn) return txn.status
        else return null
    } catch (err) {
        console.log("Error - GetTransactionStatus: " + err.message)
        errLog.error(`ApproveTokenForDex: ${network} --- Hash: ${txnId} *** ERROR: ${err.message}`)
        return 0
    }
}

//********************************* Trade Tokens *********************************************

ExecuteQSSushiTrade = async (network, dex, poolAddress, t0, t1, amount, d0 = 0, d1 = 0) => {
    let txnHash
    try {
        let [pair, route, trade] = [null, null, null]
        const td = await PrepareTradeDataSCOps(network, dex, poolAddress, t0, t1, amount, d0, d1)
        if (td === null) {
            return null
        }

        if (dex == C.Quickswap || dex == C.Sushiswap) {
            ;[pair, route, trade] = await CreateTradeObjectForDex(network, dex, td.token0, td.token1, td.amountIn, poolAddress)
        } else {
            errLog.error(`FAILURE :: ExecuteQSSushiTrade: DEX: ${dex} is currently not supported`)
            console.log("ERROR - ExecuteQSSushiTrade: Add additional exchanges")
            return null
        }

        let amountOutMin
        let amountIn
        if (dex == C.Sushiswap) {
            amountIn = String(trade.inputAmount.toExact() * 10 ** td.d0)
            //### for certain trades, this is not working
            //amountOutMin = String(trade.minimumAmountOut(td.slippageTolerance).toExact())
            amountOutMin = String(0)
        } else {
            amountIn = String(trade.inputAmount.raw)
            amountOutMin = String(trade.minimumAmountOut(td.slippageTolerance).raw)
        }

        const swapTokenABI = [
            "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
        ]
        const routerContract = new ethers.Contract(td.routerAddr, swapTokenABI, td.signer)

        txn = await routerContract.swapExactTokensForTokens(amountIn, amountOutMin, td.path, myWallet, deadline, {
            gasLimit,
            maxFeePerGas: td.maxFeePerGas,
            maxPriorityFeePerGas: td.maxPriorityFeePerGas,
            nonce: td.nonce,
        })

        console.log(txn.hash)
        txnHash = txn.hash ?? "No Txn Hash"
        infoLog.info(`ExecuteQSSushiTrade: Pool: ${poolAddress} - t0: ${t0} - t1: ${t1} - amount: ${amount} --- Hash: ${txnHash}`)
        const receipt = await txn.wait()

        if (receipt.status === 1) {
            await DB.AddTransaction(receipt.transactionHash, network, C.TransactionType.Trade)
            return C.SF.Success
        } else {
            errLog.error(`FAILURE :: ExecuteQSSushiTrade: Network: ${network} - Pool: ${poolAddress} - t0: ${t0} - t1: ${t1} - amountIn: ${amountIn} --- Hash: ${txnHash}`)
            return C.SF.Failure
        }
    } catch (err) {
        //### treat the following errors: processing response error => Infura not available??? => stop trading bot for a certain time ???
        console.log("Error - ExecuteQSSushiTrade: " + err.message.substr(0, 200))
        errLog.error(
            `FAILURE :: ExecuteQSSushiTrade: Network: ${network} - Pool: ${poolAddress} - t0: ${t0} - t1: ${t1} - amount: ${amount} --- 
                Hash: ${txnHash} *** ERROR: ${err.message}`
        )
        return C.SF.Failure
    }
}

PrepareTradeDataSCOps = async (network, dex, poolAddress, t0, t1, amountIn, dec0 = 0, dec1 = 0) => {
    try {
        const provider = GetProviderForNetwork(network)
        const signer = GetSignerAccount(network)
        const routerAddr = GetRouterAddressForDex(network, dex)

        let slippageTolerance
        if (dex === C.Quickswap) {
            slippageTolerance = C.SlippageToleranceQS
        } else if (dex === C.Sushiswap) {
            slippageTolerance = C.SlippageToleranceSushi
        } else {
            errLog.error(`FAILURE :: PrepareTradeDataSCOps: DEX: ${dex} is currently not supported`)
            console.log("ERROR - PrepareTradeDataSCOps: DEX: ${dex} is currently not supported")
            return null
        }

        let d0 = dec0
        if (d0 === 0) {
            d0 = await GetTokenDecimals(network, t0)
        }
        let d1 = dec1
        if (d1 === 1) {
            d1 = await GetTokenDecimals(network, t1)
        }
        if (d0 === 0 || d1 === 0) {
            return null
        }
        const adjustedAmountIn = String(amountIn * 10 ** d0)
        const nonce = await GetCurrentNonce(network)
        if (nonce === null) {
            return null
        }

        const token0 = CreateTokenObjectForDex(dex, t0, d0)
        const token1 = CreateTokenObjectForDex(dex, t1, d1)
        const path = [t0, t1]

        let gasFees = await GetGasFees(network)
        if (gasFees === null) {
            return null
        }

        return {
            provider,
            signer,
            routerAddr,
            token0,
            token1,
            d0,
            d1,
            path,
            amountIn: adjustedAmountIn,
            maxFeePerGas: gasFees.maxFeePerGas,
            maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas,
            slippageTolerance,
            nonce,
        }
    } catch (err) {
        //### treat the following errors:
        // processing response error => Infura not available??? => stop trading bot for a certain time ???
        console.log("Error - PrepareTradeDataSCOps: " + err.message)
        errLog.error(`PrepareTradeDataSCOps: ${network} - Pool: ${poolAddress} - T0: ${t0} - T1: ${t1} *** ERROR: ${err.message}`)
        return null
    }
}

//********************************* HELPER METHODS *********************************************

CreateTokenObjectForDex = (dex, tokenId, decimals) => {
    let token = null
    if (dex == C.Quickswap) {
        token = new QSSDK.Token(C.MaticChainId, ethers.utils.getAddress(tokenId), decimals)
    } else if (dex == C.Sushiswap) {
        token = new Sushi.Token(C.MaticChainId, ethers.utils.getAddress(tokenId), decimals)
    } else if (dex == C.Uniswap) {
        token = new UNISDKCORE.Token(C.MaticChainId, ethers.utils.getAddress(tokenId), decimals)
    } else {
        //### this case is not treated
        console.log("ERROR - CreateTokenObjectForDex: Add additional exchanges")
    }

    return token
}

CreateTradeObjectForDex = async (network, dex, tokenFrom, tokenTo, amount, pairId) => {
    let pair = null
    let route = null
    let trade = null

    const provider = GetProviderForNetwork(network)

    try {
        if (dex == C.Quickswap) {
            pair = await QSSDK.Fetcher.fetchPairData(tokenFrom, tokenTo, provider)
            route = new QSSDK.Route([pair], tokenFrom)
            trade = new QSSDK.Trade(route, new QSSDK.TokenAmount(tokenFrom, amount), QSSDK.TradeType.EXACT_INPUT)
        } else if (dex == C.Sushiswap) {
            ;[r0, r1] = await GetReservesForPair(network, pairId, tokenFrom)
            pair = new Sushi.Pair(Sushi.CurrencyAmount.fromRawAmount(tokenFrom, r0), Sushi.CurrencyAmount.fromRawAmount(tokenTo, r1))
            route = new Sushi.Route([pair], tokenFrom, tokenTo)
            const currAmount = Sushi.CurrencyAmount.fromRawAmount(tokenFrom, amount) //10 ** tokenFrom.decimals)
            trade = new Sushi.Trade(route, currAmount, Sushi.TradeType.EXACT_INPUT)
        } else {
            errLog.error(`FAILURE :: CreateTradeObjectForDex: DEX: ${dex} is currently not supported`)
            console.log("ERROR - CreateTradeObjectForDex: Add additional exchanges")
            return null
        }
        return [pair, route, trade]
    } catch (err) {
        console.log("Error - CreateTradeObjectForDex: " + err.message)
        return null
    }
}

GetTokenPairsForBothDexes = (matchingPair) => {
    let d0T0 = null,
        d0T1 = null,
        d1T0 = null,
        d1T1 = null

    //create token objects for dex0
    if (matchingPair.dex0.name == C.Quickswap) {
        d0T0 = CreateTokenObjectForDex(C.Quickswap, matchingPair.token0.id, parseInt(matchingPair.token0.decimals))
        d0T1 = CreateTokenObjectForDex(C.Quickswap, matchingPair.token1.id, parseInt(matchingPair.token1.decimals))
    } else if (matchingPair.dex0.name == C.Sushiswap) {
        d0T0 = CreateTokenObjectForDex(C.Sushiswap, matchingPair.token0.id, parseInt(matchingPair.token0.decimals))
        d0T1 = CreateTokenObjectForDex(C.Sushiswap, matchingPair.token1.id, parseInt(matchingPair.token1.decimals))
    } else if (matchingPair.dex0.name == C.Uniswap) {
        d0T0 = CreateTokenObjectForDex(C.Uniswap, matchingPair.token0.id, parseInt(matchingPair.token0.decimals))
        d0T1 = CreateTokenObjectForDex(C.Uniswap, matchingPair.token1.id, parseInt(matchingPair.token1.decimals))
    } else {
        errLog.error(`FAILURE :: GetTokenPairsForBothDexes: DEX doesn't exist: ${matchingPair.dex0.name}`)
        //console.log("ERROR - GetTokenPairsForBothDexes: Add additional exchanges");
        return null
    }

    //create token objects for dex1
    if (matchingPair.dex1.name == C.Quickswap) {
        d1T0 = CreateTokenObjectForDex(C.Quickswap, matchingPair.token0.id, parseInt(matchingPair.token0.decimals))
        d1T1 = CreateTokenObjectForDex(C.Quickswap, matchingPair.token1.id, parseInt(matchingPair.token1.decimals))
    } else if (matchingPair.dex1.name == C.Sushiswap) {
        d1T0 = CreateTokenObjectForDex(C.Sushiswap, matchingPair.token0.id, parseInt(matchingPair.token0.decimals))
        d1T1 = CreateTokenObjectForDex(C.Sushiswap, matchingPair.token1.id, parseInt(matchingPair.token1.decimals))
    } else if (matchingPair.dex1.name == C.Uniswap) {
        d1T0 = CreateTokenObjectForDex(C.Uniswap, matchingPair.token0.id, parseInt(matchingPair.token0.decimals))
        d1T1 = CreateTokenObjectForDex(C.Uniswap, matchingPair.token1.id, parseInt(matchingPair.token1.decimals))
    } else {
        errLog.error(`FAILURE :: GetTokenPairsForBothDexes: DEX doesn't exist: ${matchingPair.dex1.name}`)
        return null
    }

    return [d0T0, d0T1, d1T0, d1T1]
}

//Required for Sushiswap
GetReservesForPair = async (network, pairAddress, tokenFrom) => {
    const provider = GetProviderForNetwork(network) // providers.MaticProvider();
    try {
        const [r0, r1] = await new ethers.Contract(pairAddress, UniV2PairABI, provider).getReserves()

        if (r0 && r1) {
            //we need to invert r0 and r1 if tokenFrom === pair.token1
            const t0Addr = await DB.GetToken0AddressForPair(network, C.Sushiswap, pairAddress)
            if (t0Addr && utils.getAddress(tokenFrom.address) != utils.getAddress(t0Addr)) {
                return [r1, r0]
            }
            return [r0, r1]
        } else {
            console.log("Error - GetReservesForPair: There was a problem fetching reserves for pair: " + pairAddress)
            return null
        }
    } catch (err) {
        console.log("Error - GetReservesForPair: " + err.message)
        return null
    }
}

GetRouterAddressForDex = (network, dex) => {
    if (network == C.MaticNetwork) {
        if (dex == C.Quickswap) {
            return C.QSRouter
        } else if (dex == C.Sushiswap) {
            return C.SushiRouter
        } else if (dex == C.Uniswap) {
            return C.UniRouter
        } else {
            console.log("ERROR - GetRouterAddressForDex: Add additional dexes")
            return null
        }
    } else {
        console.log("ERROR - GetRouterAddressForDex: Add additional networks")
        return null
    }
}

GetMinGasFeeForNetwork = (network) => {
    if (network == C.MaticNetwork) {
        return C.MinGasFeeMaticGWEI
    } else {
        console.log("ERROR - GetMinGasFeeForNetwork: Add additional networks")
        return null
    }
}

GetChainIdForNetwork = (network) => {
    if (network == C.MaticNetwork) {
        return C.MaticChainId
    } else if (network == C.RinkebyNetwork) {
        return C.RinkebyChainId
    } else if (network == C.RopstenNetwork) {
        return C.RopstenChainId
    } else {
        console.log("ERROR - GetChainIdForNetwork: Add additional networks")
        return null
    }
}

GetProviderForNetwork = (network) => {
    if (network == C.MaticNetwork) {
        return providers.MaticProvider()
    } else if (network == C.RinkebyNetwork) {
        return providers.RinkebyProvider()
    } else if (network == C.RopstenNetwork) {
        return providers.RopstenProvider()
    } else {
        console.log("ERROR - GetProviderForNetwork: Add additional networks")
        return null
    }
}

GetSignerAccount = (network) => {
    const provider = GetProviderForNetwork(network)
    const wallet = new ethers.Wallet(C.PKEY)
    return wallet.connect(provider)
}

module.exports = {
    GetTokenPriceForDex,
    GetPriceDataForMatchingPair,
    GetGasFees,
    GetCurrentNonce,
    GetReservesForPair,
    ApproveTokenForDex,
    GetAllowanceForToken,
    GetTokenDecimals,
    GetTransactionStatus,
    GetProviderForNetwork,
    GetSignerAccount,
}
