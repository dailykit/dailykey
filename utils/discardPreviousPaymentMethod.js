import axios from 'axios'
import get from 'lodash.get'
import { GraphQLClient } from 'graphql-request'

const dailycloak = new GraphQLClient(process.env.DAILYCLOAK_URL, {
   headers: { 'x-hasura-admin-secret': process.env.DAILYCLOAK_ADMIN_SECRET },
})

export const discardPreviousPaymentMethod = async args => {
   try {
      const { organization = {} } = args
      const datahub = new GraphQLClient(organization.datahubUrl, {
         headers: { 'x-hasura-admin-secret': organization.adminSecret },
      })

      const { cart } = await datahub.request(CART, { id: cart.id })

      let type = ''
      if (cart.paymentId) {
         type = 'razorpay'
      }

      if (type === 'razorpay') {
         await handleRazorpay({ ...args, datahub })
      }
      return
   } catch (error) {
      throw error
   }
}

const handleRazorpay = async args => {
   try {
      const { cartId, organization = {} } = args

      const { payments = [] } = await dailycloak.request(
         RAZORPAY_TRANSACTIONS,
         {
            where: {
               orderCartId: { _eq: cartId },
               paymentPartnership: { organizationId: { _eq: organization.id } },
            },
         }
      )

      if (payments.length === 0) return

      await Promise.all(
         payments.map(async payment => {
            try {
               const { paymentRequestId } = payment
               if (!paymentRequestId)
                  return {
                     success: true,
                     message: 'Aborting, since no payment request id linked!',
                  }

               if (paymentRequestId.startsWith('order'))
                  return {
                     success: false,
                     message: 'Razorpay orders are not cancellable!',
                  }

               if (paymentRequestId.startsWith('plink')) {
                  let clientId = get(payment, 'partnership.clientId')
                  let secretId = get(payment, 'partnership.secretId')

                  if (clientId && secretId) {
                     const url = `https://api.razorpay.com/v1/payment_links/${paymentRequestId}/cancel`
                     const auth = { username: clientId, password: secretId }
                     const headers = { 'Content-type': 'application/json' }
                     const options = { method: 'POST', url, headers, auth }
                     const { status } = await axios(options)

                     if (status === 200) {
                        await dailycloak.request(UPDATE_RAZORPAY_PAYMENT, {
                           id: payment.id,
                           _set: {
                              isAutoCancelled: true,
                              paymentStatus: 'CANCELLED',
                           },
                        })
                        return {
                           success: true,
                           message: 'Successfully cancelled payment link.',
                        }
                     }
                  }
               }
               return { success: true }
            } catch (error) {
               const request = {
                  error: get(error, 'response.data.error'),
                  status: get(error, 'response.status'),
               }
               if (request.status === 400) {
                  return {
                     success: false,
                     message: 'Payment link is already cancelled',
                  }
               }
               return { success: false, error }
            }
         })
      )
   } catch (error) {
      throw error
   }
}

const RAZORPAY_TRANSACTIONS = `
   query payments($where: paymentHub_payment_bool_exp = {}) {
      payments: paymentHub_payment(where: $where) {
         id
         paymentRequestId
         partnership: paymentPartnership {
            id
            secretId: secretConfig(path: "id")
            clientId: publishableConfig(path: "id")
            company: paymentCompany {
               type
               identifier
            }
         }
      }
   }
`

const UPDATE_RAZORPAY_PAYMENT = gql`
   mutation updatePayment(
      $id: uuid!
      $_set: paymentHub_payment_set_input = {}
   ) {
      updatePayment: update_paymentHub_payment_by_pk(
         pk_columns: { id: $id }
         _set: $_set
      ) {
         id
      }
   }
`

const CART = `
   query cart($id: Int!) {
      cart(id: $id) {
         id
         paymentId
         paymentStatus
         stripeInvoiceId
      }
   }
`
