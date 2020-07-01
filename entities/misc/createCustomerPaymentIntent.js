import { GraphQLClient } from 'graphql-request'

const client = new GraphQLClient(process.env.DAILYCLOAK_URL, {
   headers: {
      'x-hasura-admin-secret': process.env.DAILYCLOAK_ADMIN_SECRET,
   },
})

export const createCustomerPaymentIntent = async (req, res) => {
   try {
      const { organizationId, cart, customer } = req.body

      const { organization } = await client.request(FETCH_ORG_CA_ID, {
         id: organizationId,
      })

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

         const customerPaymentIntent = await client.request(
            CREATE_CUSTOMER_PAYMENT_INTENT,
            {
               object: {
                  status: '',
                  currency: 'usd',
                  amount: chargeAmount,
                  transferGroup: `${cart.id}`,
                  paymentMethod: customer.paymentMethod,
                  onBehalfOf: organization.stripeAccountId,
                  stripeCustomerId: customer.stripeCustomerId,
                  organizationTransfers: {
                     data: {
                        amount: transferAmount,
                        transferGroup: `${cart.id}`,
                        destination: organization.stripeAccountId,
                     },
                  },
               },
            }
         )
         return res.json({
            success: true,
            data: { customerPaymentIntent },
            message: 'Payment request has been initiated!',
         })
      } else {
         return res.status(403).json({
            success: false,
            error: "Your account doesn't have stripe linked!",
         })
      }
   } catch (error) {
      return res.status(404).json({ success: false, error: error.message })
   }
}

const FETCH_ORG_CA_ID = `
   query organization($id: Int!) {
      organization(id: $id) {
         chargeFixed,
         chargeCurrency,
         stripeAccountId
         chargePercentage,
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
