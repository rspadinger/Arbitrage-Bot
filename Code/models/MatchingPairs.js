const mongoose = require("mongoose")
const Schema = mongoose.Schema

//network, DEX0+1{name}, token0+1{id, symbol, name, decimals}, DEX0Token01Price, DEX1Token01Price, DiffD0D1T0T1

// Create Shema
const MatchingPairSchema = new Schema({
    network: {
        type: String,
        required: true,
    },
    dex0: {
        pairId: {
            type: String,
            required: true,
        },
        name: {
            type: String,
            required: true,
        },
        feeTier: {
            type: Number,
            required: false,
        },
        T0T1Price: {
            type: Number,
            required: false,
        },
        T1T0Price: {
            type: Number,
            required: false,
        },
    },
    dex1: {
        pairId: {
            type: String,
            required: true,
        },
        name: {
            type: String,
            required: true,
        },
        feeTier: {
            type: Number,
            required: false,
        },
        T0T1Price: {
            type: Number,
            required: false,
        },
        T1T0Price: {
            type: Number,
            required: false,
        },
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
    diffPercent: {
        type: Number,
        required: false,
    },
    bestTrade: {
        type: String,
        required: false,
    },
})

// Create collection and add schema
mongoose.model("matchingPairs", MatchingPairSchema, "matchingPairs")
