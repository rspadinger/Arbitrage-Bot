const gql = require("graphql-tag");
const ApolloClient = require("apollo-client").ApolloClient;
const fetch = require("cross-fetch");
const createHttpLink = require("apollo-link-http").createHttpLink;
const InMemoryCache = require("apollo-cache-inmemory").InMemoryCache;

const { errLog, infoLog } = require("../logger");
const graphQueries = require("../config/graphQueries");
const C = require("../config/const");

GetPairData = async (subgraphUrl, numberOfPairs, dex) => {
	try {
		let myPairQuery;

		if (dex == C.Quickswap || dex == C.Sushiswap) {
			myPairQuery = graphQueries.pairQuery;
		} else if (dex == C.Uniswap) {
			myPairQuery = graphQueries.poolQueryUniswap;
		} else {
			//### this case is not treated
			console.log("ERROR - GetPairData: Add additional exchanges");
		}

		const query = gql(myPairQuery);
		const client = GetGraphClientForSubgraphUrl(subgraphUrl);

		const result = await client.query({
			query,
			variables: {
				first: numberOfPairs,
			},
		});

		if (subgraphUrl == C.UniSubgraph) {
			return result.data.pools;
		} else {
			return result.data.pairs;
		}
	} catch (err) {
		console.log("Error - GetPairData: " + err.message);
		errLog.error(`GetPairData: ${dex} *** ERROR: ${err.message}`);
		return null;
	}
};

//private methods
GetGraphClientForSubgraphUrl = (subgraphUrl) => {
	const httpLink = createHttpLink({
		uri: subgraphUrl,
		fetch: fetch,
	});

	const client = new ApolloClient({
		link: httpLink,
		cache: new InMemoryCache(),
	});

	return client;
};

module.exports = { GetPairData };
