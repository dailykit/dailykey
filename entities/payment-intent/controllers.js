import { GraphQLClient } from 'graphql-request'

import stripe from '../../lib/stripe'
import { isObjectValid, logger } from '../../utils'

const client = new GraphQLClient(process.env.DAILYCLOAK_URL, {
   headers: {
      'x-hasura-admin-secret': process.env.DAILYCLOAK_ADMIN_SECRET,
   },
})

const STATUS = {
   requires_action: 'REQUIRES_ACTION',
   processing: 'PROCESSING',
   canceled: 'CANCELLED',
   succeeded: 'SUCCEEDED',
}

export const create = async (req, res) => {
   try {
      const {
         id,
         amount,
         currency,
         onBehalfOf,
         transferGroup,
         paymentMethod,
         organizationId,
         stripeCustomerId,
         stripeAccountType,
         statementDescriptor,
      } = req.body.event.data.new

      const { organizations } = await client.request(FETCH_ORG_BY_STRIPE_ID, {
         id: organizationId,
      })

      const datahub = new GraphQLClient(
         `https://${organization.organizationUrl}/datahub/v1/graphql`,
         { headers: { 'x-hasura-admin-secret': organization.adminSecret } }
      )

      if (organizations.length > 0) {
         const [organization] = organizations
         if (stripeAccountType === 'standard') {
            const invoice = await stripe.invoices.create(
               {
                  customer: stripeCustomerId,
                  default_payment_method: paymentMethod,
                  statement_descriptor: statementDescriptor,
                  metadata: { cartId: transferGroup },
               },
               { stripeAccount: organization.stripeAccountId }
            )
            await stripe.invoiceItems.create(
               {
                  amount,
                  currency,
                  invoice: invoice.id,
                  customer: stripeCustomerId,
                  description: 'Weekly Subscription',
               },
               { stripeAccount: organization.stripeAccountId }
            )
            const result = await stripe.invoices.pay(invoice.id)
            const paymentIntent = await stripe.paymentIntents.retrieve(
               result.payment_intent
            )
            await client.request(UPDATE_CUSTOMER_PAYMENT_INTENT, {
               id,
               _set: {
                  stripeInvoiceId: result.id,
                  stripeInvoiceDetails: result,
                  transactionRemark: paymentIntent,
                  status: STATUS[paymentIntent.status],
                  stripePaymentIntentId: paymentIntent.id,
               },
            })
            await datahub.request(UPDATE_CART, {
               pk_columns: { id: transferGroup },
               _set: {
                  stripeInvoiceId: result.id,
                  stripeInvoiceDetails: result,
                  transactionId: paymentIntent.id,
                  transactionRemark: paymentIntent,
                  paymentStatus: STATUS[paymentIntent.status],
               },
            })
            return res.status(200).json({ success: true, data: result })
         } else {
            const intent = await stripe.paymentIntents.create({
               amount,
               currency,
               confirm: true,
               on_behalf_of: onBehalfOf,
               customer: stripeCustomerId,
               payment_method: paymentMethod,
               transfer_group: transferGroup,
               statement_descriptor: statementDescriptor,
               return_url: `https://${organization.organizationUrl}/store/paymentProcessing`,
            })
            if (intent && intent.id) {
               await client.request(UPDATE_CUSTOMER_PAYMENT_INTENT, {
                  id,
                  _set: {
                     transactionRemark: intent,
                     status: STATUS[intent.status],
                     stripePaymentIntentId: intent.id,
                  },
               })

               await datahub.request(UPDATE_CART, {
                  pk_columns: { id: transferGroup },
                  _set: {
                     transactionId: intent.id,
                     transactionRemark: intent,
                     paymentStatus: STATUS[intent.status],
                  },
               })

               return res.status(200).json({
                  success: true,
                  data: intent,
               })
            } else {
               throw Error('Failed to create payment intent!')
            }
         }
      } else {
         throw Error('No linked organization!')
      }
   } catch (error) {
      logger('/api/payment-intent', error)
      return res.status(404).json({ success: false, error })
   }
}

export const update = async (req, res) => {
   try {
      const { id } = req.params
      const response = await stripe.paymentIntents.update(id, {
         ...req.body,
      })

      if (isObjectValid(response)) {
         return res.json({ success: true, data: response })
      } else {
         throw Error('Didnt get any response from Stripe!')
      }
   } catch (error) {
      return res.json({ success: false, error: error.message })
   }
}

export const cancel = async (req, res) => {
   try {
      const { id } = req.params
      const response = await stripe.paymentIntents.cancel(id)

      if (isObjectValid(response)) {
         return res.json({ success: true, data: response })
      } else {
         throw Error('Didnt get any response from Stripe!')
      }
   } catch (error) {
      return res.json({ success: false, error: error.message })
   }
}

export const get = async (req, res) => {
   try {
      const { id } = req.params
      const response = await stripe.paymentIntents.retrieve(id)

      if (isObjectValid(response)) {
         return res.json({ success: true, data: response })
      } else {
         throw Error('Didnt get any response from Stripe!')
      }
   } catch (error) {
      return res.json({ success: false, error: error.message })
   }
}

export const list = async (req, res) => {
   try {
      const response = await stripe.paymentIntents.list(req.query)

      if (isObjectValid(response)) {
         return res.json({ success: true, data: response })
      } else {
         throw Error('Didnt get any response from Stripe!')
      }
   } catch (error) {
      return res.json({ success: false, error: error.message })
   }
}

const UPDATE_CUSTOMER_PAYMENT_INTENT = `
   mutation updateCustomerPaymentIntent($id: uuid!, $_set: stripe_customerPaymentIntent_set_input!) {
      updateCustomerPaymentIntent(
         pk_columns: {id: $id}, 
         _set:  $_set
      ) {
         id
      }
   }
`

const FETCH_ORG_BY_STRIPE_ID = `
   query organization($id: Int!) {
      organization(id: $id) {
         id
         adminSecret
         organizationUrl
         stripeAccountId
      }
   }
`

const UPDATE_CART = `
   mutation updateCart(
      $pk_columns: order_cart_pk_columns_input!
      $_set: order_cart_set_input!
   ) {
      updateCart(pk_columns: $pk_columns, _set: $_set) {
         id
      }
   }
`
