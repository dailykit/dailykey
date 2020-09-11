import stripe from '../../lib/stripe'

export const getAccountDetails = async (req, res) => {
   try {
      const { id = '' } = req.params
      if (!id) throw Error('Missing account Id!')
      const data = await stripe.accounts.retrieve(id)
      return res.json({ success: true, data })
   } catch (error) {
      return res.status(400).json({ success: false, error: error.message })
   }
}
