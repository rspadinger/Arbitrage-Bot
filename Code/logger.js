const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf } = format;

const myFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} - ${message}`;
});

errLog =  createLogger({  
  format: combine(
    timestamp(),
    myFormat
  ),
  transports: [
    new transports.File({ filename: 'error.log', level: 'error' }), 
  ],
});

const infoLog = createLogger({  
  format: combine(
    timestamp(),
    myFormat
  ),
  transports: [
    new transports.File({ filename: 'info.log', level: 'info' }), 
  ],
});

module.exports = {
  errLog,
  infoLog
}


