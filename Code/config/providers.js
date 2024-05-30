const QS = require("quickswap-sdk")
const ethers = require("ethers")
const C = require("./const")

exports.MaticProvider = () => {
    return new ethers.providers.AlchemyProvider(C.MaticNetwork, C.AlchemyAPI)
    //return new ethers.providers.InfuraProvider(C.MaticNetwork, { projectId: C.InfuraProjectId })
}

exports.RinkebyProvider = () => {
    return new ethers.providers.AlchemyProvider(C.MaticNetwork, C.AlchemyAPI)
}

exports.RopstenProvider = () => {
    return new ethers.providers.AlchemyProvider(C.MaticNetwork, C.AlchemyAPI)
}
