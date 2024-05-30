const mongoose = require("mongoose");
const Schema = mongoose.Schema;

//network, token0+1{id, symbol, name, decimals}, trackedReserveETH, DEX{name, routerAddress}

// Create Shema
const PairSchema = new Schema({
	id: {
		type: String,
		required: true,
	},
	network: {
		type: String,
		required: true,
	},
	trackedReserveETH: {
		type: Number,
		required: false,
	},
	feeTier: {
		type: Number,
		required: false,
	},
	dex: {
		type: String,
		required: true,
	},
	token0: {
		id: {
			type: String,
			required: true,
		},
		symbol: {
			type: String,
			required: true,
		},
		name: {
			type: String,
			required: true,
		},
		decimals: {
			type: Number,
			required: true,
		},
	},
	token1: {
		id: {
			type: String,
			required: true,
		},
		symbol: {
			type: String,
			required: true,
		},
		name: {
			type: String,
			required: true,
		},
		decimals: {
			type: Number,
			required: true,
		},
	},
});

// Create collection and add schema
mongoose.model("pairs", PairSchema, "pairs");
