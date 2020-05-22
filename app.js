import cors from 'cors'
import morgan from 'morgan'
import express from 'express'

import {
   CardRouter,
   RefundRouter,
   CustomerRouter,
   SetupIntentRouter,
   PaymentIntentRouter,
} from './entities'

import { getAccountId, createLoginLink, getBalance } from './entities/misc'

const app = express()

app.use(cors())
app.use(morgan('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

app.get('/api/', (req, res) => {
   res.json({ message: 'DailyKey Api' })
})
app.use('/api/payments/card', CardRouter)
app.use('/api/payments/refund', RefundRouter)
app.use('/api/payments/customer', CustomerRouter)
app.use('/api/payments/setup-intent', SetupIntentRouter)
app.use('/api/payments/payment-intent', PaymentIntentRouter)

app.get('/api/payments/balance', getBalance)
app.get('/api/payments/account-id', getAccountId)
app.get('/api/payments/login-link', createLoginLink)

app.listen(process.env.PORT, function () {
   console.log('Listening on port ' + process.env.PORT)
})
