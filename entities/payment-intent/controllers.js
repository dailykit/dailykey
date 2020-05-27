import { GraphQLClient, request } from 'graphql-request'

import stripe from '../../lib/stripe'
import { isObjectValid } from '../../utils'

const client = new GraphQLClient(process.env.DAILYCLOAK_URL)

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

      const intent = await stripe.paymentIntents.create({
         amount,
         confirm: true,
         currency: 'usd',
         on_behalf_of: onBehalfOf,
         customer: stripeCustomerId,
         payment_method: paymentMethod,
         transfer_group: transferGroup,
      })
      console.log('create -> intent', intent)

      if (intent.id) {
         const updateCustomerPaymentIntent = await client.request(
            UPDATE_CUSTOMER_PAYMENT_INTENT,
            {
               id,
               _set: {
                  transactionRemark: intent,
                  stripePaymentIntentId: intent.id,
               },
            }
         )
         console.log(
            'create -> updateCustomerPaymentIntent',
            updateCustomerPaymentIntent
         )

         const { organizations } = await client.request(
            FETCH_ORG_BY_STRIPE_ID,
            {
               stripeAccountId: {
                  _eq: onBehalfOf,
               },
            }
         )
         console.log('create -> organizations', organizations)

         const updateCart = await request(
            `http://${organizations[0].organizationUrl}/datahub/v1/graphql`,
            UPDATE_CART,
            {
               id: transferGroup,
               _set: {
                  paymentStatus: 'SUCCEEDED',
                  transactionRemark: intent,
                  transactionId: intent.id,
               },
            }
         )
         console.log('create -> updateCart', updateCart)

         return res.status(200).json({
            success: true,
            data: { intent },
         })
      }
   } catch (error) {
      console.log('create -> error', error)
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
      organizations(where: {stripeAccountId: $stripeAccountId}) {
         organizationUrl
      }
   }
`

const UPDATE_CART = `
   mutation updateCart($id: Int_comparison_exp!, $_set: crm_orderCart_set_input! ) {
      updateCart(where: {id: $id}, _set: $_set) {
         returning {
            id
         }
      }
   }
`
