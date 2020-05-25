import cors from 'cors'
import morgan from 'morgan'
import express from 'express'
import bodyParser from 'body-parser'

import {
   CardRouter,
   RefundRouter,
   CustomerRouter,
   SetupIntentRouter,
   PaymentMethodRouter,
   PaymentIntentRouter,
} from './entities'

import {
   getBalance,
   getAccountId,
   createCustomer,
   createLoginLink,
   authorizeRequest,
   createCustomerByClient,
   createCustomerPaymentIntent,
} from './entities/misc'

const app = express()

app.use(cors())
app.use(morgan('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

app.get('/api/', (req, res) => {
   res.json({ message: 'DailyKey Api' })
})
app.use('/api/card', CardRouter)
app.use('/api/refund', RefundRouter)
app.use('/api/customer', CustomerRouter)
app.use('/api/setup-intent', SetupIntentRouter)
app.use('/api/payment-method', PaymentMethodRouter)
app.use('/api/payment-intent', PaymentIntentRouter)

app.get('/api/balance', getBalance)
app.get('/api/account-id', getAccountId)
app.get('/api/login-link', createLoginLink)
app.post('/api/initiate-payment', createCustomerPaymentIntent)

app.post('/api/webhooks/customer', createCustomer)
app.post('/api/webhooks/authorize-request', authorizeRequest)
app.post('/api/webhooks/customer-by-client', createCustomerByClient)

app.listen(process.env.PORT, function () {
   console.log('Listening on port ' + process.env.PORT)
})
