import { GraphQLClient, request } from 'graphql-request'

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
         onBehalfOf,
         transferGroup,
         paymentMethod,
         stripeCustomerId,
      } = req.body.event.data.new

      const { organizations } = await client.request(FETCH_ORG_BY_STRIPE_ID, {
         stripeAccountId: {
            _eq: onBehalfOf,
         },
      })

      if (organizations.length > 0) {
         const [organization] = organizations
         const intent = await stripe.paymentIntents.create({
            amount,
            confirm: true,
            currency: 'usd',
            on_behalf_of: onBehalfOf,
            customer: stripeCustomerId,
            payment_method: paymentMethod,
            transfer_group: transferGroup,
            return_url: `https://${organization.organizationUrl}/store/paymentProcessing`,
         })

         if (intent.id) {
            await client.request(UPDATE_CUSTOMER_PAYMENT_INTENT, {
               id,
               _set: {
                  transactionRemark: intent,
                  status: STATUS[intent.status],
                  stripePaymentIntentId: intent.id,
               },
            })

            const datahubClient = new GraphQLClient(
               `https://${organization.organizationUrl}/datahub/v1/graphql`,
               {
                  headers: {
                     'x-hasura-admin-secret': organization.adminSecret,
                  },
               }
            )

            await datahubClient.request(UPDATE_CART, {
               transactionId: intent.id,
               transactionRemark: intent,
               id: { _eq: transferGroup },
               paymentStatus: STATUS[intent.status],
            })

            return res.status(200).json({
               success: true,
               data: { intent },
            })
         }
      } else {
         throw Error('No linked organization!')
      }
   } catch (error) {
      logger('/api/payment-intent', error.message)
      return res.status(404).json({ success: false, error: error.message })
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
   query organizations($stripeAccountId: String_comparison_exp!) {
      organizations(where: { stripeAccountId: $stripeAccountId }) {
         adminSecret
         organizationUrl
      }
   }
`

const UPDATE_CART = `
   mutation updateCart($id: Int_comparison_exp!, $paymentStatus: String!, $transactionId: String!, $transactionRemark: jsonb!) {
      updateCart(
         where: {id: $id}, 
         _set: {paymentStatus: $paymentStatus, transactionId: $transactionId, transactionRemark: $transactionRemark}) {
         returning {
            id
         }
      }
   } 
`
