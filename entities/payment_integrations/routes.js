import express from 'express'

import {
   initiate,
   handleCart,
   processRequest,
   processTransaction,
} from './controllers'

const router = express.Router()

router.post('/cart', handleCart)
router.post('/request/initiate', initiate)
router.post('/request/process', processRequest)
router.post('/transaction/process', processTransaction)

export default router
