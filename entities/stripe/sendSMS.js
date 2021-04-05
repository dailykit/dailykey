import { GraphQLClient } from 'graphql-request'

import { logger } from '../../utils'

const dailycloak = new GraphQLClient(process.env.DAILYCLOAK_URL, {
   headers: {
      'x-hasura-admin-secret': process.env.DAILYCLOAK_ADMIN_SECRET,
   },
})

const dailykey = new GraphQLClient(process.env.HASURA_KEYCLOAK_URL, {
   headers: {
      'x-hasura-admin-secret': process.env.KEYCLOAK_ADMIN_SECRET,
   },
})

export const sendSMS = async (req, res) => {
   try {
      const { paymentMethod, transactionRemark } = req.body.event.data.new
      const { paymentMethod: method } = await dailykey.request(PAYMENT_METHOD, {
         stripePaymentMethodId: paymentMethod,
      })

      const customer = {
         name: '',
         phoneNo: '',
      }
      if (method.customer) {
         if (method.customer.firstName) {
            customer.name = method.customer.firstName
         }
         if (method.customer.lastName) {
            customer.name += ' ' + method.customer.lastName
         }
         if (method.customer.phoneNumber) {
            customer.phoneNo = method.customer.phoneNumber
         }
      }

      if (!customer.phoneNo) throw Error('Phone number is required!')

      let action_url = ''
      if (
         transactionRemark &&
         Object.keys(transactionRemark).length > 0 &&
         transactionRemark.next_action
      ) {
         if (transactionRemark.next_action.type === 'use_stripe_sdk') {
            action_url = transactionRemark.next_action.use_stripe_sdk.stripe_js
         } else {
            action_url = transactionRemark.next_action.redirect_to_url.url
         }
      }

      if (!action_url) {
         return res
            .status(200)
            .json({ success: true, message: 'Action url is missing!' })
      }

      const sms = await dailycloak.request(SEND_SMS, {
         phone: `+91${customer.phoneNo}`,
         message: `Dear ${
            customer.name.trim() ? customer.name : 'customer'
         }, your payment requires additional action, please use the following link to complete your payment. \n Link: ${action_url}`,
      })
      if (sms.success) {
         return res
            .status(200)
            .json({ success: true, message: 'SMS sent successfully' })
      }
      return res.status(200)
   } catch (error) {
      console.log(error)
      logger('/api/webhooks/stripe/send-sms', error)
      return res.status(500).json({ success: false, error })
   }
}

const SEND_SMS = `
   mutation sendSMS($message: String!, $phone: String!) {
      sendSMS(message: $message, phone: $phone) {
         success
         message
      }
   }
`

const PAYMENT_METHOD = `
   query paymentMethod($stripePaymentMethodId: String!) {
      paymentMethod: platform_stripePaymentMethod(
         stripePaymentMethodId: $stripePaymentMethodId
      ) {
         stripePaymentMethodId
         customer {
            phoneNumber
            firstName
            lastName
         }
      }
   }
`
