const univ3prices = require("@thanpolas/univ3prices")
const { ethers, BigNumber, utils } = require("ethers")
const JSBI = require("jsbi")

const { Token, CurrencyAmount, TradeType, Percent } = require("@uniswap/sdk-core")
const { Pool: UniV3Pool, Route: UniV3Route, Trade: UniV3Trade, SwapRouter: UniV3SwapRouter } = require("@uniswap/v3-sdk")
const { AlphaRouter } = require("@uniswap/smart-order-router")
const { abi: UniQuoterABI } = require("@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json")
const { abi: UniV3PoolABI } = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json")
const IUniswapRouterABI = require("../ABIs/IUniSwapRouterABI.json")

const SCOps = require("./SCOperations")
const { errLog, infoLog } = require("../logger")
const C = require("../config/const")
const DB = require("../helpers/dbOperations")
const H = require("../helpers/generalHelpers")

//global variables
const deadline = C.Deadline
const slippageTolerance = C.SlippageToleranceUNI
const myWallet = C.WalletAddress
const gasLimit = C.GasLimit
let currentNonce = 0

//************************ Execute Trades **********************************************

UNI_MainTrade = async (network, poolAddress, t0, t1, amountIn) => {
    try {
        let res = await UNI_ExactInputSingleTrade(network, poolAddress, t0, t1, amountIn)

        if (res === C.SF.Failure) {
            //allow some time in order to get the updated nonce
            //await H.sleep(20000)
            res = await UNI_AlphaRouterMulticallTrade(network, poolAddress, t0, t1, amountIn)
        }
        return res
    } catch (err) {
        console.log("Error - UNI_MainTrade: " + err.message)
        errLog.error(`FAILURE :: UNI_MainTrade: Network: ${network} - Pool: ${poolAddress} - t0: ${t0} - t1: ${t1} - amountIn: ${amountIn} --- *** ERROR: ${err.message}`)
        return C.SF.Failure
    }
}

//WORKING : ETH => USDC
UNI_ExactInputSingleTrade = async (network, poolAddress, t0, t1, amountIn) => {
    let txnHash
    try {
        const tradeData = await PrepareTradeData(network, poolAddress, t0, t1, amountIn)
        if (tradeData === null) {
            return null
        }

        const myTrade = {
            tokenIn: t0,
            tokenOut: t1,
            fee: tradeData.fee,
            recipient: myWallet,
            deadline: deadline,
            amountIn: tradeData.amountIn,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0,
        }

        const uniswapRouter = new ethers.Contract(C.V3_ROUTER_ADDRESS, IUniswapRouterABI, tradeData.signer) //ISwapRouter02  IV3SwapRouter

        //### do I really need to provide a gas limit => check txn on poly & set constants
        console.log("Nonce UNI_ExactInputSingleTrade: " + tradeData.nonce)
        const txn = await uniswapRouter.exactInputSingle(myTrade, {
            gasLimit,
            maxFeePerGas: tradeData.maxFeePerGas,
            maxPriorityFeePerGas: tradeData.maxPriorityFeePerGas,
            nonce: tradeData.nonce,
        })

        console.log(txn.hash)
        txnHash = txn.hash ?? "No Txn Hash"
        infoLog.info(`UNI_ExactInputSingleTrade: Pool: ${poolAddress} - t0: ${t0} - t1: ${t1} - amountIn: ${amountIn} --- Hash: ${txnHash}`)
        const receipt = await txn.wait()

        if (receipt.status === 1) {
            await DB.AddTransaction(receipt.transactionHash, network, C.TransactionType.Trade)
            return C.SF.Success
        } else {
            errLog.error(`FAILURE :: UNI_ExactInputSingleTrade: Network: ${network} - Pool: ${poolAddress} - t0: ${t0} - t1: ${t1} - amountIn: ${amountIn} --- Hash: ${txnHash}`)
            return C.SF.Failure
        }
    } catch (err) {
        //### treat the following errors:
        // processing response error => Infura not available??? => stop trading bot for a certain time ???
        console.log("Error - UNI_ExactInputSingleTrade: " + err.message.substr(0, 200))
        errLog.error(
            `FAILURE :: UNI_ExactInputSingleTrade: Network: ${network} - Pool: ${poolAddress} - t0: ${t0} - t1: ${t1} - amountIn: ${amountIn} --- 
      Hash: ${txnHash} *** ERROR: ${err.message}`
        )
        return C.SF.Failure
    }
}

