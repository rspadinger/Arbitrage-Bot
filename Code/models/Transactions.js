const mongoose = require('mongoose');
const Schema = mongoose.Schema;

//network, token0+1{id, symbol, name, decimals}, trackedReserveETH, DEX{name, routerAddress}

// Create Shema
const TransactionSchema = new Schema({
  transactionId:{
    type:String,
    required: true
  }, 
  network:{
    type:String,
    required: true
  }, 
  timestamp:{
    type:Date,
    default: Date.now
  },  
  typeOfTransaction:{
    type:String,
    required: false
  }  
});

// Create collection and add schema
mongoose.model('transactions', TransactionSchema, 'transactions');