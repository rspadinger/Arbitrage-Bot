const mongoose = require("mongoose");
const QS = require("quickswap-sdk");
const ethers = require("ethers");

const { errLog, infoLog } = require("./logger");
const C = require("./config/const");
const { GetPairData } = require("./helpers/graphql");
const DB = require("./helpers/dbOperations");
const SCOperations = require("./blockchain/SCOperations");

/******************************************************************************
 ********** Prepare DB: Get Pairs form Subgraph, Create MatchingPirs... *********
 ********************************************************************************/

AddPairsForNetworkAndDexToDB = async (subgraph, numberPairsToFetch, network, dex) => {
	try {
		const pairsQS = await GetPairData(subgraph, numberPairsToFetch, dex);
		await DB.AddPairsForNetworkAndDexToDB(pairsQS, network, dex);
	} catch (err) {
		console.log("Error - AddPairsForNetworkAndDexToDB: " + err.message);
	}
};

AddMatchingPairsForNetworkAndDexToDB = async (network, dex0, dex1) => {
	try {
		await DB.AddMatchingPairsForNetworkAndDexToDB(network, dex0, dex1);
	} catch (err) {
		console.log("Error - AddMatchingPairsForNetworkAndDexToDB: " + err.message);
	}
};

/******************************************************************************
 **************** Get Price Data and Update the MatchingPairs Collection ********
 ********************************************************************************/

GetPriceDataForMatchingPairAndUpdateDB = async (network, matchingPair) => {
	try {
		priceData = await SCOperations.GetPriceDataForMatchingPair(network, matchingPair);
		if (priceData) {
			await DB.UpdatePriceDataForMatchingPair(matchingPair.id, priceData);
			return priceData;
		} else {
			errLog.error(`FAILURE :: GetPriceDataForMatchingPairAndUpdateDB: ${network} --- Price Data could not be obtained`);
			console.log("Error - GetPriceDataForMatchingPairAndUpdateDB: price data could not be retrieved for pairId: " + matchingPair.id);
			return null;
		}
	} catch (err) {
		errLog.error(`ERROR :: GetPriceDataForMatchingPairAndUpdateDB: ${network} --- Error: ${err.message}`);
		console.log("Error - GetPriceDataForMatchingPairAndUpdateDB: " + err.message);
		return null;
	}
};

GetPriceDataForAllMatchingPairsOnNetworkAndUpdateDB = async (network) => {
	const matchingPairs = await DB.GetAllMatchingPairsForNetwork(network);
	for (pair of matchingPairs) {
		await GetPriceDataForMatchingPairAndUpdateDB(network, pair);
	}
};

GetPriceDataForAllMatchingPairsOnNetworkAndDexesAndUpdateDB = async (network, dex0, dex1) => {
	const matchingPairs = await DB.GetAllMatchingPairsForNetworkndDexes(network, dex0, dex1);
	for (pair of matchingPairs) {
		await GetPriceDataForMatchingPairAndUpdateDB(network, pair);
	}
};

module.exports = {
	AddPairsForNetworkAndDexToDB,
	AddMatchingPairsForNetworkAndDexToDB,
	GetPriceDataForMatchingPairAndUpdateDB,
	GetPriceDataForAllMatchingPairsOnNetworkAndUpdateDB,
	GetPriceDataForAllMatchingPairsOnNetworkAndDexesAndUpdateDB,
};