//WORKING : USDC => WETH
UNI_AlphaRouterMulticallTrade = async (network, poolAddress, t0, t1, amountIn) => {
    let txnHash
    try {
        const tradeData = await PrepareTradeData(network, poolAddress, t0, t1, amountIn)
        if (tradeData === null) {
            return null
        }

        const router = new AlphaRouter({ chainId: GetChainIdForNetwork(network), provider: tradeData.provider })
        let route

        for (let i = 0; i < C.MaxTryUNIAlphaRouterTrade; i++) {
            try {
                route = await router.route(tradeData.currencyAmountIn, tradeData.token1, TradeType.EXACT_INPUT, {
                    recipient: myWallet,
                    slippageTolerance,
                    deadline,
                })
            } catch (err) {
                console.log("!!! After await router.route: " + err.message)
                if (err.message.includes("ProviderBlockHeaderError") && i != C.MaxTryUNIAlphaRouterTrade - 1) {
                    //### maybe give it some time ???
                    await H.sleep(20000)
                    continue
                } else {
                    throw new Error(err.message)
                }
            }
        }

        let transaction = {
            data: route.methodParameters.calldata,
            value: BigNumber.from(route.methodParameters.value),
            to: C.SWAP_ROUTER_ADDRESSES,
            from: myWallet,
            gasLimit,
            maxFeePerGas: tradeData.maxFeePerGas,
            maxPriorityFeePerGas: tradeData.maxPriorityFeePerGas,
            nonce: tradeData.nonce,
        }
        console.log("Nonce UNI_AlphaRouterMulticallTrade: " + tradeData.nonce)

        const txn = await tradeData.signer.sendTransaction(transaction)
        console.log(txn.hash)
        txnHash = txn.hash ?? "No Txn Hash"
        infoLog.info(`UNI_AlphaRouterMulticallTrade: Pool: ${poolAddress} - t0: ${t0} - t1: ${t1} - amountIn: ${amountIn} --- Hash: ${txnHash}`)
        const receipt = await txn.wait()

        if (receipt.status === 1) {
            await DB.AddTransaction(receipt.transactionHash, network, C.TransactionType.Trade)
            return C.SF.Success
        } else {
            errLog.error(`FAILURE :: UNI_ExactInputSingleTrade: Network: ${network} - Pool: ${poolAddress} - t0: ${t0} - t1: ${t1} - amountIn: ${amountIn} --- Hash: ${txnHash}`)
            return C.SF.Failure
        }
    } catch (err) {
        //### treat the following errors:
        // processing response error => Infura not available??? => stop trading bot for a certain time ???
        console.log("Error - UNI_AlphaRouterMulticallTrade: " + err.message)
        errLog.error(
            `FAILURE :: UNI_AlphaRouterMulticallTrade: Network: ${network} - Pool: ${poolAddress} - t0: ${t0} - t1: ${t1} - amountIn: ${amountIn} --- 
      Hash: ${txnHash} *** ERROR: ${err.message}`
        )
        return C.SF.Failure //err.message
    }
}

//************************ Trade Helper **********************************************

PrepareTransaction = async (calldata, value, toAddress, tradeData) => {
    try {
        // let gasFees = await SCOps.GetGasFees(network)
        // if (gasFees === null) {
        //   return null
        // }

        const transaction = {
            data: calldata,
            value: BigNumber.from(value),
            to: toAddress,
            from: myWallet,
            gasLimit: C.GasLimit,
            maxFeePerGas: tradeData.maxFeePerGas, //: gasFees.maxFeePerGas,
            maxPriorityFeePerGas: tradeData.maxPriorityFeePerGas, //: gasFees.maxPriorityFeePerGas,
            nonce: tradeData.nonce,
        }
        return transaction
    } catch (err) {
        console.log("Error - PrepareTransaction: " + err.message)
        errLog.error(`PrepareTransaction: Calldata: ${calldata} *** ERROR: ${err.message}`)
        return null
    }
}

