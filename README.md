# A Simple Arbitrage Trading Bot

This is a simple arbitrage trading bot that calculates price differences between matching trading pairs on various Dexes (Uniswap, Sushiswap, Quickswap...) on the Polygon network and performs the corresponding trades whenever a profitable arbitrage opportunity is found. 

The following steps are performed:

* Get trading pairs (pools) for various second layer exchanges using the corresponding subgraphs for Uniswap, Quickswap, Sushiswap and Apeswap and add them to the corresponding Mongo database tables.

* Generate a list of matching pools between different exchanges
                                                                         
* Periodically, fetch price data for all matching trading pairs for different exchanges

* After each price fetch, calculate price differences and trading routes between the same trading pairs on different exchanges

* If an arbitrage opportunity is found (sufficiently high price difference):
    * Check allowances for involved tokens
    * If necessary, approve token allowances
    * Perform the arbitrage trade from calculated source exchange (TokeA => TokenB) to destination exchange (TokeB => TokenA)


## Dependencies

Install the following tools:

-   Node.js & NPM: https://nodejs.org
-   Metamask: https://metamask.io/download/
-   Create a Mongo database, called: ArbitrageBot : https://www.mongodb.com/docs/manual/installation/

## Clone the project

`git clone https://github.com/rspadinger/Arbitrage-Bot.git`

## Install dependencies

```
`$ cd project_folder` => (replace project_folder with the name of the project directory you want to execute)
`$ npm install`
```

## Run the Arbitrage Bot 

npm start
