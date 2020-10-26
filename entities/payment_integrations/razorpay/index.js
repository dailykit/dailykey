import moment from 'moment'
import Razorpay from 'razorpay'
import { GraphQLClient } from 'graphql-request'

import { UPDATE_CART, UPDATE_PAYMENT_RECORD } from '../graphql'

const client = new GraphQLClient(process.env.DAILYCLOAK_URL, {
   headers: {
      'x-hasura-admin-secret': process.env.DAILYCLOAK_ADMIN_SECRET,
   },
})

export const request = async ({ data = {}, keys = {} }) => {
   try {
      const { id, amount = null, receipt = '', currency = '' } = data

      if (!amount) throw Error('Amount is required!')
      if (!currency) throw Error('Currency is required!')
      if (Object.keys(keys).length === 0) throw Error('Keys are missing!')

      const options = {
         receipt,
         currency,
         payment_capture: 0,
         amount: amount * 100,
      }

      if (!keys.id) throw Error('Missing razorpay key id!')
      if (!keys.secret) throw Error('Missing razorpay key secret!')

      const rzp = new Razorpay({
         key_id: keys.publishable.id,
         key_secret: keys.secret.id,
      })

      const order = await rzp.orders.create(options)

      await client.request(UPDATE_PAYMENT_RECORD, {
         pk_columns: { id },
         _set: {
            paymentRequestId: order.id,
         },
      })

      return order
   } catch (error) {
      throw error
   }
}

export const transaction = async ({ data, payment }) => {
   try {
      const { success = true } = data

      await client.request(UPDATE_PAYMENT_RECORD, {
         pk_columns: { id: payment.id },
         _set: {
            paymentStatus: success ? 'SUCCEEDED' : 'FAILED',
            paymentTransactionInfo: data,
            ...(success && {
               paymentTransactionId: data.razorpay_payment_id,
            }),
         },
      })

      const { adminSecret, datahubUrl } = payment.partnership.organization
      const datahubClient = new GraphQLClient(datahubUrl, {
         headers: {
            'x-hasura-admin-secret': adminSecret,
         },
      })

      await datahubClient.request(UPDATE_CART, {
         id: payment.orderCartId,
         _set: {
            paymentId: payment.id,
            paymentUpdatedAt: moment().toISOString(),
            paymentStatus: success ? 'SUCCEEDED' : 'FAILED',
         },
      })
   } catch (error) {
      throw Error
   }
}