PrepareTradeData = async (network, poolAddress, t0, t1, amountIn) => {
    try {
        const provider = GetProviderForNetwork(network)
        const signer = SCOps.GetSignerAccount(network)
        const d0 = await SCOps.GetTokenDecimals(network, t0)
        const d1 = await SCOps.GetTokenDecimals(network, t1)
        if (d0 === 0 || d1 === 0) {
            return null
        }
        const adjustedAmountIn = String(amountIn * 10 ** d0)
        const nonce = await SCOps.GetCurrentNonce(network)
        if (nonce === null) {
            return null
        }

        const token0 = new Token(GetChainIdForNetwork(network), t0, d0)
        const token1 = new Token(GetChainIdForNetwork(network), t1, d1)
        const fee = await getPoolFee(network, poolAddress)
        if (fee === null) {
            return null
        }

        let amountOut = await UNI_GetV3Quotes(network, poolAddress, t0, t1, amountIn, d0, fee) //provides a string vlue
        if (amountOut === 0) {
            return null
        }
        //amountOut = (amountOut * 10 ** d1).toFixed()

        let gasFees = await SCOps.GetGasFees(network)
        if (gasFees === null) {
            return null
        }

        let currencyAmountIn = CurrencyAmount.fromRawAmount(token0, JSBI.BigInt(adjustedAmountIn))
        if (currencyAmountIn === null) {
            return null
        }

        return {
            provider,
            signer,
            token0,
            token1,
            d0,
            d1,
            fee,
            amountIn: adjustedAmountIn,
            amountOut,
            currencyAmountIn,
            maxFeePerGas: gasFees.maxFeePerGas,
            maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas,
            nonce,
        }
    } catch (err) {
        //### treat the following errors:
        // processing response error => Infura not available??? => stop trading bot for a certain time ???
        console.log("Error - PrepareTradeData: " + err.message)
        errLog.error(`PrepareTradeData: ${network} - Pool: ${poolAddress} - T0: ${t0} - T1: ${t1} *** ERROR: ${err.message}`)
        return null
    }
}

//************************ Get Price Quotes, Gas Fees, Pools... **********************************************

UNI_CreateV3Pool = async (network, poolAddress, token0, token1, fee) => {
    try {
        const state = await getPoolState(network, poolAddress)

        // create an instance of the pool object for the given pool
        const myPool = new UniV3Pool(
            token0,
            token1,
            fee,
            state.sqrtPriceX96.toString(), //note the description discrepancy - sqrtPriceX96 and sqrtRatioX96 are interchangable values
            state.liquidity.toString(),
            state.tick
        )
        return myPool
    } catch (err) {
        console.log("Error - UNI_CreateV3Pool: " + err.message)
        errLog.error(`UNI_CreateV3Pool: ${network} --- PoolAddress: ${poolAddress} *** ERROR: ${err.message}`)
        return null
    }
}

UNI_GetV3QuotesForUnadjusted = async (network, poolAddress, t0, t1, amountIn, d0 = 0, d1 = 0, fee = 0) => {
    const quote = await UNI_GetV3Quotes(network, poolAddress, t0, t1, amountIn, d0, fee)
    if (!quote) return null

    let dec1 = d1
    if (dec1 === 0) {
        dec1 = await GetTokenDecimals(network, t1)
    }
    return quote / 10 ** dec1
}

UNI_GetV3Quotes = async (network, poolAddress, t0, t1, amountIn, d0 = 0, fee = 0) => {
    const provider = GetProviderForNetwork(network)

    try {
        let dec0 = d0
        if (dec0 === 0) {
            dec0 = await GetTokenDecimals(network, t0)
        }

        let poolFee = fee
        if (poolFee === 0) {
            poolFee = await getPoolFee(network, poolAddress)
        }

        const adjustedAmountIn = String(amountIn * 10 ** dec0)
        const quoterContract = new ethers.Contract(C.QuoterContract, UniQuoterABI, provider)
        const quotedAmountOut = await quoterContract.callStatic.quoteExactInputSingle(t0, t1, poolFee, adjustedAmountIn, 0)
        return quotedAmountOut.toString() // .toNumber()   / 10 ** d1
    } catch (err) {
        console.log("Error - UNI_GetV3Quotes: " + err.message)
        errLog.error(`UNI_GetV3Quotes: ${network} --- TokenO: ${t0} --- Token1: ${t1} *** ERROR: ${err.message}`)
        return null
    }
}

//************************ HELPER METHODS **********************************************

getPoolData = async (network, poolAddress) => {
    const provider = GetProviderForNetwork(network)
    try {
        const poolContract = new ethers.Contract(poolAddress, UniV3PoolABI, provider)
        const poolData = await Promise.all([poolContract.token0(), poolContract.token1(), poolContract.fee()])
        return poolData
    } catch (err) {
        console.log("Error - getPoolData: " + err.message)
        errLog.error(`getPoolData: ${network} --- PoolAddress: ${poolAddress} *** ERROR: ${err.message}`)
        return null
    }
}

getPoolFee = async (network, poolAddress) => {
    const provider = GetProviderForNetwork(network)
    try {
        const poolContract = new ethers.Contract(poolAddress, UniV3PoolABI, provider)
        const fee = await poolContract.fee()
        return fee
    } catch (err) {
        console.log("Error - getPoolFee: " + err.message)
        errLog.error(`getPoolFee: ${network} --- PoolAddress: ${poolAddress} *** ERROR: ${err.message}`)
        return 0
    }
}

