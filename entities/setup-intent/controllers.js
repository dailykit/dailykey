import stripe from '../../lib/stripe'
import { isObjectValid } from '../../utils'

export const create = async (req, res) => {
   try {
      const { payment_method } = req.body
      const response = await stripe.setupIntents.create({
         payment_method,
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

export const update = async (req, res) => {
   try {
      const { id } = req.params
      const response = await stripe.setupIntents.update(id, {
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
      const response = await stripe.setupIntents.cancel(id)

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
      const { id } = req.body
      const response = await stripe.setupIntents.retrieve({
         id,
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

export const list = async (req, res) => {
   try {
      const response = await stripe.setupIntents.list(req.query)

      if (isObjectValid(response)) {
         return res.json({ success: true, data: response })
      } else {
         throw Error('Didnt get any response from Stripe!')
      }
   } catch (error) {
      return res.json({ success: false, error: error.message })
   }
}
