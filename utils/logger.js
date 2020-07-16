import fs from 'fs'
import path from 'path'
import moment from 'moment'

export const logger = (endpoint, error) => {
   const stream = fs.createWriteStream(
      path.join(__dirname, '../logs/errors.log'),
      { flags: 'a' }
   )
   stream.write(
      `[${endpoint}] | [${moment().format(
         'YYYY-MM-DD HH:MM:SSA Z'
      )}] | [${error}]\n`
   )
   stream.end()
}
