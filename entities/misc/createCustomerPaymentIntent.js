import { GraphQLClient } from 'graphql-request'

import { logger } from '../../utils'

const client = new GraphQLClient(process.env.DAILYCLOAK_URL, {
   headers: {
      'x-hasura-admin-secret': process.env.DAILYCLOAK_ADMIN_SECRET,
   },
})

export const createCustomerPaymentIntent = async (req, res) => {
   try {
      const {
         cart,
         customer,
         organizationId,
         statementDescriptor = '',
      } = req.body

      const { organization } = await client.request(FETCH_ORG_CA_ID, {
         id: organizationId,
      })
      const { customerPaymentIntents } = await client.request(
         FETCH_CUSTOMER_PAYMENT_INTENT,
         {
            organizationId: organizationId,
            cartId: `${cart.id}`,
         }
      )

      if (customerPaymentIntents.length > 0) {
         const customerPaymentIntent = await client.request(
            RETRY_CUSTOMER_PAYMENT_INTENT,
            {
               id: customerPaymentIntents[0].id,
               _set: {
                  paymentMethod: customer.paymentMethod,
               },
            }
         )
         return res.json({
            success: true,
            data: { customerPaymentIntent },
            message: 'Payment request has been reattempted',
         })
      } else {
         if (organization.stripeAccountId) {
            const chargeAmount = (cart.amount * 100).toFixed(0)
            const fixedDeduction = organization.chargeFixed * 100
            const percentDeduction =
               chargeAmount * (organization.chargePercentage / 100)

               const transferAmount = (
               chargeAmount -
               fixedDeduction -
               percentDeduction
            ).toFixed(0)

            const customerPaymentIntent = await client.request(CREATE_CUSTOMER_PAYMENT_INTENT, {
                  object: {
                     organizationId,
                     statementDescriptor,
                     amount: chargeAmount,
                     transferGroup: `${cart.id}`,
                     paymentMethod: customer.paymentMethod,
                     onBehalfOf: organization.stripeAccountId,
                     stripeCustomerId: customer.stripeCustomerId,
                     currency: organization.currency.toLowerCase(),
                     stripeAccountType: organization.stripeAccountType,
                     ...(organization.stripeAccountType === 'express' && {
                        organizationTransfers: {
                           data: {
                              amount: transferAmount,
                              transferGroup: `${cart.id}`,
                              destination: organization.stripeAccountId,
                           },
                        },
                     }),
                  },
               })

               return res.json({
               success: true,
               data: { customerPaymentIntent },
               message: 'Payment request has been initiated!',
            })
         } else {
            logger(
               '/api/initiate-payment',
               "Your account doesn't have stripe linked!"
            )
            return res.status(403).json({
               success: false,
               error: "Your account doesn't have stripe linked!",
            })
         }
      }
   } catch (error) {
      logger('/api/initiate-payment', error.message)
      return res.status(404).json({ success: false, error: error.message })
   }
}

const FETCH_ORG_CA_ID = `
   query organization($id: Int!) {
      organization(id: $id) {
         currency
         chargeFixed
         chargeCurrency
         stripeAccountId
         chargePercentage
         stripeAccountType
      }
   } 
`

const FETCH_CUSTOMER_PAYMENT_INTENT = `
query customerPaymentIntents($organizationId: Int!, $cartId: String!) {
   customerPaymentIntents(where: {organizationId: {_eq: $organizationId}, transferGroup: {_eq: $cartId}}) {
     amount
      id
      invoiceSendAttempt
      amount
      created_at
      currency
      onBehalfOf
      paymentMethod
      paymentRetryAttempt
      statementDescriptor
      status
      stripeAccountType
      stripeCustomerId
      stripeInvoiceId
      stripePaymentIntentId
      transferGroup
   }
 }
 
 `

const CREATE_CUSTOMER_PAYMENT_INTENT = `
   mutation createCustomerPaymentIntent($object: stripe_customerPaymentIntent_insert_input!) {
      createCustomerPaymentIntent(object: $object) {
         id
      }
   }
`
const RETRY_CUSTOMER_PAYMENT_INTENT = `
mutation updateCustomerPaymentIntent($id: uuid!, $_set: stripe_customerPaymentIntent_set_input!) {
   updateCustomerPaymentIntent(pk_columns: {id: $id}, _inc: {paymentRetryAttempt: 1}, _set: $_set) {
     id
     amount
     invoiceSendAttempt
     amount
     created_at
     currency
     onBehalfOf
     paymentMethod
     paymentRetryAttempt
     statementDescriptor
     status
     stripeAccountType
     stripeCustomerId
     stripeInvoiceId
     stripePaymentIntentId
     transferGroup
   }
 }
 
 `