getPoolState = async (network, poolAddress) => {
    const provider = GetProviderForNetwork(network)
    try {
        const poolContract = new ethers.Contract(poolAddress, UniV3PoolABI, provider)
        const [liquidity, slot] = await Promise.all([poolContract.liquidity(), poolContract.slot0()])

        const poolState = {
            liquidity,
            sqrtPriceX96: slot[0],
            tick: slot[1],
            observationIndex: slot[2],
            observationCardinality: slot[3],
            observationCardinalityNext: slot[4],
            feeProtocol: slot[5],
            unlocked: slot[6],
        }

        return poolState
    } catch (err) {
        console.log("Error - getPoolState: " + err.message)
        errLog.error(`getPoolState: ${network} --- PoolAddress: ${poolAddress} *** ERROR: ${err.message}`)
        return null
    }
}

//************************ OLD CODE => DELETE ??? **********************************************

// WORKING !!! For multicall trades => generates encoded SC method calldata
UNI_UncheckedTrade = async (network, poolAddress, t0, t1, amountIn) => {
    let txnHash
    try {
        const tradeData = await PrepareTradeData(network, poolAddress, t0, t1, amountIn)
        if (tradeData === null) {
            return null
        }

        const pool = await UNI_CreateV3Pool(network, poolAddress, tradeData.token0, tradeData.token1, tradeData.fee)
        if (pool === null) {
            return null
        }

        const route = new UniV3Route([pool], tradeData.token0, tradeData.token1)
        const trade = await UniV3Trade.createUncheckedTrade({
            route,
            inputAmount: CurrencyAmount.fromRawAmount(tradeData.token0, tradeData.amountIn),
            outputAmount: CurrencyAmount.fromRawAmount(tradeData.token1, tradeData.amountOut),
            tradeType: TradeType.EXACT_INPUT,
        })
        if (trade === null) {
            return null
        }

        const { value, calldata } = UniV3SwapRouter.swapCallParameters(trade, {
            recipient: myWallet,
            slippageTolerance,
            deadline,
        })

        const txnObject = await PrepareTransaction(calldata, value, C.V3_ROUTER_ADDRESS, tradeData)
        if (txnObject === null) {
            return null
        }
        console.log("Nonce UNI_UncheckedTrade: " + tradeData.nonce)

        const txn = await tradeData.signer.sendTransaction(txnObject)
        console.log(txn.hash)
        txnHash = txn.hash ?? "No Txn Hash"
        infoLog.info(`UNI_UncheckedTrade: Pool: ${poolAddress} - t0: ${t0} - t1: ${t1} - amountIn: ${amountIn} --- Hash: ${txnHash}`)
        const receipt = await txn.wait()

        if (receipt.status === 1) {
            await DB.AddTransaction(receipt.transactionHash, network, C.TransactionType.Trade)
            return C.SF.Success
        } else {
            errLog.error(`FAILURE :: UNI_UncheckedTrade: Network: ${network} - Pool: ${poolAddress} - t0: ${t0} - t1: ${t1} - amountIn: ${amountIn} --- Hash: ${txnHash}`)
            return C.SF.Failure
        }
    } catch (err) {
        //console.log("Error - UNI_UncheckedTrade: " + err.message)
        errLog.error(
            `FAILURE :: UNI_UncheckedTrade: Network: ${network} - Pool: ${poolAddress} - t0: ${t0} - t1: ${t1} - amountIn: ${amountIn} --- 
      Hash: ${txnHash} *** ERROR: ${err.message}`
        )
        return C.SF.Failure
        //return err.code + " - " + err.reason // CALL_EXCEPTION - transaction failed
    }
}

//************************************** TEST CODE **********************************************

Test = async () => {
    //console.log(`Quote Exact In: ${route.quote.toFixed(2)}`);
    //console.log("Hex for 0.05 ETH: " + BigNumber.from(5 * 10 ** 15).toHexString()); // ethers.utils.parseEther(0.05).toHexString());
    //console.log(`Gas Adjusted Quote In: ${route.quoteGasAdjusted.toFixed(2)}`);
    //console.log(`Gas Used USD: ${route.estimatedGasUsedUSD.toFixed(6)}`);
    //console.log(BigNumber.from(route.methodParameters.value) + " - " + BigNumber.from(route.gasPriceWei));
}

module.exports = {
    UNI_MainTrade,
    UNI_UncheckedTrade,
    UNI_ExactInputSingleTrade,
    UNI_AlphaRouterMulticallTrade,
    UNI_CreateV3Pool,
    UNI_GetV3Quotes,
    UNI_GetV3QuotesForUnadjusted,
    UNI_UncheckedTrade,
}
