import stripe from '../../lib/stripe'
import { isObjectValid } from '../../utils'

export const getAccountId = async (req, res) => {
   try {
      const { code } = req.query
      const response = await stripe.oauth.token({
         code,
         grant_type: 'authorization_code',
      })
      const connected_account_id = await response.stripe_user_id

      return res.json({
         success: true,
         data: { stripeAccountId: connected_account_id },
      })
   } catch (error) {
      return res.json({ success: false, error: error.message })
   }
}

export const createLoginLink = async (req, res) => {
   try {
      const { accountId } = req.query
      const response = await stripe.accounts.createLoginLink(accountId)
      return res.json({
         success: true,
         data: { link: response },
      })
   } catch (error) {
      return res.json({ success: false, error: error.message })
   }
}

export const getBalance = async (req, res) => {
   try {
      const { accountId } = req.query
      const response = await stripe.balance.retrieve(null, {
         stripeAccount: accountId,
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
