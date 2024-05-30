module.exports = {
	pairQuery: `
    query ($first: Int) {
      pairs (first:$first, orderBy:trackedReserveETH, orderDirection:desc) {
          id 
          token0{id, symbol, name, decimals}
          token1{id, symbol, name, decimals} 
          trackedReserveETH
      } 
    }`,

	poolQueryUniswap: `
    query ($first: Int) {
      pools (first:$first, orderBy:totalValueLockedETH, orderDirection:desc) {
          id 
          feeTier
          token0{id, symbol, name, decimals}
          token1{id, symbol, name, decimals} 
          totalValueLockedETH
      } 
    }`,

	pairQueryApeswap: `
    query ($first: Int) {
      pairs (first:$first, orderBy:trackedReserveETH, orderDirection:desc) {
          id 
          token0{id, symbol, name, decimals}
          token1{id, symbol, name, decimals} 
          trackedReserveETH
      } 
    }`,
};
