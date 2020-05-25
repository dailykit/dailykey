import { GraphQLClient } from 'graphql-request'

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

      if (intent.id) {
         await client.request(UPDATE_CUSTOMER_PAYMENT_INTENT, {
            id,
            stripePaymentIntentId: intent.id,
         })

         return res.status(200).json({
            success: true,
            data: { intent },
         })
      }
   } catch (error) {
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
   mutation updateCustomerPaymentIntent($id: uuid!, $stripePaymentIntentId: String!) {
      updateCustomerPaymentIntent(pk_columns: {id: $id}, _set: {stripePaymentIntentId: $stripePaymentIntentId}) {
         id
      }
   }
`
