import express from 'express'

import { initiate, processRequest, processTransaction } from './controllers'

const router = express.Router()

router.post('/request/initiate', initiate)
router.post('/request/process', processRequest)
router.post('/transaction/process', processTransaction)

export default router
