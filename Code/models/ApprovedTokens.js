const mongoose = require('mongoose');
const Schema = mongoose.Schema;

//network, token0+1{id, symbol, name, decimals}, trackedReserveETH, DEX{name, routerAddress}

// Create Shema
const ApprovedTokenSchema = new Schema({
  network:{
    type:String,
    required: true
  }, 
  dex:{
    type:String,
    required: true
  },  
  tokenId:{
    type:String,
    required: true
  },
  symbol:{
    type:String,
    required: false
  },
  amount:{
    type:Number,
    required: false
  }  
});

// Create collection and add schema
mongoose.model('approvedTokens', ApprovedTokenSchema, 'approvedTokens');