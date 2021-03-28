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
         stripePaymentIntentId,
         transactionRemark,
         stripeInvoiceId,
         stripeInvoiceDetails,
         paymentRetryAttempt,
         invoiceSendAttempt,
         stripeInvoiceHistory,
         transactionRemarkHistory,
      } = req.body.event.data.new

      const { organization } = await client.request(FETCH_ORG_BY_STRIPE_ID, {
         id: organizationId,
      })

      const datahub = new GraphQLClient(
         `https://${organization.organizationUrl}/datahub/v1/graphql`,
         { headers: { 'x-hasura-admin-secret': organization.adminSecret } }
      )
      if (stripeAccountType === 'standard') {
         const item = await stripe.invoiceItems.create(
            {
               amount,
               currency,
               customer: stripeCustomerId,
               description: 'Weekly Subscription',
            },
            { stripeAccount: organization.stripeAccountId }
         )
         console.log('item', item.id)

         const invoice = await stripe.invoices.create(
            {
               customer: stripeCustomerId,
               default_payment_method: paymentMethod,
               statement_descriptor:
                  statementDescriptor || organization.organizationName,
               days_until_due: 1,
               collection_method: 'send_invoice',
               payment_settings: {
                  payment_method_options: {
                     card: {
                        request_three_d_secure: 'any',
                     },
                  },
               },
               metadata: {
                  organizationId,
                  cartId: transferGroup,
                  customerPaymentIntentId: id,
                  stripeAccountId: organization.stripeAccountId,
               },
            },
            { stripeAccount: organization.stripeAccountId }
         )
         console.log('invoice', invoice.id)
         await handleInvoice({
            invoice,
            datahub,
         })

         const finalizedInvoice = await stripe.invoices.finalizeInvoice(
            invoice.id,
            { stripeAccount: organization.stripeAccountId }
         )
         console.log('finalizedInvoice', finalizedInvoice.id)
         await handleInvoice({
            invoice,
            datahub,
         })

         const result = await stripe.invoices.pay(finalizedInvoice.id, {
            stripeAccount: organization.stripeAccountId,
         })
         console.log('result', result.id)
         await handleInvoice({
            invoice,
            datahub,
         })

         const paymentIntent = await stripe.paymentIntents.retrieve(
            result.payment_intent,
            { stripeAccount: organization.stripeAccountId }
         )
         console.log('paymentIntent', paymentIntent.id)
         await handlePaymentIntent({
            intent: paymentIntent,
            datahub,
            stripeAccountId: organization.stripeAccountId,
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
            statement_descriptor:
               statementDescriptor || organization.organizationName,
            return_url: `https://${organization.organizationUrl}/store/paymentProcessing`,
         })
         if (intent && intent.id) {
            await client.request(UPDATE_CUSTOMER_PAYMENT_INTENT, {
               id,
               _prepend: { transactionRemarkHistory: intent },
               _set: {
                  transactionRemark: intent,
                  status: STATUS[intent.status],
                  stripePaymentIntentId: intent.id,
               },
            })

            await datahub.request(UPDATE_CART, {
               pk_columns: { id: transferGroup },
               _prepend: { transactionRemarkHistory: intent },
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
   } catch (error) {
      logger('/api/payment-intent', error)
      return res.status(500).json({ success: false, error })
   }
}

export const retry = async (req, res) => {
   try {
      const { invoiceId, stripeAccountId } = req.body
      if (!invoiceId) throw Error('Invoice ID is required!')

      const stripeAccount = stripeAccountId

      const invoice = await stripe.invoices.retrieve(invoiceId, {
         stripeAccount,
      })

      const { organization } = await client.request(FETCH_ORG_BY_STRIPE_ID, {
         id: invoice.metadata.organizationId,
      })

      const datahub = new GraphQLClient(
         `https://${organization.organizationUrl}/datahub/v1/graphql`,
         { headers: { 'x-hasura-admin-secret': organization.adminSecret } }
      )

      const paidInvoice = await stripe.invoices.pay(invoiceId, {
         stripeAccount,
      })
      console.log('paidInvoice', paidInvoice.id)
      await handleInvoice({
         invoice: paidInvoice,
         datahub,
      })

      const intent = await stripe.paymentIntents.retrieve(
         invoice.payment_intent,
         { stripeAccount }
      )
      console.log('intent', intent.id)
      await handlePaymentIntent({
         intent,
         datahub,
      })
   } catch (error) {
      return res.status(500).json({ success: false, error })
   }
}

const handleInvoice = async ({ invoice, datahub }) => {
   try {
      let intent = null
      if (invoice.payment_intent) {
         intent = await stripe.paymentIntents.retrieve(invoice.payment_intent, {
            stripeAccount: invoice.metadata.stripeAccountId,
         })
      }
      await client.request(UPDATE_CUSTOMER_PAYMENT_INTENT, {
         id: invoice.metadata.customerPaymentIntentId,
         _prepend: {
            stripeInvoiceHistory: invoice,
            ...(intent && { transactionRemarkHistory: intent }),
         },
         _set: {
            stripeInvoiceId: invoice.id,
            stripeInvoiceDetails: invoice,
            ...(intent && {
               transactionRemark: intent,
               status: STATUS[intent.status],
               stripePaymentIntentId: intent.id,
            }),
         },
      })
      await datahub.request(UPDATE_CART, {
         pk_columns: { id: invoice.metadata.cartId },
         _prepend: {
            stripeInvoiceHistory: invoice,
            ...(intent && { transactionRemarkHistory: intent }),
         },
         _set: {
            stripeInvoiceId: invoice.id,
            stripeInvoiceDetails: invoice,
            ...(intent && {
               transactionId: intent.id,
               transactionRemark: intent,
               paymentStatus: STATUS[intent.status],
            }),
         },
      })
   } catch (error) {
      throw error
   }
}

const handlePaymentIntent = async ({ intent, datahub, stripeAccountId }) => {
   try {
      const invoice = await stripe.invoices.retrieve(intent.invoice, {
         stripeAccount: stripeAccountId,
      })
      await client.request(UPDATE_CUSTOMER_PAYMENT_INTENT, {
         id: invoice.metadata.customerPaymentIntentId,
         _prepend: {
            stripeInvoiceHistory: invoice,
            transactionRemarkHistory: intent,
         },
         _set: {
            stripeInvoiceId: invoice.id,
            stripeInvoiceDetails: invoice,
            transactionRemark: intent,
            status: STATUS[intent.status],
            stripePaymentIntentId: intent.id,
         },
      })
      await datahub.request(UPDATE_CART, {
         pk_columns: { id: invoice.metadata.cartId },
         _prepend: {
            stripeInvoiceHistory: invoice,
            transactionRemarkHistory: intent,
         },
         _set: {
            stripeInvoiceId: invoice.id,
            stripeInvoiceDetails: invoice,
            transactionId: intent.id,
            transactionRemark: intent,
            paymentStatus: STATUS[intent.status],
         },
      })
   } catch (error) {
      throw error
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
